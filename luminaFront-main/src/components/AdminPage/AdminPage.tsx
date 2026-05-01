import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../Layout/AppShell'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import { fetchFloors } from '../../services/floorService'
import { blockArea, fetchAdminOverview, unblockArea } from '../../services/reservationService'
import { getSession } from '../../services/tokenStore'
import { useReservationRealtime } from '../../hooks/useReservationRealtime'
import type { AdminKpiOverview, PriorityCategory } from '../../types/reservation'
import type { FloorSummary } from '../../types/floor'
import { PRIORITY_CATEGORY_LABELS } from '../../data/floorLayouts'
import styles from './AdminPage.module.css'

const CATEGORIES: PriorityCategory[] = ['escritorio', 'colaborativo', 'work_lab', 'phone_booth', 'garage']
const STATUS_LABELS: Record<AdminKpiOverview['status_breakdown'][number]['status'], string> = {
  confirmada: 'Confirmadas',
  activa: 'En uso',
  cancelada: 'Canceladas',
  no_show: 'No show',
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function safeBarWidth(value: number): string {
  return `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function AdminPage(): JSX.Element {
  const navigate = useNavigate()
  const [date, setDate] = useState(today)
  const [overview, setOverview] = useState<AdminKpiOverview | null>(null)
  const [floors, setFloors] = useState<FloorSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState<{ floor_id: number | ''; priority_category: PriorityCategory; reason: string }>({
    floor_id: '',
    priority_category: 'escritorio',
    reason: '',
  })

  const token = getSession()?.access_token

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    setLoading(true)
    setError(null)
    Promise.all([fetchAdminOverview(token, date), fetchFloors(token)]).then(([overviewResult, floorsResult]) => {
      setLoading(false)
      if (!overviewResult.success) {
        if (overviewResult.unauthorized) navigate('/login', { replace: true })
        else setError(overviewResult.error === 'FORBIDDEN' ? 'No tienes permisos de administrador.' : 'No se pudieron cargar los KPIs.')
        return
      }
      setOverview(overviewResult.data)

      if (floorsResult.success) {
        setFloors(floorsResult.data)
        setForm((prev) => ({
          ...prev,
          floor_id: prev.floor_id || floorsResult.data[0]?.id || '',
        }))
      }
    })
  }, [date, navigate, token])

  useEffect(() => {
    if (!error) return
    const id = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(id)
  }, [error])

  useEffect(() => {
    if (!message) return
    const id = window.setTimeout(() => setMessage(null), 5000)
    return () => window.clearTimeout(id)
  }, [message])

  const kpis = useMemo(() => {
    if (!overview) return []
    return [
      { label: 'Reservas del día', value: overview.total_reservations.toString(), detail: `${overview.confirmed_reservations} confirmadas` },
      { label: 'Ocupación', value: percent(overview.occupancy_rate), detail: `${overview.occupied_spaces}/${overview.total_spaces} espacios` },
      { label: 'En uso ahora', value: overview.active_reservations.toString(), detail: 'Check-ins activos' },
      { label: 'Estacionamiento', value: percent(overview.parking_rate), detail: `${overview.parking_reservations} cajones reservados` },
      { label: 'Usuarios únicos', value: overview.unique_users.toString(), detail: 'Personas con reserva' },
      { label: 'Bloqueos activos', value: overview.blocked_area_count.toString(), detail: 'Áreas no disponibles' },
      { label: 'Cancelaciones', value: overview.cancelled_reservations.toString(), detail: 'Reservas canceladas' },
      { label: 'No show', value: overview.no_show_reservations.toString(), detail: 'Reservas vencidas' },
    ]
  }, [overview])

  const statusTotal = useMemo(() => (
    overview?.status_breakdown.reduce((sum, item) => sum + item.count, 0) ?? 0
  ), [overview])

  const hourlyMax = useMemo(() => (
    Math.max(1, ...(overview?.hourly_distribution.map((item) => item.reservations) ?? [0]))
  ), [overview])

  const peakHour = useMemo(() => {
    if (!overview || overview.hourly_distribution.length === 0) return null
    return overview.hourly_distribution.reduce((peak, item) => (
      item.reservations > peak.reservations ? item : peak
    ), overview.hourly_distribution[0])
  }, [overview])

  const busiestFloor = useMemo(() => {
    if (!overview || overview.by_floor.length === 0) return null
    return overview.by_floor.reduce((peak, item) => (
      item.occupancy_rate > peak.occupancy_rate ? item : peak
    ), overview.by_floor[0])
  }, [overview])

  async function refresh() {
    if (!token) return
    const result = await fetchAdminOverview(token, date)
    if (result.success) setOverview(result.data)
  }

  useReservationRealtime((event) => {
    const isAreaEvent = event.type.startsWith('area_block.')
    if (isAreaEvent || !event.reservation_date || event.reservation_date === date) {
      void refresh()
    }
  }, Boolean(token))

  async function handleBlockArea() {
    if (!token || typeof form.floor_id !== 'number') return
    setSaving(true)
    setError(null)
    setMessage(null)
    const result = await blockArea(token, {
      floor_id: form.floor_id,
      priority_category: form.priority_category,
      reason: form.reason.trim(),
    })
    setSaving(false)
    if (!result.success) {
      if (result.unauthorized) navigate('/login', { replace: true })
      else setError('No se pudo bloquear el área.')
      return
    }
    setMessage('Área bloqueada para nuevas reservas.')
    setForm((prev) => ({ ...prev, reason: '' }))
    await refresh()
  }

  async function handleUnblock(blockId: number) {
    if (!token) return
    setSaving(true)
    setError(null)
    setMessage(null)
    const result = await unblockArea(token, blockId)
    setSaving(false)
    if (!result.success) {
      if (result.unauthorized) navigate('/login', { replace: true })
      else setError('No se pudo liberar el área.')
      return
    }
    setMessage('Área disponible de nuevo.')
    await refresh()
  }

  return (
    <AppShell title="Administración" subtitle="KPIs operativos y bloqueo de áreas">
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <label>
            <span>Fecha</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}
        {message && <div className={styles.successMsg}>{message}</div>}

        {loading ? (
          <div className={styles.loadingWrap}><LoadingSpinner /></div>
        ) : overview ? (
          <>
            <section className={styles.kpiGrid}>
              {kpis.map((kpi) => (
                <article key={kpi.label} className={styles.kpiCard}>
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                  <small>{kpi.detail}</small>
                </article>
              ))}
            </section>

            <section className={styles.insightGrid}>
              <article className={`${styles.panel} ${styles.gaugePanel}`}>
                <div className={styles.panelHeader}>
                  <h3>Salud operativa</h3>
                </div>
                <div className={styles.gaugeList}>
                  <div className={styles.gaugeItem}>
                    <div
                      className={styles.gaugeRing}
                      style={{ '--value': safeBarWidth(overview.occupancy_rate) } as CSSProperties}
                    >
                      <span>{percent(overview.occupancy_rate)}</span>
                    </div>
                    <div>
                      <strong>Ocupación total</strong>
                      <small>{overview.occupied_spaces} espacios ocupados de {overview.total_spaces}</small>
                    </div>
                  </div>
                  <div className={styles.gaugeItem}>
                    <div
                      className={`${styles.gaugeRing} ${styles.gaugeRingAlt}`}
                      style={{ '--value': safeBarWidth(overview.parking_rate) } as CSSProperties}
                    >
                      <span>{percent(overview.parking_rate)}</span>
                    </div>
                    <div>
                      <strong>Uso de estacionamiento</strong>
                      <small>{overview.parking_reservations} reservas con cajón asignado</small>
                    </div>
                  </div>
                </div>
                <div className={styles.insightStrip}>
                  <span>Pico: {peakHour ? `${peakHour.hour} · ${peakHour.reservations}` : 'sin datos'}</span>
                  <span>Piso más activo: {busiestFloor ? busiestFloor.floor_name : 'sin datos'}</span>
                </div>
              </article>

              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h3>Estado de reservas</h3>
                </div>
                <div className={styles.statusList}>
                  {overview.status_breakdown.length === 0 ? (
                    <p className={styles.emptyState}>Sin reservas para esta fecha.</p>
                  ) : overview.status_breakdown.map((item) => {
                    const ratio = statusTotal > 0 ? item.count / statusTotal : 0
                    return (
                      <div key={item.status} className={styles.statusRow}>
                        <div className={styles.statusMeta}>
                          <span>{STATUS_LABELS[item.status] ?? item.status}</span>
                          <strong>{item.count}</strong>
                        </div>
                        <div className={styles.statusTrack}>
                          <span className={styles[`status_${item.status}`]} style={{ width: safeBarWidth(ratio) }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            </section>

            <section className={styles.panelGrid}>
              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h3>Ocupación por piso</h3>
                </div>
                <div className={styles.barList}>
                  {overview.by_floor.map((floor) => (
                    <div key={floor.floor_id} className={styles.barRow}>
                      <div className={styles.barMeta}>
                        <span>{floor.floor_name}</span>
                        <strong>{percent(floor.occupancy_rate)}</strong>
                      </div>
                      <div className={styles.barTrack}>
                        <span style={{ width: safeBarWidth(floor.occupancy_rate) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h3>Ocupación por tipo</h3>
                </div>
                <div className={styles.barList}>
                  {overview.by_category.map((category) => (
                    <div key={category.priority_category} className={styles.barRow}>
                      <div className={styles.barMeta}>
                        <span>{PRIORITY_CATEGORY_LABELS[category.priority_category] ?? category.priority_category}</span>
                        <strong>{percent(category.occupancy_rate)}</strong>
                      </div>
                      <div className={styles.barTrack}>
                        <span style={{ width: safeBarWidth(category.occupancy_rate) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className={styles.panelGrid}>
              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h3>Demanda por hora</h3>
                </div>
                {overview.hourly_distribution.length === 0 ? (
                  <p className={styles.emptyState}>Sin reservas confirmadas para graficar.</p>
                ) : (
                  <div className={styles.hourChart}>
                    {overview.hourly_distribution.map((item) => (
                      <div key={item.hour} className={styles.hourColumn}>
                        <div className={styles.hourBarWrap}>
                          <span style={{ height: `${Math.max(8, Math.round((item.reservations / hourlyMax) * 100))}%` }} />
                        </div>
                        <strong>{item.reservations}</strong>
                        <small>{item.hour}</small>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h3>Usuarios con más actividad</h3>
                </div>
                <div className={styles.topUserList}>
                  {overview.top_users.length === 0 ? (
                    <p className={styles.emptyState}>Sin usuarios con reserva activa.</p>
                  ) : overview.top_users.map((user, index) => (
                    <div key={user.user_id} className={styles.topUserItem}>
                      <span className={styles.rank}>{index + 1}</span>
                      <span className={styles.avatar}>{initials(user.first_name, user.last_name)}</span>
                      <div>
                        <strong>{user.first_name} {user.last_name}</strong>
                        <small>{user.email}</small>
                      </div>
                      <b>{user.reservations}</b>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className={styles.blockPanel}>
              <div className={styles.panelHeader}>
                <h3>Bloquear área</h3>
              </div>
              <div className={styles.blockForm}>
                <label>
                  <span>Piso</span>
                  <select
                    value={form.floor_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, floor_id: Number(event.target.value) }))}
                  >
                    {floors.map((floor) => (
                      <option key={floor.id} value={floor.id}>{floor.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Tipo</span>
                  <select
                    value={form.priority_category}
                    onChange={(event) => setForm((prev) => ({ ...prev, priority_category: event.target.value as PriorityCategory }))}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>{PRIORITY_CATEGORY_LABELS[category]}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.reasonField}>
                  <span>Motivo</span>
                  <input
                    value={form.reason}
                    onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                    placeholder="Mantenimiento, evento, remodelación"
                  />
                </label>
                <button type="button" onClick={handleBlockArea} disabled={saving || typeof form.floor_id !== 'number'}>
                  {saving ? 'Guardando...' : 'Bloquear'}
                </button>
              </div>

              <div className={styles.blockList}>
                {overview.blocked_areas.length === 0 ? (
                  <p>No hay áreas bloqueadas.</p>
                ) : overview.blocked_areas.map((block) => (
                  <div key={block.id} className={styles.blockItem}>
                    <div>
                      <strong>{block.floor_name} · {PRIORITY_CATEGORY_LABELS[block.priority_category] ?? block.priority_category}</strong>
                      <span>{block.reason || 'Sin motivo registrado'}</span>
                    </div>
                    <button type="button" onClick={() => void handleUnblock(block.id)} disabled={saving}>
                      Liberar
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
