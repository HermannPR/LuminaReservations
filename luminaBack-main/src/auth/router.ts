import { Router } from "express"
import { Pool } from "pg"
import { UserRepository } from "./repositories/UserRepository"
import { RoleRepository } from "./repositories/RoleRepository"
import { AuthService } from "./services/AuthService"
import { AuthController } from "./controllers/AuthController"
import { ProfileController } from "./controllers/ProfileController"
import * as JwtService from "./services/JwtService"
import { contentTypeGuard } from "./middlewares/contentTypeGuard"
import { loginRateLimiter } from "./middlewares/loginRateLimiter"
import { requireAuth } from "../shared/auth"

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

const userRepository = new UserRepository(db)
const roleRepository = new RoleRepository(db)
const authService = new AuthService(userRepository, roleRepository, JwtService)
const authController = new AuthController(authService)
const profileController = new ProfileController(userRepository)

export const authRouter = Router()

authRouter.post(
  "/login",
  contentTypeGuard,
  loginRateLimiter,
  (req, res) => authController.login(req, res)
)

authRouter.get("/profile", requireAuth, (req, res) => profileController.getProfile(req, res))
authRouter.patch("/profile", requireAuth, (req, res) => profileController.updateProfile(req, res))
