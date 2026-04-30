import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchProfile, updateProfilePhoto } from './profileService'

const TOKEN = 'token-123'

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

describe('profileService', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loads the authenticated profile', async () => {
    const spy = mockFetch(200, { id: 1, profile_photo_url: null })

    const result = await fetchProfile(TOKEN)

    expect(result.success).toBe(true)
    expect(String(spy.mock.calls[0][0])).toContain('/auth/profile')
    expect((spy.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('updates the profile photo as a data URL', async () => {
    const spy = mockFetch(200, { id: 1, profile_photo_url: 'data:image/png;base64,AAAA' })

    await updateProfilePhoto(TOKEN, 'data:image/png;base64,AAAA')

    expect(spy.mock.calls[0][1]?.method).toBe('PATCH')
    expect(JSON.parse(spy.mock.calls[0][1]?.body as string)).toEqual({
      profile_photo_url: 'data:image/png;base64,AAAA',
    })
  })
})
