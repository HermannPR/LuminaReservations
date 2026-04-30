import { Request, Response, NextFunction } from "express"

/**
 * Middleware que verifica que el header `Content-Type` sea `application/json`.
 * Si no cumple, retorna HTTP 415 con código de error `UNSUPPORTED_MEDIA_TYPE`.
 */
export function contentTypeGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.is("application/json")) {
    next()
    return
  }

  res.status(415).json({
    error: "UNSUPPORTED_MEDIA_TYPE",
    message: "Content-Type must be application/json",
  })
}
