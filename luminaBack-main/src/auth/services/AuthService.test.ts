import bcrypt from "bcrypt"
import { describe, expect, it, vi } from "vitest"
import { AuthService } from "./AuthService"
import type { RoleRepository } from "../repositories/RoleRepository"
import type { UserRepository } from "../repositories/UserRepository"
import type { UserRecord } from "../interfaces"

const user: UserRecord = {
  id: 4,
  email: "admin@lumina.com",
  password_hash: "",
  first_name: "Admin",
  last_name: "User",
  employee_id: "EMP-999",
  role: "admin",
  department: "IT",
  profile_photo_url: `data:image/jpeg;base64,${"A".repeat(15_000)}`,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
}

describe("AuthService", () => {
  it("does not put profile photos in the JWT payload", async () => {
    const passwordHash = await bcrypt.hash("password123", 4)
    const userRepository = {
      findByEmail: vi.fn().mockResolvedValue({ ...user, password_hash: passwordHash }),
      updateTimestamp: vi.fn(),
    } as unknown as UserRepository
    const roleRepository = {
      findRolesByUserId: vi.fn().mockResolvedValue([{ id: 1, name: "admin" }]),
    } as unknown as RoleRepository
    const jwtService = {
      sign: vi.fn().mockReturnValue("compact-token"),
    }

    const result = await new AuthService(userRepository, roleRepository, jwtService as never)
      .authenticate("admin@lumina.com", "password123")

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.not.objectContaining({ profile_photo_url: expect.any(String) })
    )
    expect(result.access_token).toBe("compact-token")
    expect(result.user.profile_photo_url).toBe(user.profile_photo_url)
  })
})
