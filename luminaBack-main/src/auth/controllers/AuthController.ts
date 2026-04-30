import { Request, Response } from "express"
import { AuthService } from "../services/AuthService"
import { AuthError } from "../errors/AuthError"
import { validateLoginBody } from "./validateLoginBody"

/**
 * Controller de autenticación.
 * Orquesta validación de esquema, delegación al servicio y serialización de respuesta.
 * Nunca incluye password_hash, updated_at ni campos internos en ninguna respuesta.
 *
 * Valida: Requisitos 1.2, 1.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4
 */
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Extrae la IP del cliente desde los headers o req.ip.
   * Nunca registra password ni password_hash.
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"]
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0].trim()
    }
    return req.ip ?? "unknown"
  }

  /**
   * POST /auth/login
   * 1. Valida esquema del body → 400/422 si falla
   * 2. Delega a AuthService.authenticate → 401/403 si falla
   * 3. Responde HTTP 200 con AuthResult en caso exitoso
   * 4. Cualquier error no controlado → HTTP 500 con mensaje genérico
   * 5. Registra cada intento con timestamp, IP, email, employee_id, resultado y error_code
   *    NUNCA registra password ni password_hash (Requisito 4.4)
   */
  async login(req: Request, res: Response): Promise<void> {
    const ip = this.getClientIp(req)
    const email: string | undefined = typeof req.body?.email === "string" ? req.body.email : undefined

    try {
      // Paso 1: validar esquema del body
      const { email: validatedEmail, password } = validateLoginBody(req.body)

      // Paso 2: delegar autenticación al servicio
      const result = await this.authService.authenticate(validatedEmail, password)

      // Paso 5 (éxito): registrar intento exitoso — sin password ni password_hash
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        ip,
        email: validatedEmail,
        employee_id: result.user.employee_id,
        result: "success",
        error_code: null,
      }))

      // Paso 3: respuesta exitosa — AuthResult ya excluye campos internos por diseño
      res.status(200).json(result)
    } catch (err) {
      if (err instanceof AuthError) {
        // Paso 5 (fallo controlado): registrar intento fallido — sin password ni password_hash
        console.warn(JSON.stringify({
          timestamp: new Date().toISOString(),
          ip,
          email: email ?? null,
          employee_id: null,
          result: "failure",
          error_code: err.code,
        }))

        res.status(err.statusCode).json({
          error: err.code,
          message: err.message,
        })
        return
      }

      // Paso 5 (error no controlado): registrar con warn
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        ip,
        email: email ?? null,
        employee_id: null,
        result: "failure",
        error_code: "INTERNAL_ERROR",
      }))

      // Paso 4: error no controlado — loguear detalle internamente, nunca exponer al cliente
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Ha ocurrido un error interno. Por favor intente más tarde.",
      })
    }
  }
}
