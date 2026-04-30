import { SpaceRepository } from "../repositories/SpaceRepository"
import { ReservationRepository } from "../repositories/ReservationRepository"
import { ParkingRepository } from "../repositories/ParkingRepository"
import { StreakRepository } from "../repositories/StreakRepository"
import { BadgeService } from "./BadgeService"
import { ReservationError } from "../errors"
import {
  AvailabilityFilter,
  CreateReservationInput,
  IntelligentRecommendation,
  RecommendationResult,
  ReservationResult,
  CheckInResult,
  Space,
} from "../interfaces"
import { getAllowedCheckInCidrs, getCheckInWindowOverrideMinutes } from "../config"

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const CODE_LENGTH = 8
const DEFAULT_TIMEZONE = process.env.RESERVATION_TIMEZONE ?? "America/Monterrey"
const CHECK_IN_POST_START_MINUTES = 30

export class ReservationService {
  constructor(
    private readonly spaceRepository: SpaceRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly parkingRepository?: ParkingRepository,
    private readonly streakRepository?: StreakRepository,
    private readonly badgeService?: BadgeService
  ) {}

  async checkAvailability(filter: AvailabilityFilter, _userId: number): Promise<Space[]> {
    const today = new Date().toISOString().split("T")[0]

    if (filter.end_time <= filter.start_time) {
      throw new ReservationError(400, "INVALID_TIME_RANGE", "El tiempo de fin debe ser mayor al tiempo de inicio")
    }

    if (filter.reservation_date < today) {
      throw new ReservationError(400, "INVALID_DATE", "La fecha de reservación no puede ser en el pasado")
    }

    return this.spaceRepository.findAvailable(filter)
  }

  async createReservation(input: CreateReservationInput, userId: number): Promise<ReservationResult> {
    const { space_id, reservation_date, start_time, end_time } = input
    const requiresParking = input.requiere_estacionamiento === true
    const hasSpaceId = typeof space_id === "number" && space_id > 0

    // Validate required fields
    if (!reservation_date || !start_time || !end_time || !hasSpaceId) {
      throw new ReservationError(400, "MISSING_FIELDS", "Los campos space_id, reservation_date, start_time y end_time son requeridos")
    }

    // Validate time range
    if (end_time <= start_time) {
      throw new ReservationError(400, "INVALID_TIME_RANGE", "El tiempo de fin debe ser mayor al tiempo de inicio")
    }

    // Validate date
    const today = new Date().toISOString().split("T")[0]
    if (reservation_date < today) {
      throw new ReservationError(400, "INVALID_DATE", "La fecha de reservación no puede ser en el pasado")
    }

    // Validate parking 24h rule
    if (requiresParking) {
      const reservationStartMs = this.toWallClockTimestamp(reservation_date, start_time)
      const nowMs = this.getCurrentWallClockTime()
      if (reservationStartMs - nowMs < 24 * 60 * 60 * 1000) {
        throw new ReservationError(422, "PARKING_TOO_LATE", "El estacionamiento solo puede solicitarse con al menos 24 horas de anticipación")
      }
    }

    const resolvedSpaceId = space_id as number

    // Check space exists
    const space = await this.spaceRepository.findById(resolvedSpaceId)
    if (!space) {
      throw new ReservationError(404, "SPACE_NOT_FOUND", "El espacio no existe o no está disponible")
    }

    // Check user conflict for office spaces only. Parking-only reservations may overlap desk reservations.
    const hasOfficeConflict = await this.reservationRepository.hasOverlappingOfficeForUser(
      userId, reservation_date, start_time, end_time
    )
    if (hasOfficeConflict) {
      throw new ReservationError(409, "USER_CONFLICT", "El usuario ya tiene una reservación en ese horario")
    }

    if (requiresParking) {
      const hasParkingConflict = await this.reservationRepository.hasOverlappingParkingForUser(
        userId, reservation_date, start_time, end_time
      )
      if (hasParkingConflict) {
        throw new ReservationError(409, "PARKING_CONFLICT", "El usuario ya tiene estacionamiento reservado en ese horario")
      }
    }

    // Check space conflict
    const hasSpaceConflict = await this.reservationRepository.hasOverlappingForSpace(
      resolvedSpaceId, reservation_date, start_time, end_time
    )
    if (hasSpaceConflict) {
      throw new ReservationError(409, "SPACE_UNAVAILABLE", "El espacio no está disponible en ese horario")
    }

    // Generate unique code
    const code = await this.generateUniqueCode()

    // Create reservation
    const reservation = await this.reservationRepository.create({
      user_id: userId,
      space_id: resolvedSpaceId,
      reservation_date,
      start_time,
      end_time,
      reservation_code: code,
      status: "confirmada",
      grace_period_minutes: this.getEffectiveGracePeriodMinutes(15),
      requiere_estacionamiento: requiresParking,
      check_in_time: null,
      check_out_time: null,
    })

    // Assign parking spot if requested (soft failure — reservation always succeeds)
    let finalReservation = reservation
    if (requiresParking && this.parkingRepository) {
      try {
        const spot = await this.parkingRepository.assignSpot(
          reservation.reservation_id,
          reservation_date,
          start_time,
          end_time
        )
        finalReservation = { ...reservation, parking_spot: spot }
      } catch (err) {
        console.error("Parking assignment failed (reservation still created):", err)
      }
    }

    // Evaluate reservation-trigger badges (soft failure)
    let newBadges: import("../interfaces").BadgeInfo[] = []
    if (this.badgeService) {
      try {
        newBadges = await this.badgeService.evaluateAfterReservation(userId)
      } catch (err) {
        console.error("Badge evaluation failed (reservation still created):", err)
      }
    }

    return { ...finalReservation, newBadges }
  }

