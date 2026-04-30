import bcrypt from "bcrypt"
import { AuthResult } from "../interfaces"
import { AuthError } from "../errors/AuthError"
import { UserRepository } from "../repositories/UserRepository"
import { RoleRepository } from "../repositories/RoleRepository"
import * as JwtService from "./JwtService"

/**
 * Hash bcrypt pre-computado para mitigación de timing attacks.
 * Se usa cuando el usuario no existe, para que el tiempo de respuesta
 * sea similar al caso en que sí existe (evita inferir existencia de email).
 * Valida: Requisitos 3.4, 3.5
 */
const DUMMY_HASH =
  "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345"

const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN ?? "3600", 10)

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly jwtService: typeof JwtService
  ) {}

  /**
   * Autentica un usuario con email y password.
   * Flujo:
   *  1. Buscar usuario por email; si no existe, ejecutar bcrypt dummy y lanzar 401.
   *  2. Verificar is_active (fail-fast antes de bcrypt real).
   *  3. Comparar password con hash almacenado; si no coincide, lanzar 401.
   *  4. Verificar que el usuario tenga al menos un rol asignado; si no, lanzar 403.
   *  5. Firmar JWT y construir AuthResult.
   *  6. Disparar updateTimestamp sin await (fire-and-forget).
   *
   * Valida: Requisitos 1.2, 1.3, 1.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.1, 6.2
   */
  async authenticate(email: string, password: string): Promise<AuthResult> {
    // Paso 1: buscar usuario por email
    const user = await this.userRepository.findByEmail(email)

    if (!user) {
      // Timing attack mitigation: ejecutar bcrypt aunque el usuario no exista
      await bcrypt.compare(password, DUMMY_HASH)
      throw new AuthError(401, "INVALID_CREDENTIALS", "Credenciales inválidas")
    }

    // Paso 2: verificar cuenta activa (fail-fast antes del cómputo bcrypt)
    if (!user.is_active) {
      throw new AuthError(403, "ACCOUNT_INACTIVE", "La cuenta está inactiva")
    }

    // Paso 3: verificar password
    const passwordValid = await bcrypt.compare(password, user.password_hash)
    if (!passwordValid) {
      throw new AuthError(401, "INVALID_CREDENTIALS", "Credenciales inválidas")
    }

    // Paso 4: verificar roles asignados
    const roles = await this.roleRepository.findRolesByUserId(user.id)
    if (roles.length === 0) {
      throw new AuthError(403, "NO_ROLES_ASSIGNED", "El usuario no tiene roles asignados")
    }

    // Paso 5: firmar JWT y construir AuthResult
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      employee_id: user.employee_id,
      role: user.role,
      department: user.department,
    })

    const result: AuthResult = {
      access_token: token,
      token_type: "Bearer",
      expires_in: JWT_EXPIRES_IN,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        employee_id: user.employee_id,
        role: user.role,
        department: user.department,
        profile_photo_url: user.profile_photo_url,
      },
    }

    // Paso 6: fire-and-forget — no bloquea la respuesta
    this.userRepository.updateTimestamp(user.id)

    return result
  }
}
