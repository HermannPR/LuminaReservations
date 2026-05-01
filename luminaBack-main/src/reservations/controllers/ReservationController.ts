import { Request, Response } from "express"
import { ReservationService } from "../services/ReservationService"
import { ReservationRepository } from "../repositories/ReservationRepository"
import { StreakRepository } from "../repositories/StreakRepository"
import { BadgeService } from "../services/BadgeService"
import { ReservationError } from "../errors"
import { ReservationEventHub } from "../realtime/ReservationEventHub"
import type { PriorityCategory } from "../interfaces"
import type { AuthRequest } from "../../shared/auth"

const VALID_PRIORITY_CATEGORIES = new Set<PriorityCategory>([
  "escritorio", "colaborativo", "work_lab", "phone_booth", "garage",
])

export class ReservationController {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly reservationRepository: ReservationRepository,
    private readonly streakRepository: StreakRepository,
    private readonly badgeService: BadgeService,
    private readonly eventHub?: ReservationEventHub,
  ) {}

  async getAvailability(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const { reservation_date, start_time, end_time, floor_id, priority_category } = req.query

      if (!reservation_date || !start_time || !end_time) {
        res.status(400).json({
          error: "MISSING_FIELDS",
          message: "Los campos reservation_date, start_time y end_time son requeridos",
        })
        return
      }

      const parsedCategory = priority_category !== undefined ? String(priority_category) : undefined
      if (parsedCategory !== undefined && !VALID_PRIORITY_CATEGORIES.has(parsedCategory as PriorityCategory)) {
        res.status(400).json({ error: "INVALID_CATEGORY", message: "Categoría de espacio inválida" })
        return
      }

      const filter = {
        reservation_date: String(reservation_date),
        start_time: String(start_time),
        end_time: String(end_time),
        ...(floor_id !== undefined ? { floor_id: Number(floor_id) } : {}),
        ...(parsedCategory !== undefined ? { priority_category: parsedCategory as PriorityCategory } : {}),
      }

      const spaces = await this.reservationService.checkAvailability(filter, userId)
      res.status(200).json(spaces)
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async getRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const { reservation_date, start_time, end_time, floor_id, priority_category } = req.query

      if (!reservation_date || !start_time || !end_time) {
        res.status(400).json({
          error: "MISSING_FIELDS",
          message: "Los campos reservation_date, start_time y end_time son requeridos",
        })
        return
      }

      const parsedCategory = priority_category !== undefined ? String(priority_category) : undefined
      if (parsedCategory !== undefined && !VALID_PRIORITY_CATEGORIES.has(parsedCategory as PriorityCategory)) {
        res.status(400).json({ error: "INVALID_CATEGORY", message: "Categoría de espacio inválida" })
        return
      }

      const result = await this.reservationService.getRecommendations({
        reservation_date: String(reservation_date),
        start_time: String(start_time),
        end_time: String(end_time),
        ...(floor_id !== undefined ? { floor_id: Number(floor_id) } : {}),
        ...(parsedCategory !== undefined ? { priority_category: parsedCategory as PriorityCategory } : {}),
      }, userId)

      res.json(result)
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async createReservation(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const result = await this.reservationService.createReservation(req.body, userId)
      this.eventHub?.publish({
        type: "reservation.created",
        actor_user_id: userId,
        reservation_id: result.reservation_id,
        reservation_date: result.reservation_date,
        space_id: result.space_id,
        parking: result.parking_spot !== null || result.requiere_estacionamiento,
      })
      res.status(201).json(result)
    } catch (err) {
      if (err instanceof ReservationError) {
        if (err.statusCode >= 500) console.error("ReservationError 500:", err)
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async getFloorOccupancy(req: Request, res: Response): Promise<void> {
    try {
      const { reservation_date, floor_id } = req.query

      if (!reservation_date || floor_id === undefined) {
        res.status(400).json({
          error: "MISSING_FIELDS",
          message: "Los campos reservation_date y floor_id son requeridos",
        })
        return
      }

      const floorId = Number(floor_id)
      if (!Number.isInteger(floorId)) {
        res.status(400).json({ error: "INVALID_ID", message: "ID de piso inválido" })
        return
      }

      const occupancy = await this.reservationRepository.findOccupancyByFloor(
        floorId,
        String(reservation_date)
      )
      res.status(200).json(occupancy)
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async checkIn(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const reservationId = parseInt(req.params.id, 10)

      if (isNaN(reservationId)) {
        res.status(400).json({ error: "INVALID_ID", message: "ID de reservación inválido" })
        return
      }

      const forwardedFor = req.headers["x-forwarded-for"]
      const clientIp = typeof forwardedFor === "string" ? forwardedFor : req.ip

      const result = await this.reservationService.checkIn(reservationId, userId, clientIp)
      const reservation = await this.reservationRepository.findById(reservationId)
      this.eventHub?.publish({
        type: "reservation.checked_in",
        actor_user_id: userId,
        reservation_id: reservationId,
        reservation_date: this.normalizeDate(reservation?.reservation_date),
        space_id: reservation?.space_id ?? null,
        parking: reservation?.parking_spot_id !== null && reservation?.parking_spot_id !== undefined,
      })
      res.status(200).json({ message: "Check-in realizado", ...result })
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async cancelReservation(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const reservationId = parseInt(req.params.id, 10)

      if (isNaN(reservationId)) {
        res.status(400).json({ error: "INVALID_ID", message: "ID de reservación inválido" })
        return
      }

      const reservation = await this.reservationRepository.findById(reservationId)
      await this.reservationService.cancelReservation(reservationId, userId)
      this.eventHub?.publish({
        type: "reservation.cancelled",
        actor_user_id: userId,
        reservation_id: reservationId,
        reservation_date: this.normalizeDate(reservation?.reservation_date),
        space_id: reservation?.space_id ?? null,
        parking: reservation?.parking_spot_id !== null && reservation?.parking_spot_id !== undefined,
      })
      res.status(200).json({ message: "Reservación cancelada" })
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async getMyReservations(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const status = typeof req.query.status === "string" ? req.query.status : undefined
      await this.reservationService.expireMissedReservations()
      const reservations = await this.reservationRepository.findByUserId(userId, status)
      res.json(reservations)
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async getMyStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const [streak, badges] = await Promise.all([
        this.streakRepository.findByUserId(userId),
        this.badgeService.findEarnedWithStatus(userId),
      ])
      res.json({
        streak: streak ?? { current_streak: 0, longest_streak: 0, last_check_in_date: null },
        badges,
      })
    } catch (err) {
      console.error("getMyStats error:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  private normalizeDate(value: string | Date | undefined): string | undefined {
    if (!value) return undefined
    if (typeof value === "string") return value.slice(0, 10)
    return value.toISOString().slice(0, 10)
  }
}
