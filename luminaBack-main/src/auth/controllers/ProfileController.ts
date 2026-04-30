import { Request, Response } from "express"
import { UserRepository } from "../repositories/UserRepository"
import type { AuthRequest } from "../../shared/auth"
import type { UserRecord } from "../interfaces"

const MAX_AVATAR_DATA_URL_LENGTH = 750_000
const DATA_URL_IMAGE_PATTERN = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/

export class ProfileController {
  constructor(private readonly userRepository: UserRepository) {}

  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = await this.userRepository.findById((req as AuthRequest).userId)
      if (!user) {
        res.status(404).json({ error: "USER_NOT_FOUND", message: "Usuario no encontrado" })
        return
      }
      res.json(this.toPublicProfile(user))
    } catch (err) {
      console.error("ProfileController.getProfile error:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const value = req.body?.profile_photo_url
      if (value !== null && value !== undefined && typeof value !== "string") {
        res.status(400).json({ error: "INVALID_PHOTO", message: "La foto debe ser una imagen válida" })
        return
      }

      if (typeof value === "string" && (value.length > MAX_AVATAR_DATA_URL_LENGTH || !DATA_URL_IMAGE_PATTERN.test(value))) {
        res.status(413).json({ error: "INVALID_PHOTO", message: "La foto debe ser PNG, JPG o WEBP y menor a 750 KB" })
        return
      }

      const user = await this.userRepository.updateProfilePhoto((req as AuthRequest).userId, value ?? null)
      if (!user) {
        res.status(404).json({ error: "USER_NOT_FOUND", message: "Usuario no encontrado" })
        return
      }
      res.json(this.toPublicProfile(user))
    } catch (err) {
      console.error("ProfileController.updateProfile error:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  private toPublicProfile(user: UserRecord) {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      employee_id: user.employee_id,
      role: user.role,
      department: user.department,
      profile_photo_url: user.profile_photo_url,
    }
  }
}
