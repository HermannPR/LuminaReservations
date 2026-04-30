import { describe, expect, it, vi } from "vitest"
import type { Request, Response } from "express"
import { ProfileController } from "./ProfileController"
import type { UserRepository } from "../repositories/UserRepository"

type TestResponse = Response & {
  statusCodeValue: number
  body: unknown
}

function makeResponse(): TestResponse {
  const response: Partial<TestResponse> = {
    statusCodeValue: 200,
    body: undefined as unknown,
  }
  response.status = (code: number) => {
    response.statusCodeValue = code
    return response as TestResponse
  }
  response.json = (payload: unknown) => {
    response.body = payload
    return response as TestResponse
  }
  return response as TestResponse
}

const user = {
  id: 7,
  email: "ada@example.com",
  password_hash: "hash",
  first_name: "Ada",
  last_name: "Lovelace",
  employee_id: "E-7",
  role: "employee",
  department: "Engineering",
  profile_photo_url: null,
  created_at: new Date(),
  updated_at: new Date(),
}

describe("ProfileController", () => {
  it("returns the authenticated user profile without password data", async () => {
    const repository = { findById: vi.fn().mockResolvedValue(user) } as unknown as UserRepository
    const response = makeResponse()

    await new ProfileController(repository).getProfile({ userId: 7 } as Request & { userId: number }, response)

    expect(response.statusCodeValue).toBe(200)
    expect(response.body).toMatchObject({
      id: 7,
      email: "ada@example.com",
      profile_photo_url: null,
    })
    expect(JSON.stringify(response.body)).not.toContain("password_hash")
  })

  it("rejects profile photos that are not image data URLs", async () => {
    const repository = { updateProfilePhoto: vi.fn() } as unknown as UserRepository
    const response = makeResponse()

    await new ProfileController(repository).updateProfile({
      userId: 7,
      body: { profile_photo_url: "https://example.com/avatar.png" },
    } as Request & { userId: number }, response)

    expect(response.statusCodeValue).toBe(413)
    expect(repository.updateProfilePhoto).not.toHaveBeenCalled()
  })
})
