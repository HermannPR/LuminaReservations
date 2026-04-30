export const PARKING_LEAD_TIME_MS = 24 * 60 * 60 * 1000

export function isParkingEligible(date: string, startTime: string, nowMs = Date.now()): boolean {
  if (!date || !startTime) return false

  const reservationStart = new Date(`${date}T${startTime}:00`).getTime()
  if (Number.isNaN(reservationStart)) return false

  return reservationStart - nowMs >= PARKING_LEAD_TIME_MS
}
