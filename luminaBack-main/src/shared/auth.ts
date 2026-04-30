import { Request, Response, NextFunction } from "express"
import * as JwtService from "../auth/services/JwtService"

export type AuthRequest = Request & { userId: number; userRole: string }

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Token requerido" })
    return
  }

  try {
    const payload = JwtService.verify(authHeader.slice(7))
    ;(req as AuthRequest).userId = payload.sub
    ;(req as AuthRequest).userRole = payload.role
    next()
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Token inválido o expirado" })
  }
}

export function requireRole(allowedRoles: string[]) {
  const normalizedAllowed = allowedRoles.map((role) => role.toLowerCase())

  return (req: Request, res: Response, next: NextFunction): void => {
    const role = ((req as AuthRequest).userRole ?? "").toLowerCase()
    if (!normalizedAllowed.includes(role)) {
      res.status(403).json({ error: "FORBIDDEN", message: "No autorizado" })
      return
    }

    next()
  }
}
