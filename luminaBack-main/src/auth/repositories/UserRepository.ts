import { UserRecord } from "../interfaces"
import { DbClient } from "../../shared/db"

export class UserRepository {
  constructor(private readonly db: DbClient) {}

  /**
   * Busca un usuario por email en la tabla `users`.
   * Retorna el registro completo o null si no existe.
   * Valida: Requisito 3.1
   */
  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.db.query<UserRecord>(
      "SELECT id, email, password_hash, first_name, last_name, employee_id, role, department, profile_photo_url, is_active, created_at, updated_at FROM users WHERE email = $1",
      [email]
    )
    return result.rows[0] ?? null
  }

  async findById(userId: number): Promise<UserRecord | null> {
    const result = await this.db.query<UserRecord>(
      "SELECT id, email, password_hash, first_name, last_name, employee_id, role, department, profile_photo_url, is_active, created_at, updated_at FROM users WHERE id = $1",
      [userId]
    )
    return result.rows[0] ?? null
  }

  async updateProfilePhoto(userId: number, profilePhotoUrl: string | null): Promise<UserRecord | null> {
    const result = await this.db.query<UserRecord>(
      `UPDATE users
       SET profile_photo_url = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, password_hash, first_name, last_name, employee_id, role, department, profile_photo_url, is_active, created_at, updated_at`,
      [userId, profilePhotoUrl]
    )
    return result.rows[0] ?? null
  }

  /**
   * Actualiza el campo `updated_at` del usuario dado su id.
   * Valida: Requisito 6.1
   */
  async updateTimestamp(userId: number): Promise<void> {
    await this.db.query(
      "UPDATE users SET updated_at = NOW() WHERE id = $1",
      [userId]
    )
  }
}
