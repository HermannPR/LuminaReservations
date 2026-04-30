import type { UserData } from '../types/auth'
import type { ApiErrorResponse, ServiceResult } from '../types/reservation'
import { API_BASE_URL } from './apiConfig'
import { clearSession } from './tokenStore'

async function parseError(response: Response): Promise<ServiceResult<never>> {
  if (response.status === 401 || response.status === 431) {
    clearSession()
    return { success: false, error: 'UNAUTHORIZED', unauthorized: true }
  }
  const body: ApiErrorResponse = await response.json().catch(() => ({ error: 'UNKNOWN_ERROR', message: '' }))
  return { success: false, error: body.error, unauthorized: false }
}

export async function fetchProfile(token: string): Promise<ServiceResult<UserData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return parseError(response)
    return { success: true, data: await response.json() }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function updateProfilePhoto(token: string, profilePhotoUrl: string | null): Promise<ServiceResult<UserData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ profile_photo_url: profilePhotoUrl }),
    })
    if (!response.ok) return parseError(response)
    return { success: true, data: await response.json() }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}
