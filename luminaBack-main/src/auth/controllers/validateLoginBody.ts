import { AuthError } from "../errors/AuthError"

// RFC 5322 básico: local@domain.tld
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Valida el body de la solicitud de login.
 * Lanza AuthError si falta algún campo o el formato es inválido.
 */
export function validateLoginBody(body: unknown): { email: string; password: string } {
  const b = body as Record<string, unknown>

  const email = b?.email
  const password = b?.password

  // 1. Campos faltantes (undefined, null o string vacío)
  if (!email || !password) {
    throw new AuthError(400, "MISSING_FIELDS", "Los campos email y password son requeridos")
  }

  const emailStr = String(email)
  const passwordStr = String(password)

  // 2. Formato de email inválido
  if (!EMAIL_REGEX.test(emailStr)) {
    throw new AuthError(422, "VALIDATION_ERROR", "El formato del email es inválido")
  }

  // 3. Password con menos de 8 caracteres
  if (passwordStr.length < 8) {
    throw new AuthError(422, "VALIDATION_ERROR", "El password debe tener al menos 8 caracteres")
  }

  return { email: emailStr, password: passwordStr }
}
