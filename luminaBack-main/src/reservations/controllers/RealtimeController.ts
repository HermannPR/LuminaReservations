import { Request, Response } from "express"
import * as JwtService from "../../auth/services/JwtService"
import { ReservationEventHub } from "../realtime/ReservationEventHub"

export class RealtimeController {
  constructor(private readonly eventHub: ReservationEventHub) {}

  stream(req: Request, res: Response): void {
    const token = typeof req.query.token === "string" ? req.query.token : ""

    if (!token) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Token requerido" })
      return
    }

    try {
      JwtService.verify(token)
      this.eventHub.subscribe(res)
    } catch {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Token inválido o expirado" })
    }
  }
}
