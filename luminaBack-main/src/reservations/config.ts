import fs from "fs"
import path from "path"
import dotenv from "dotenv"

function readRuntimeEnv(): Record<string, string> {
  try {
    const envPath = path.resolve(process.cwd(), ".env")
    if (!fs.existsSync(envPath)) return {}
    const raw = fs.readFileSync(envPath, "utf8")
    return dotenv.parse(raw)
  } catch {
    return {}
  }
}

export function getCheckInWindowOverrideMinutes(): number | null {
  const runtimeEnv = readRuntimeEnv()
  const rawValue = runtimeEnv.CHECK_IN_WINDOW_OVERRIDE_MINUTES ?? process.env.CHECK_IN_WINDOW_OVERRIDE_MINUTES
  const parsed = Number(rawValue)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

export function getAllowedCheckInCidrs(): string[] {
  const runtimeEnv = readRuntimeEnv()
  const rawValue = runtimeEnv.CHECK_IN_ALLOWED_CIDRS ?? process.env.CHECK_IN_ALLOWED_CIDRS ?? ""

  return rawValue
    .split(",")
    .map((cidr) => cidr.trim())
    .filter(Boolean)
}
