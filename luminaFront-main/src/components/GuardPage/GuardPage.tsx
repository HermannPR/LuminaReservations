import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../Layout/AppShell'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import { fetchGuardParking } from '../../services/reservationService'
import { getSession } from '../../services/tokenStore'
import type { ParkingReservationForGuard, PublicUserProfile } from '../../types/reservation'
import styles from './GuardPage.module.css'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function initials(user: PublicUserProfile): string {
  return `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
}

export function GuardPage(): JSX.Element {
  const navigate = useNavigate()
  const [date, setDate] = useState(today)
  const [items, setItems] = useState<ParkingReservationForGuard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const token = getSession()?.access_token

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    setLoading(true)
    setError(null)
    fetchGuardParking(token, date).then((result) => {
      setLoading(false)
      if (!result.success) {
        if (result.unauthorized) navigate('/login', { replace: true })
        else setError(result.error === 'FORBIDDEN' ? 'No tienes permisos para la vista de guardia.' : 'No se pudo cargar el estacionamiento.')
        return
      }
      setItems(result.data)
    })
  }, [date, navigate, token])

  useEffect(() => {
    if (!error) return
    const id = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(id)
  }, [error])

  const grouped = useMemo(() => {
    return items.reduce<Record<string, ParkingReservationForGuard[]>>((acc, item) => {
      const key = item.parking_zone_name
      acc[key] = acc[key] ?? []
      acc[key].push(item)
      return acc
    }, {})
  }, [items])

  return (
    <AppShell title="Guardia" subtitle="Reservas de estacionamiento del día">
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <label>
            <span>Fecha</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className={styles.countBox}>
            <span>Total</span>
            <strong>{items.length}</strong>
          </div>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        {loading ? (
          <div className={styles.loadingWrap}><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>No hay estacionamientos reservados para esta fecha.</div>
        ) : (
          <div className={styles.zoneGrid}>
            {Object.entries(grouped).map(([zone, reservations]) => (
              <section key={zone} className={styles.zonePanel}>
                <div className={styles.zoneHeader}>
                  <h3>{zone}</h3>
                  <span>{reservations.length}</span>
                </div>
                <div className={styles.list}>
                  {reservations.map((reservation) => (
                    <article key={reservation.reservation_id} className={styles.card}>
                      <div className={styles.avatar}>
                        {reservation.user.profile_photo_url ? (
                          <img src={reservation.user.profile_photo_url} alt="" />
                        ) : (
                          <span>{initials(reservation.user)}</span>
                        )}
                      </div>
                      <div className={styles.cardMain}>
                        <div className={styles.cardTop}>
                          <strong>{reservation.user.first_name} {reservation.user.last_name}</strong>
                          <span>{reservation.parking_spot_number}</span>
                        </div>
                        <div className={styles.meta}>
                          <span>{reservation.start_time} - {reservation.end_time}</span>
                          <span>{reservation.floor_name} · {reservation.space_number}</span>
                          <span>#{reservation.reservation_code}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