  async cancelReservation(reservationId: number, userId: number): Promise<void> {
    const reservation = await this.reservationRepository.findById(reservationId)

    if (!reservation) {
      throw new ReservationError(404, "NOT_FOUND", "Reservación no encontrada")
    }

    if (reservation.user_id !== userId) {
      throw new ReservationError(403, "FORBIDDEN", "No autorizado para cancelar esta reservación")
    }

    if (reservation.status !== "confirmada") {
      throw new ReservationError(422, "INVALID_STATUS", "Solo se pueden cancelar reservaciones con estado confirmada")
    }

    const today = new Date().toISOString().split("T")[0]
    const reservationDate = typeof reservation.reservation_date === "string"
      ? reservation.reservation_date
      : (reservation.reservation_date as Date).toISOString().split("T")[0]

    if (reservationDate < today) {
      throw new ReservationError(422, "INVALID_DATE", "No se puede cancelar una reservación pasada")
    }

    await this.reservationRepository.update(reservationId, { status: "cancelada" })
  }

  async checkIn(reservationId: number, userId: number, clientIp?: string): Promise<CheckInResult> {
    const reservation = await this.reservationRepository.findById(reservationId)
    if (!reservation) {
      throw new ReservationError(404, "SPACE_NOT_FOUND", "Reservación no encontrada")
    }

    if (reservation.user_id !== userId) {
      throw new ReservationError(401, "UNAUTHORIZED", "No autorizado")
    }

    if (reservation.status !== "confirmada") {
      throw new ReservationError(422, "INVALID_STATUS", "La reservación no está en estado confirmada")
    }

    this.validateCheckInIp(clientIp)

    const window = this.getCheckInWindow(
      reservation.reservation_date,
      reservation.start_time,
      reservation.grace_period_minutes
    )
    const now = this.getCurrentWallClockTime()

    if (now < window.opensAt) {
      throw new ReservationError(422, "CHECK_IN_NOT_AVAILABLE_YET", "El check-in estará disponible 15 minutos antes de la reservación")
    }

    if (now > window.closesAt) {
      throw new ReservationError(422, "CHECK_IN_WINDOW_CLOSED", "La ventana de check-in ya cerró")
    }

    await this.reservationRepository.update(reservationId, {
      status: "activa",
      check_in_time: new Date(),
    })

    const reservationDate = this.normalizeReservationDate(reservation.reservation_date)

    // Update streak
    const streak = this.streakRepository
      ? await this.streakRepository.upsertAfterCheckIn(userId, reservationDate)
      : { current_streak: 0, longest_streak: 0, last_check_in_date: null }

    // Evaluate check-in badges (soft failure)
    let newBadges: import("../interfaces").BadgeInfo[] = []
    if (this.badgeService) {
      try {
        newBadges = await this.badgeService.evaluateAfterCheckIn(userId, streak)
      } catch (err) {
        console.error("Badge evaluation failed (check-in still succeeded):", err)
      }
    }

    return { streak, newBadges }
  }

