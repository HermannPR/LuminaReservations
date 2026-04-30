import { beforeEach, describe, expect, it, vi } from "vitest"
import { ReservationService } from "./ReservationService"
import type { SpaceRepository } from "../repositories/SpaceRepository"
import type { ReservationRepository } from "../repositories/ReservationRepository"
import type { ParkingRepository } from "../repositories/ParkingRepository"
import type { BadgeService } from "./BadgeService"
import type { PublicUserProfile } from "../interfaces"

vi.mock("../config", () => ({
  getAllowedCheckInCidrs: vi.fn().mockReturnValue([]),
  getCheckInWindowOverrideMinutes: vi.fn().mockReturnValue(null),
}))

const FUTURE_DATE = "2099-06-01"

const teammate: PublicUserProfile = {
  id: 11,
  first_name: "Ana",
  last_name: "Garcia",
  email: "ana@example.com",
  department: "Delivery",
  profile_photo_url: "data:image/png;base64,AAAA",
}

function makeSpace(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    space_number: "PB-01",
    floor_id: 1,
    priority_category: "escritorio" as const,
    is_active: true,
    layout_type: "desk" as const,
    layout_direction: "up" as const,
    layout_cx: 0.1,
    layout_cy: 0.1,
    layout_points: null,
    visual_only: false,
    ...overrides,
  }
}

function makeReservationResult(overrides: Record<string, unknown> = {}) {
  return {
    reservation_id: 10,
    reservation_code: "ABCD1234",
    space_id: 5,
    reservation_date: FUTURE_DATE,
    start_time: "09:00",
    end_time: "10:00",
    status: "confirmada" as const,
    requiere_estacionamiento: false,
    parking_spot: null,
    ...overrides,
  }
}

describe("ReservationService", () => {
  let spaceRepository: SpaceRepository
  let reservationRepository: ReservationRepository
  let parkingRepository: ParkingRepository
  let badgeService: BadgeService
  let service: ReservationService

  beforeEach(() => {
    spaceRepository = {
      findAvailable: vi.fn().mockResolvedValue([makeSpace()]),
      findById: vi.fn().mockResolvedValue(makeSpace()),
    } as unknown as SpaceRepository

    reservationRepository = {
      hasOverlappingOfficeForUser: vi.fn().mockResolvedValue(false),
      hasOverlappingParkingForUser: vi.fn().mockResolvedValue(false),
      hasOverlappingForSpace: vi.fn().mockResolvedValue(false),
      findByCode: vi.fn().mockResolvedValue(null),
      findById: vi.fn(),
      create: vi.fn().mockResolvedValue(makeReservationResult()),
      update: vi.fn(),
      findPendingCheckInCandidates: vi.fn().mockResolvedValue([]),
      findCurrentOccupants: vi.fn().mockResolvedValue([]),
      findFrequentNeighbors: vi.fn().mockResolvedValue(new Map()),
      findPredictedOccupancy: vi.fn().mockResolvedValue(0.25),
    } as unknown as ReservationRepository

    parkingRepository = {
      assignSpot: vi.fn().mockResolvedValue({ spot_id: 1, zone_name: "T1", spot_number: "T1-01" }),
    } as unknown as ParkingRepository

    badgeService = {
      evaluateAfterReservation: vi.fn().mockResolvedValue([]),
      evaluateAfterCheckIn: vi.fn().mockResolvedValue([]),
    } as unknown as BadgeService

    service = new ReservationService(
      spaceRepository,
      reservationRepository,
      parkingRepository,
      undefined,
      badgeService
    )
  })

  it("creates a workspace reservation without assigning parking when parking is not requested", async () => {
    const result = await service.createReservation({
      space_id: 5,
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
    }, 7)

    expect(result).toMatchObject({
      reservation_id: 10,
      space_id: 5,
      requiere_estacionamiento: false,
      parking_spot: null,
    })
    expect(reservationRepository.hasOverlappingOfficeForUser).toHaveBeenCalledWith(7, FUTURE_DATE, "09:00", "10:00")
    expect(reservationRepository.hasOverlappingParkingForUser).not.toHaveBeenCalled()
    expect(parkingRepository.assignSpot).not.toHaveBeenCalled()
    expect(reservationRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 7,
      space_id: 5,
      requiere_estacionamiento: false,
    }))
  })

  it("assigns parking only as part of a workspace reservation", async () => {
    vi.mocked(reservationRepository.create).mockResolvedValue(makeReservationResult({
      requiere_estacionamiento: true,
    }))

    const result = await service.createReservation({
      space_id: 5,
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      requiere_estacionamiento: true,
    }, 7)

    expect(reservationRepository.hasOverlappingParkingForUser).toHaveBeenCalledWith(7, FUTURE_DATE, "09:00", "10:00")
    expect(parkingRepository.assignSpot).toHaveBeenCalledWith(10, FUTURE_DATE, "09:00", "10:00")
    expect(result.parking_spot).toMatchObject({ zone_name: "T1", spot_number: "T1-01" })
  })

  it("rejects reservation requests without a workspace id", async () => {
    await expect(service.createReservation({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      requiere_estacionamiento: true,
    }, 7)).rejects.toMatchObject({ code: "MISSING_FIELDS" })

    expect(spaceRepository.findById).not.toHaveBeenCalled()
    expect(reservationRepository.create).not.toHaveBeenCalled()
    expect(parkingRepository.assignSpot).not.toHaveBeenCalled()
  })

  it("returns intelligent recommendations near frequent collaborators", async () => {
    vi.mocked(spaceRepository.findAvailable).mockResolvedValue([
      makeSpace({ id: 21, space_number: "PB-21", layout_cx: 0.18, layout_cy: 0.18 }),
      makeSpace({ id: 22, space_number: "PB-22", layout_cx: 0.9, layout_cy: 0.9 }),
    ])
    vi.mocked(reservationRepository.findCurrentOccupants).mockResolvedValue([
      {
        space_id: 20,
        floor_id: 1,
        layout_cx: 0.2,
        layout_cy: 0.2,
        user: teammate,
      },
    ])
    vi.mocked(reservationRepository.findFrequentNeighbors).mockResolvedValue(new Map([[11, 8]]))
    vi.mocked(reservationRepository.findPredictedOccupancy).mockResolvedValue(0.82)

    const result = await service.getRecommendations({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      floor_id: 1,
      priority_category: "escritorio",
    }, 7)

    expect(result.prediction_label).toBe("alta")
    expect(result.recommendations[0]).toMatchObject({
      space: expect.objectContaining({ id: 21 }),
      nearby_user: teammate,
    })
    expect(result.recommendations[0].reasons.join(" ")).toContain("Ana Garcia")
  })
})
