import type { FloorSummary, SpaceWithLayout } from '../types/floor'
import type { ServiceResult } from '../types/reservation'
import { API_BASE_URL } from './apiConfig'
import { clearSession } from './tokenStore'
import { isDemoMode, demoFloors, demoFloorSpaces } from './demo'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function unauthorizedResult(): ServiceResult<never> {
  clearSession()
  return { success: false, error: 'UNAUTHORIZED', unauthorized: true }
}

function isInvalidSessionResponse(response: Response): boolean {
  return response.status === 401 || response.status === 431
}

export async function fetchFloors(token: string): Promise<ServiceResult<FloorSummary[]>> {
  if (isDemoMode()) return { success: true, data: demoFloors() }
  try {
    const res = await fetch(`${API_BASE_URL}/reservations/floors`, { headers: authHeaders(token) })
    if (isInvalidSessionResponse(res)) return unauthorizedResult()
    if (!res.ok) {
      const b = await res.json()
      return { success: false, error: b.error, unauthorized: false }
    }
    return { success: true, data: await res.json() }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function fetchFloorSpaces(floorId: number, token: string): Promise<ServiceResult<SpaceWithLayout[]>> {
  if (isDemoMode()) return { success: true, data: demoFloorSpaces(floorId) }
  try {
    const res = await fetch(`${API_BASE_URL}/reservations/floors/${floorId}/spaces`, {
      headers: authHeaders(token),
    })
    if (isInvalidSessionResponse(res)) return unauthorizedResult()
    if (!res.ok) {
      const b = await res.json()
      return { success: false, error: b.error, unauthorized: false }
    }
    return { success: true, data: await res.json() }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}
