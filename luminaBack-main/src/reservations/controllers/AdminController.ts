import { Request, Response } from "express"
import { ReservationRepository } from "../repositories/ReservationRepository"
import { ReservationError } from "../errors"
import { ReservationEventHub } from "../realtime/ReservationEventHub"
import type { PriorityCategory } from "../interfaces"

const VALID_PRIORITY_CATEGORIES = new Set<PriorityCategory>([
  "escritorio", "colaborativo", "work_lab", "phone_booth", "garage",
])

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value)
}

export class AdminController {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly eventHub?: ReservationEventHub
  ) {}

  async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const date = typeof req.query.date === "string"
        ? req.query.date
        : new Date().toISOString().slice(0, 10)
      res.json(await this.reservationRepository.getAdminOverview(date))
    } catch (err) {
      this.handleError(err, res)
    }
  }

  async blockArea(req: Request, res: Response): Promise<void> {
    try {
      const floorId = Number(req.body?.floor_id)
      const category = String(req.body?.priority_category ?? "")
      const reason = typeof req.body?.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim()
        : null

      if (!Number.isInteger(floorId) || !VALID_PRIORITY_CATEGORIES.has(category as PriorityCategory)) {
        res.status(400).json({ error: "INVALID_AREA", message: "Área inválida" })
        return
      }

      const block = await this.reservationRepository.blockArea(floorId, category as PriorityCategory, reason)
      this.eventHub?.publish({
        type: "area_block.created",
        floor_id: block.floor_id,
      })
      res.status(201).json(block)
    } catch (err) {
      this.handleError(err, res)
    }
  }

  async unblockArea(req: Request, res: Response): Promise<void> {
    try {
      const blockId = Number(req.params.id)
      if (!Number.isInteger(blockId)) {
        res.status(400).json({ error: "INVALID_ID", message: "ID inválido" })
        return
      }

      const updated = await this.reservationRepository.unblockArea(blockId)
      if (!updated) {
        res.status(404).json({ error: "NOT_FOUND", message: "Bloqueo no encontrado" })
        return
      }

      this.eventHub?.publish({
        type: "area_block.deleted",
      })
      res.json({ status: "unblocked" })
    } catch (err) {
      this.handleError(err, res)
    }
  }

  async blockSpace(req: Request, res: Response): Promise<void> {
    try {
      const spaceId = Number(req.body?.space_id)
      const blockDate = String(req.body?.block_date ?? "")
      const startTime = String(req.body?.start_time ?? "")
      const endTime = String(req.body?.end_time ?? "")
      const reason = typeof req.body?.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim()
        : null

      if (!Number.isInteger(spaceId) || spaceId <= 0) {
        res.status(400).json({ error: "INVALID_SPACE", message: "Espacio inválido" })
        return
      }

      if (!isIsoDate(blockDate) || !isTime(startTime) || !isTime(endTime) || endTime <= startTime) {
        res.status(400).json({ error: "INVALID_TIME_RANGE", message: "Fecha u horario inválido" })
        return
      }

      const block = await this.reservationRepository.blockSpace(spaceId, blockDate, startTime, endTime, reason)
      this.eventHub?.publish({
        type: "space_block.created",
        floor_id: block.floor_id,
        space_id: block.space_id,
        reservation_date: block.block_date,
      })
      res.status(201).json(block)
    } catch (err) {
      this.handleError(err, res)
    }
  }

  async unblockSpace(req: Request, res: Response): Promise<void> {
    try {
      const blockId = Number(req.params.id)
      if (!Number.isInteger(blockId)) {
        res.status(400).json({ error: "INVALID_ID", message: "ID inválido" })
        return
      }

      const updated = await this.reservationRepository.unblockSpace(blockId)
      if (!updated) {
        res.status(404).json({ error: "NOT_FOUND", message: "Bloqueo no encontrado" })
        return
      }

      this.eventHub?.publish({
        type: "space_block.deleted",
      })
      res.json({ status: "unblocked" })
    } catch (err) {
      this.handleError(err, res)
    }
  }

  private handleError(err: unknown, res: Response): void {
    if (err instanceof ReservationError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message })
      return
    }
    console.error("AdminController error:", err)
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
  }
}
