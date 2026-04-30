import { Request, Response } from "express"
import { FloorRepository } from "../repositories/FloorRepository"
import { ReservationError } from "../errors"

export class FloorController {
  constructor(private readonly floorRepository: FloorRepository) {}

  async getFloors(_req: Request, res: Response): Promise<void> {
    try {
      const floors = await this.floorRepository.findAll()
      res.json(floors)
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async getFloorSpaces(req: Request, res: Response): Promise<void> {
    try {
      const floorId = parseInt(req.params.id, 10)
      if (isNaN(floorId)) {
        res.status(400).json({ error: "INVALID_ID", message: "ID de piso inválido" })
        return
      }

      const floor = await this.floorRepository.findById(floorId)
      if (!floor) {
        res.status(404).json({ error: "NOT_FOUND", message: "Piso no encontrado" })
        return
      }

      const spaces = await this.floorRepository.findSpacesByFloorId(floorId)
      res.json(spaces)
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }
}