  private validateCheckInIp(clientIp?: string): void {
    const configuredCidrs = getAllowedCheckInCidrs()

    if (configuredCidrs.length === 0) {
      return
    }

    const normalizedIp = this.normalizeIpv4(clientIp)
    if (!normalizedIp) {
      throw new ReservationError(403, "CHECK_IN_OUTSIDE_ALLOWED_NETWORK", "No fue posible validar la red para realizar el check-in")
    }

    const isAllowed = configuredCidrs.some((cidr) => this.isIpInCidr(normalizedIp, cidr))
    if (!isAllowed) {
      throw new ReservationError(403, "CHECK_IN_OUTSIDE_ALLOWED_NETWORK", "El check-in solo puede realizarse dentro de la red permitida")
    }
  }

  private getCheckInWindow(reservationDate: string | Date, startTime: string, gracePeriodMinutes: number): {
    opensAt: number
    closesAt: number
  } {
    const start = this.toWallClockTimestamp(reservationDate, startTime)
    const effectiveGracePeriodMinutes = this.getEffectiveGracePeriodMinutes(gracePeriodMinutes)
    const opensOffsetMs = effectiveGracePeriodMinutes * 60 * 1000
    const closesOffsetMs = CHECK_IN_POST_START_MINUTES * 60 * 1000

    return {
      opensAt: start - opensOffsetMs,
      closesAt: start + closesOffsetMs,
    }
  }

  private getEffectiveGracePeriodMinutes(gracePeriodMinutes: number): number {
    const overrideMinutes = getCheckInWindowOverrideMinutes()
    if (overrideMinutes !== null) {
      return overrideMinutes
    }

    return gracePeriodMinutes
  }

  async expireMissedReservations(): Promise<void> {
    const today = new Date().toISOString().split("T")[0]
    const pendingReservations = await this.reservationRepository.findPendingCheckInCandidates(today)
    const now = this.getCurrentWallClockTime()

    await Promise.all(
      pendingReservations
        .filter((reservation) => {
          const window = this.getCheckInWindow(
            reservation.reservation_date,
            reservation.start_time,
            reservation.grace_period_minutes
          )
          return now > window.closesAt
        })
        .map((reservation) =>
          this.reservationRepository.update(reservation.id, {
            status: "no_show",
            check_in_time: reservation.check_in_time,
          })
        )
    )
  }

