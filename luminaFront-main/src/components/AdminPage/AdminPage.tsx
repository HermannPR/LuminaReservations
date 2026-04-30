import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../Layout/AppShell'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import { fetchFloors } from '../../services/floorService'
import { blockArea, fetchAdminOverview, unblockArea } from '../../services/reservationService'
import { getSession } from '../../services/tokenStore'
import type { AdminKpiOverview, PriorityCategory } from '../../types/reservation'
import type { FloorSummary } from '../../types/floor'
import { PRIORITY_CATEGORY_LABELS } from '../../data/floorLayouts'
import styles from './AdminPage.module.css'

const CATEGORIES: PriorityCategory[] = ['escritorio', 'colaborativo', 'work_lab', 'phone_booth', 'garage']

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
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
      { label: 'Reservas del día', value: overview.total_reservations.toString(), detail: `${overview.active_reservations} en uso` },
      { label: 'Ocupación', value: percent(overview.occupancy_rate), detail: `${overview.occupied_spaces}/${overview.total_spaces} espacios` },
      { label: 'Estacionamiento', value: overview.parking_reservations.toString(), detail: 'Reservas con cajón' },
      { label: 'Usuarios únicos', value: overview.unique_users.toString(), detail: 'Personas con reserva' },
    ]
  }, [overview])

  async function refresh() {
    if (!token) return
    const result = await fetchAdminOverview(token, date)
    if (result.success) setOverview(result.data)
  }

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
                        <span style={{ width: percent(floor.occupancy_rate) }} />
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
                        <span style={{ width: percent(category.occupancy_rate) }} />
                      </div>
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
