import { DbClient } from "../../shared/db"

/**
 * Registro de un rol en la tabla `roles`.
 */
export interface RoleRecord {
  id: number
  name: string
  description: string
  permissions: string
}

export class RoleRepository {
  constructor(private readonly db: DbClient) {}

  /**
   * Retorna los roles asignados a un usuario consultando `user_roles` JOIN `roles`.
   * Retorna arreglo vacío si el usuario no tiene roles asignados.
   * Valida: Requisito 3.3
   */
  async findRolesByUserId(userId: number): Promise<RoleRecord[]> {
    const result = await this.db.query<RoleRecord>(
      `SELECT r.id, r.name, r.description, r.permissions
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId]
    )
    return result.rows ?? []
  }
}
