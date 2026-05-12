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
      const lastEventHeader = req.headers["last-event-id"]
      const lastEventId = typeof lastEventHeader === "string"
        ? Number(lastEventHeader)
        : undefined
      this.eventHub.subscribe(res, Number.isInteger(lastEventId) ? lastEventId : undefined)
    } catch {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Token inválido o expirado" })
    }
  }
}
