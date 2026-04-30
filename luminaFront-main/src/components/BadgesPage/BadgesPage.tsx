import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BadgeWithStatus, StreakInfo } from '../../types/gamification'
import { fetchMyStats } from '../../services/gamificationService'
import { getSession } from '../../services/tokenStore'
import { useCountUp } from '../../hooks/useCountUp'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import AppShell from '../Layout/AppShell'
import styles from './BadgesPage.module.css'

const TIER_LABEL: Record<number, string> = {
  1: 'Primeros Pasos',
  2: 'Constancia',
  3: 'Explorador',
  4: 'Veterano',
  5: 'Legendario',
}

function formatEarnedDate(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function BadgesPage(): JSX.Element {
  const navigate = useNavigate()
  const [streak, setStreak] = useState<StreakInfo | null>(null)
  const [badges, setBadges] = useState<BadgeWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = getSession()?.access_token
    if (!token) { navigate('/login', { replace: true }); return }

    fetchMyStats(token).then((result) => {
      setLoading(false)
      if (!result.success) {
        if (result.unauthorized) { navigate('/login', { replace: true }); return }
        setError('No se pudieron cargar los logros.')
        return
      }
      setStreak(result.data.streak)
      setBadges(result.data.badges)
    })
  }, [navigate])

  useEffect(() => {
    if (!error) return
    const timeoutId = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [error])

  const tiers = [1, 2, 3, 4, 5]
  const earnedCount = badges.filter((b) => b.earned_at !== null).length
  const animatedStreak  = useCountUp(streak?.current_streak ?? 0)
  const animatedBest    = useCountUp(streak?.longest_streak ?? 0)
  const animatedEarned  = useCountUp(earnedCount)

  return (
    <AppShell title="Logros" subtitle="Tus insignias y racha de asistencia">
      <div className={styles.wrapper}>

        {loading ? (
          <div className={styles.loadingWrap}><LoadingSpinner /></div>
        ) : error ? (
          <p className={styles.errorMsg}>{error}</p>
        ) : (
          <>
            {/* ── Stats bar ─────────────────────────── */}
            <div className={styles.statsBar}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>
                  {animatedStreak}
                  {(streak?.current_streak ?? 0) > 5 ? ' 🔥' : ''}
                </span>
                <span className={styles.statLabel}>Racha actual</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.statItem}>
                <span className={styles.statValue}>{animatedBest}</span>
                <span className={styles.statLabel}>Mejor racha</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.statItem}>
                <span className={styles.statValue}>{animatedEarned}</span>
                <span className={styles.statLabel}>de {badges.length} logros</span>
              </div>
            </div>

            {/* ── Badge tiers ───────────────────────── */}
            {tiers.map((tier) => {
              const tierBadges = badges.filter((b) => b.tier === tier)
              if (tierBadges.length === 0) return null
              const tierEarned = tierBadges.filter((b) => b.earned_at !== null).length

              return (
                <div key={tier} className={styles.tierSection}>
                  <div className={styles.tierHeader}>
                    <span className={`${styles.tierPill} ${styles[`tierPill${tier}`]}`}>
                      TIER {tier}
                    </span>
                    <span className={styles.tierName}>{TIER_LABEL[tier]}</span>
                    <span className={styles.tierProgress}>{tierEarned}/{tierBadges.length}</span>
                  </div>

                  <div className={styles.badgeGrid}>
                    {tierBadges.map((badge) => {
                      const earned = badge.earned_at !== null
                      return (
                        <div
                          key={badge.id}
                          className={`${styles.badgeCard} ${earned ? styles.badgeCardEarned : styles.badgeCardLocked} ${styles[`badgeCardT${tier}`]}`}
                        >
                          <div className={styles.badgeIconWrap}>
                            {earned ? (
                              <span className={styles.badgeIconEarned}>🏅</span>
                            ) : (
                              <span className={styles.badgeIconLocked}>🔒</span>
                            )}
                          </div>
                          <div className={styles.badgeCardBody}>
                            <span className={styles.badgeName}>{badge.name}</span>
                            <span className={styles.badgeDesc}>{badge.description}</span>
                            {earned && badge.earned_at && (
                              <span className={styles.badgeEarnedDate}>
                                ✓ {formatEarnedDate(badge.earned_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </AppShell>
  )
}
