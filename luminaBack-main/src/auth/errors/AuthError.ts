/**
 * Error personalizado para la capa de autenticación.
 * Incluye statusCode HTTP y un código de error estandarizado.
 */
export class AuthError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "AuthError"
    // Necesario para que instanceof funcione correctamente con clases que extienden Error en TypeScript
    Object.setPrototypeOf(this, AuthError.prototype)
  }
}
