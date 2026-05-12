import { useEffect, useRef } from 'react'
import { subscribeReservationEvents } from '../services/reservationService'
import { getSession } from '../services/tokenStore'
import type { ReservationRealtimeEvent } from '../types/reservation'

function syncEvent(): ReservationRealtimeEvent {
  return {
    id: 0,
    type: 'sync.requested',
    timestamp: new Date().toISOString(),
  }
}

export function useReservationRealtime(
  onEvent: (event: ReservationRealtimeEvent) => void,
  enabled = true
): void {
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return

    const token = getSession()?.access_token
    if (!token) return

    let syncTimeoutId: number | null = null
    const scheduleSync = () => {
      if (syncTimeoutId !== null) window.clearTimeout(syncTimeoutId)
      syncTimeoutId = window.setTimeout(() => {
        onEventRef.current(syncEvent())
      }, 120)
    }

    const unsubscribe = subscribeReservationEvents(
      token,
      (event) => onEventRef.current(event),
      scheduleSync,
      scheduleSync
    )

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleSync()
    }
    const handleOnline = () => scheduleSync()

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      if (syncTimeoutId !== null) window.clearTimeout(syncTimeoutId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      unsubscribe()
    }
  }, [enabled])
}
