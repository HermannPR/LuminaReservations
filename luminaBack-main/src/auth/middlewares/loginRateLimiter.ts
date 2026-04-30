import rateLimit from "express-rate-limit"

export const loginRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "RATE_LIMIT_EXCEEDED",
      message: "Too many failed login attempts. Please try again in 60 seconds.",
    })
  },
})
