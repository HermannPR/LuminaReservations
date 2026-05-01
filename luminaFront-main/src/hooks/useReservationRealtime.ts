import { useEffect, useRef } from 'react'
import { subscribeReservationEvents } from '../services/reservationService'
import { getSession } from '../services/tokenStore'
import type { ReservationRealtimeEvent } from '../types/reservation'

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

    return subscribeReservationEvents(token, (event) => {
      onEventRef.current(event)
    })
  }, [enabled])
}
