/**
 * Registro completo del usuario en la tabla `users`.
 * Solo para uso interno — nunca serializar en respuestas HTTP.
 */
export interface UserRecord {
  id: number
  email: string
  password_hash: string
  first_name: string
  last_name: string
  employee_id: string
  role: string
  department: string
  profile_photo_url: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

/**
 * Perfil público del usuario incluido en la respuesta exitosa.
 * No contiene campos sensibles como password_hash.
 */
export interface UserPublicProfile {
  id: number
  email: string
  first_name: string
  last_name: string
  employee_id: string
  role: string
  department: string
  profile_photo_url: string | null
}

/**
 * Estructura de la respuesta HTTP 200 en login exitoso.
 */
export interface LoginSuccessResponse {
  access_token: string
  token_type: "Bearer"
  expires_in: number
  user: UserPublicProfile
}

/**
 * Estructura de respuesta de error para cualquier código HTTP de error.
 */
export interface ErrorResponse {
  error: string
  message: string
}

/**
 * Payload del JWT firmado.
 */
export interface JwtPayload {
  sub: number
  email: string
  first_name: string
  last_name: string
  employee_id: string
  role: string
  department: string
  iat: number
  exp: number
}

/**
 * Resultado retornado por AuthService.authenticate en caso exitoso.
 */
export interface AuthResult {
  access_token: string
  token_type: "Bearer"
  expires_in: number
  user: UserPublicProfile
}
