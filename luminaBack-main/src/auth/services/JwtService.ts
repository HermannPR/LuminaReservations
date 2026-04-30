import jwt from "jsonwebtoken"
import type { JwtPayload } from "../interfaces"

const JWT_SECRET = process.env.JWT_SECRET
const JWT_ALGORITHM = (process.env.JWT_ALGORITHM ?? "HS256") as jwt.Algorithm
const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN ?? "3600", 10)

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not defined")
}

/**
 * Firma un JWT con los claims del payload.
 * `iat` se establece automáticamente por jsonwebtoken.
 * `exp = iat + JWT_EXPIRES_IN` (default 3600 segundos).
 */
export function sign(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload as object, JWT_SECRET as string, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRES_IN,
  })
}

/**
 * Verifica y decodifica un JWT.
 * Lanza un error si la firma es inválida o el token ha expirado.
 */
export function verify(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET as string, {
    algorithms: [JWT_ALGORITHM],
  }) as unknown as JwtPayload
}
