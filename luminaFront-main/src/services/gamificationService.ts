import type { MyStats } from '../types/gamification'
import type { ApiErrorResponse, ServiceResult } from '../types/reservation'
import { API_BASE_URL } from './apiConfig'
import { clearSession } from './tokenStore'

function unauthorizedResult(): ServiceResult<never> {
  clearSession()
  return { success: false, error: 'UNAUTHORIZED', unauthorized: true }
}

function isInvalidSessionResponse(response: Response): boolean {
  return response.status === 401 || response.status === 431
}

export async function fetchMyStats(token: string): Promise<ServiceResult<MyStats>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/my-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data: MyStats = await response.json()
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}
