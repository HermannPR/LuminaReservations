import { Request, Response } from "express"
import { ReservationService } from "../services/ReservationService"
import { ReservationError } from "../errors"
import type { AuthRequest } from "../../shared/auth"

const MAX_MESSAGE_LENGTH = 700

export class ReservationAssistantController {
  constructor(private readonly reservationService: ReservationService) {}

  async ask(req: Request, res: Response): Promise<void> {
    try {
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : ""
      if (!message) {
        res.status(400).json({ error: "MISSING_MESSAGE", message: "El mensaje es requerido" })
        return
      }

      if (message.length > MAX_MESSAGE_LENGTH) {
        res.status(413).json({ error: "MESSAGE_TOO_LONG", message: "El mensaje es demasiado largo" })
        return
      }

      const authReq = req as AuthRequest
      const answer = await this.reservationService.answerAssistantQuestion(
        message,
        authReq.userId,
        authReq.userRole ?? ""
      )

      res.json(answer)
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }

      console.error("ReservationAssistantController error:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }
}
