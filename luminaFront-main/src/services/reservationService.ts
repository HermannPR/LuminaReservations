import type {
  FilterValues,
  SpaceAvailability,
  ReservationRequest,
  ReservationResponse,
  RecommendationResult,
  AdminKpiOverview,
  AreaBlock,
  ParkingReservationForGuard,
  SpaceOccupancy,
  UserReservation,
  ApiErrorResponse,
  ServiceResult,
} from '../types/reservation'
import type { CheckInPayload } from '../types/gamification'
import { API_BASE_URL } from './apiConfig'
import { clearSession } from './tokenStore'

function unauthorizedResult(): ServiceResult<never> {
  clearSession()
  return { success: false, error: 'UNAUTHORIZED', unauthorized: true }
}

function isInvalidSessionResponse(response: Response): boolean {
  return response.status === 401 || response.status === 431
}

export async function fetchAvailability(
  filters: FilterValues,
  token: string
): Promise<ServiceResult<SpaceAvailability[]>> {
  try {
    const params = new URLSearchParams({
      reservation_date: filters.reservation_date,
      start_time: filters.start_time,
      end_time: filters.end_time,
    });

    if (filters.floor_id !== null) {
      params.append('floor_id', String(filters.floor_id));
    }

    if (filters.priority_category !== null) {
      params.append('priority_category', filters.priority_category);
    }

    const response = await fetch(`${API_BASE_URL}/reservations/availability?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (isInvalidSessionResponse(response)) return unauthorizedResult()

    if (!response.ok) {
      const body: ApiErrorResponse = await response.json();
      return { success: false, error: body.error, unauthorized: false };
    }

    const data: SpaceAvailability[] = await response.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false };
  }
}

export async function fetchFloorOccupancy(
  floorId: number,
  reservationDate: string,
  token: string
): Promise<ServiceResult<SpaceOccupancy[]>> {
  try {
    const params = new URLSearchParams({
      floor_id: String(floorId),
      reservation_date: reservationDate,
    })

    const response = await fetch(`${API_BASE_URL}/reservations/occupancy?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (isInvalidSessionResponse(response)) return unauthorizedResult()

    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }

    return { success: true, data: await response.json() }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function createReservation(
  request: ReservationRequest,
  token: string
): Promise<ServiceResult<ReservationResponse>> {
  try {
    const body: {
      space_id?: number | null
      reservation_date: string
      start_time: string
      end_time: string
      requiere_estacionamiento: boolean
    } = {
      reservation_date: request.reservation_date,
      start_time: request.start_time,
      end_time: request.end_time,
      requiere_estacionamiento: request.requiere_estacionamiento ?? false,
    }

    if (request.space_id !== undefined) {
      body.space_id = request.space_id
    }

    const response = await fetch(`${API_BASE_URL}/reservations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (isInvalidSessionResponse(response)) return unauthorizedResult()

    if (!response.ok) {
      const body: ApiErrorResponse = await response.json();
      return { success: false, error: body.error, unauthorized: false };
    }

    const data: ReservationResponse = await response.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false };
  }
}

export async function fetchRecommendations(
  filters: FilterValues,
  token: string
): Promise<ServiceResult<RecommendationResult>> {
  try {
    const params = new URLSearchParams({
      reservation_date: filters.reservation_date,
      start_time: filters.start_time,
      end_time: filters.end_time,
    })
    if (filters.floor_id !== null) params.set('floor_id', String(filters.floor_id))
    if (filters.priority_category !== null) params.set('priority_category', filters.priority_category)

    const response = await fetch(`${API_BASE_URL}/reservations/recommendations?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    return { success: true, data: await response.json() }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function fetchAdminOverview(
  token: string,
  date: string
): Promise<ServiceResult<AdminKpiOverview>> {
  try {
    const params = new URLSearchParams({ date })
    const response = await fetch(`${API_BASE_URL}/reservations/admin/overview?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    return { success: true, data: await response.json() }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function blockArea(
  token: string,
  payload: { floor_id: number; priority_category: string; reason: string }
): Promise<ServiceResult<AreaBlock>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/admin/area-blocks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    return { success: true, data: await response.json() }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function unblockArea(
  token: string,
  blockId: number
): Promise<ServiceResult<{ status: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/admin/area-blocks/${blockId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    return { success: true, data: await response.json() }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function fetchGuardParking(
  token: string,
  date: string
): Promise<ServiceResult<ParkingReservationForGuard[]>> {
  try {
    const params = new URLSearchParams({ date })
    const response = await fetch(`${API_BASE_URL}/reservations/guard/parking?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    return { success: true, data: await response.json() }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function fetchMyReservations(
  token: string,
  status?: string
): Promise<ServiceResult<UserReservation[]>> {
  try {
    const url = new URL(`${API_BASE_URL}/reservations/my`);
    if (status) url.searchParams.set('status', status);
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (isInvalidSessionResponse(response)) return unauthorizedResult();
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json();
      return { success: false, error: body.error, unauthorized: false };
    }
    const data: UserReservation[] = await response.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false };
  }
}

export async function checkInReservation(
  id: number,
  token: string
): Promise<ServiceResult<CheckInPayload>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/${id}/check-in`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data: CheckInPayload = await response.json()
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function cancelReservation(
  id: number,
  token: string
): Promise<ServiceResult<{ message: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (isInvalidSessionResponse(response)) return unauthorizedResult();
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json();
      return { success: false, error: body.error, unauthorized: false };
    }
    const data = await response.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false };
  }
}