  async getRecommendations(filter: AvailabilityFilter, userId: number): Promise<RecommendationResult> {
    if (!filter.reservation_date || !filter.start_time || !filter.end_time) {
      throw new ReservationError(400, "MISSING_FIELDS", "Los campos reservation_date, start_time y end_time son requeridos")
    }

    if (filter.end_time <= filter.start_time) {
      throw new ReservationError(400, "INVALID_TIME_RANGE", "El tiempo de fin debe ser mayor al tiempo de inicio")
    }

    const [availableSpaces, occupants, frequentNeighbors, predictedOccupancy] = await Promise.all([
      this.spaceRepository.findAvailable(filter),
      this.reservationRepository.findCurrentOccupants(filter),
      this.reservationRepository.findFrequentNeighbors(userId),
      this.reservationRepository.findPredictedOccupancy(filter),
    ])

    const recommendations: IntelligentRecommendation[] = availableSpaces
      .map((space) => {
        const reasons: string[] = []
        let score = 50
        let nearbyUser: IntelligentRecommendation["nearby_user"] = null

        const matchingNeighbors = occupants
          .filter((occupant) => occupant.floor_id === space.floor_id && frequentNeighbors.has(occupant.user.id))
          .map((occupant) => ({
            occupant,
            relationshipStrength: frequentNeighbors.get(occupant.user.id) ?? 0,
            distance: this.distance(space.layout_cx, space.layout_cy, occupant.layout_cx, occupant.layout_cy),
          }))
          .sort((a, b) => (a.distance - b.distance) || (b.relationshipStrength - a.relationshipStrength))

        const nearest = matchingNeighbors[0]
        if (nearest) {
          const proximityBoost = Math.max(0, 35 - nearest.distance * 60)
          const relationshipBoost = Math.min(20, nearest.relationshipStrength * 3)
          score += proximityBoost + relationshipBoost
          nearbyUser = nearest.occupant.user
          reasons.push(`Cerca de ${nearbyUser.first_name} ${nearbyUser.last_name}, con quien sueles coincidir`)
        }

        if (filter.priority_category && space.priority_category === filter.priority_category) {
          score += 8
          reasons.push("Coincide con el tipo de espacio filtrado")
        }

        if (predictedOccupancy >= 0.75) {
          score += 7
          reasons.push("Alta demanda prevista: conviene reservar pronto")
        } else if (predictedOccupancy <= 0.35) {
          score += 5
          reasons.push("Baja ocupación prevista para este horario")
        }

        if (reasons.length === 0) {
          reasons.push("Disponible y con buena distribución para el horario seleccionado")
        }

        return {
          space,
          score: Math.round(score),
          reasons,
          nearby_user: nearbyUser,
          predicted_occupancy: predictedOccupancy,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)

    return {
      predicted_occupancy: predictedOccupancy,
      prediction_label:
        predictedOccupancy >= 0.7 ? "alta" :
        predictedOccupancy >= 0.4 ? "media" :
        "baja",
      recommendations,
    }
  }

  private distance(ax: number | null, ay: number | null, bx: number | null, by: number | null): number {
    if (ax == null || ay == null || bx == null || by == null) return 1
    return Math.hypot(ax - bx, ay - by)
  }

  private getCurrentWallClockTime(): number {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })

    const parts = formatter.formatToParts(new Date())
    const get = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value ?? "0")

    return Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second")
    )
  }

  private toWallClockTimestamp(date: string | Date, time: string): number {
    const normalizedDate = this.normalizeReservationDate(date)
    const [year, month, day] = normalizedDate.split("-").map(Number)
    const [hour, minute] = time.split(":").map(Number)

    return Date.UTC(year, month - 1, day, hour, minute, 0)
  }

  private normalizeReservationDate(date: string | Date): string {
    if (date instanceof Date) {
      return this.formatDateParts(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate()
      )
    }

    const trimmed = String(date).trim()
    if (trimmed.includes("T")) {
      return trimmed.slice(0, 10)
    }

    return trimmed
  }

  private formatDateParts(year: number, month: number, day: number): string {
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
  }

  private normalizeIpv4(clientIp?: string): string | null {
    if (!clientIp) return null

    if (clientIp.includes(",")) {
      return this.normalizeIpv4(clientIp.split(",")[0]?.trim())
    }

    const normalized = clientIp.trim()
    if (normalized.startsWith("::ffff:")) {
      return normalized.slice(7)
    }

    if (normalized === "::1") {
      return "127.0.0.1"
    }

    return /^\d{1,3}(\.\d{1,3}){3}$/.test(normalized) ? normalized : null
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    const [network, maskText] = cidr.split("/")
    const maskBits = Number(maskText)

    if (!network || Number.isNaN(maskBits) || maskBits < 0 || maskBits > 32) {
      return false
    }

    const ipInt = this.ipv4ToInt(ip)
    const networkInt = this.ipv4ToInt(network)
    if (ipInt === null || networkInt === null) {
      return false
    }

    if (maskBits === 0) {
      return true
    }

    const mask = (0xffffffff << (32 - maskBits)) >>> 0
    return (ipInt & mask) === (networkInt & mask)
  }

  private ipv4ToInt(ip: string): number | null {
    const octets = ip.split(".").map(Number)
    if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
      return null
    }

    return (((octets[0] << 24) >>> 0) +
      ((octets[1] << 16) >>> 0) +
      ((octets[2] << 8) >>> 0) +
      (octets[3] >>> 0)) >>> 0
  }

  private async generateUniqueCode(): Promise<string> {
    while (true) {
      let code = ""
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
      }
      const existing = await this.reservationRepository.findByCode(code)
      if (!existing) return code
    }
  }
}
