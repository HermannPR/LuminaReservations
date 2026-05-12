import { DbClient } from "../../shared/db"

export interface BadgeInfo {
  id: number
  key: string
  name: string
  description: string
  earned_percentage: number
}

export interface EarnedBadge extends BadgeInfo {
  earned_at: string
}

export interface BadgeWithStatus extends BadgeInfo {
  earned_at: string | null
}

export class BadgeRepository {
  constructor(private readonly db: DbClient) {}

  async findAll(): Promise<BadgeInfo[]> {
    const result = await this.db.query<BadgeInfo>(
      `SELECT b.id,
              b.key,
              b.name,
              b.description,
              0::float AS earned_percentage
       FROM badges b
       ORDER BY b.id`
    )
    return result.rows
  }

  async findAllWithStatus(userId: number): Promise<BadgeWithStatus[]> {
    const result = await this.db.query<BadgeWithStatus>(
      `WITH active_users AS (
         SELECT COUNT(*)::float AS total
         FROM users
         WHERE is_active = true
           AND LOWER(role) NOT IN ('guard', 'guardia')
       ),
       earned_counts AS (
         SELECT badge_id, COUNT(DISTINCT user_id)::float AS earned
         FROM user_badges
         GROUP BY badge_id
       )
       SELECT b.id, b.key, b.name, b.description,
              COALESCE(ROUND(((ec.earned / NULLIF(au.total, 0)) * 100)::numeric, 1), 0)::float AS earned_percentage,
              ub.earned_at::text AS earned_at
       FROM badges b
       CROSS JOIN active_users au
       LEFT JOIN earned_counts ec ON ec.badge_id = b.id
       LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = $1
       ORDER BY b.id`,
      [userId]
    )
    return result.rows
  }

  async findEarned(userId: number): Promise<EarnedBadge[]> {
    const result = await this.db.query<EarnedBadge>(
      `SELECT b.id, b.key, b.name, b.description, ub.earned_at::text AS earned_at
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [userId]
    )
    return result.rows
  }

  async award(userId: number, badgeId: number): Promise<boolean> {
    const result = await this.db.query<{ badge_id: number }>(
      `INSERT INTO user_badges (user_id, badge_id, earned_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT DO NOTHING
       RETURNING badge_id`,
      [userId, badgeId]
    )
    return result.rows.length > 0
  }

  // ── Badge condition queries ──────────────────────────────────────────────────

  async countTotalReservations(userId: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      "SELECT COUNT(*)::text FROM reservations WHERE user_id = $1",
      [userId]
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async countTotalCheckIns(userId: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      "SELECT COUNT(*)::text FROM reservations WHERE user_id = $1 AND status = 'activa'",
      [userId]
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async countEarlyMorningCheckIns(userId: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text FROM reservations
       WHERE user_id = $1 AND status = 'activa' AND check_in_time IS NOT NULL
         AND EXTRACT(HOUR FROM check_in_time AT TIME ZONE 'America/Monterrey') < 8`,
      [userId]
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async countPunctualCheckIns(userId: number, withinMinutes: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text FROM reservations
       WHERE user_id = $1 AND status = 'activa' AND check_in_time IS NOT NULL
         AND EXTRACT(EPOCH FROM (
           (check_in_time AT TIME ZONE 'America/Monterrey') -
           (reservation_date::timestamp + start_time::interval)
         )) / 60 <= $2`,
      [userId, withinMinutes]
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async countLastMinuteCheckIns(userId: number, closingWindowMinutes: number): Promise<number> {
    // Check-in within the last N minutes of the grace window (window closes at start + 30 min)
    const windowCloseMinutes = 30
    const thresholdMinutes = windowCloseMinutes - closingWindowMinutes
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text FROM reservations
       WHERE user_id = $1 AND status = 'activa' AND check_in_time IS NOT NULL
         AND EXTRACT(EPOCH FROM (
           (check_in_time AT TIME ZONE 'America/Monterrey') -
           (reservation_date::timestamp + start_time::interval)
         )) / 60 >= $2
         AND EXTRACT(EPOCH FROM (
           (check_in_time AT TIME ZONE 'America/Monterrey') -
           (reservation_date::timestamp + start_time::interval)
         )) / 60 <= $3`,
      [userId, thresholdMinutes, windowCloseMinutes]
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async maxSameSpaceCheckIns(userId: number): Promise<number> {
    const result = await this.db.query<{ max_count: string }>(
      `SELECT COALESCE(MAX(cnt), 0)::text AS max_count FROM (
         SELECT space_id, COUNT(*) AS cnt
         FROM reservations
         WHERE user_id = $1 AND status = 'activa'
         GROUP BY space_id
       ) sub`,
      [userId]
    )
    return parseInt(result.rows[0]?.max_count ?? "0", 10)
  }

  async countFloorsCovered(userId: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(DISTINCT s.floor_id)::text AS count
       FROM reservations r
       JOIN spaces s ON s.id = r.space_id
       WHERE r.user_id = $1 AND r.status = 'activa'`,
      [userId]
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async countTypesCovered(userId: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(DISTINCT s.priority_category)::text AS count
       FROM reservations r
       JOIN spaces s ON s.id = r.space_id
       WHERE r.user_id = $1 AND r.status = 'activa' AND s.priority_category IS NOT NULL`,
      [userId]
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async getGridCoverage(userId: number): Promise<{ covered: number; total: number }> {
    const result = await this.db.query<{ covered: string; total: string }>(
      `SELECT
         (SELECT COUNT(DISTINCT (s2.floor_id, s2.priority_category))
          FROM reservations r2 JOIN spaces s2 ON s2.id = r2.space_id
          WHERE r2.user_id = $1 AND r2.status = 'activa' AND s2.priority_category IS NOT NULL
         )::text AS covered,
         (SELECT COUNT(DISTINCT (floor_id, priority_category))
          FROM spaces WHERE is_active = true AND priority_category IS NOT NULL
         )::text AS total`,
      [userId]
    )
    return {
      covered: parseInt(result.rows[0]?.covered ?? "0", 10),
      total: parseInt(result.rows[0]?.total ?? "0", 10),
    }
  }

  async maxConsecutiveMondayCheckIns(userId: number): Promise<number> {
    const result = await this.db.query<{ max_streak: string }>(
      `WITH monday_checkins AS (
         SELECT DISTINCT DATE_TRUNC('week', reservation_date::timestamp) AS week_start
         FROM reservations
         WHERE user_id = $1 AND status = 'activa'
           AND EXTRACT(DOW FROM reservation_date::timestamp) = 1
       ),
       consecutiveness AS (
         SELECT week_start,
                week_start - (ROW_NUMBER() OVER (ORDER BY week_start) || ' weeks')::interval AS grp
         FROM monday_checkins
       ),
       groups AS (
         SELECT COUNT(*) AS streak FROM consecutiveness GROUP BY grp
       )
       SELECT COALESCE(MAX(streak), 0)::text AS max_streak FROM groups`,
      [userId]
    )
    return parseInt(result.rows[0]?.max_streak ?? "0", 10)
  }

  async countParkingAssigned(userId: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text FROM reservations
       WHERE user_id = $1 AND parking_spot_id IS NOT NULL AND status != 'cancelada'`,
      [userId]
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async countAdvanceBookings(userId: number, minDaysAdvance: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text FROM reservations
       WHERE user_id = $1
         AND (reservation_date::date - created_at::date) >= $2`,
      [userId, minDaysAdvance]
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async countMultiFloorWeeks(userId: number, minFloors: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `WITH weekly_floors AS (
         SELECT DATE_TRUNC('week', r.reservation_date::timestamp) AS week_start,
                COUNT(DISTINCT s.floor_id) AS floor_count
         FROM reservations r
         JOIN spaces s ON s.id = r.space_id
         WHERE r.user_id = $1
         GROUP BY DATE_TRUNC('week', r.reservation_date::timestamp)
       )
       SELECT COUNT(*)::text AS count FROM weekly_floors WHERE floor_count >= $2`,
      [userId, minFloors]
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async countNoShows(userId: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      "SELECT COUNT(*)::text FROM reservations WHERE user_id = $1 AND status = 'no_show'",
      [userId]
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async countFullWorkWeeks(userId: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `WITH week_days AS (
         SELECT DATE_TRUNC('week', reservation_date::timestamp) AS week_start,
                COUNT(DISTINCT EXTRACT(DOW FROM reservation_date::timestamp)) AS day_count
         FROM reservations
         WHERE user_id = $1 AND status = 'activa'
           AND EXTRACT(DOW FROM reservation_date::timestamp) BETWEEN 1 AND 5
         GROUP BY DATE_TRUNC('week', reservation_date::timestamp)
       )
       SELECT COUNT(*)::text AS count FROM week_days WHERE day_count >= 5`,
      [userId]
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async maxConsecutiveWeeksWithAttendance(userId: number): Promise<number> {
    const result = await this.db.query<{ max_streak: string }>(
      `WITH weekly_attendance AS (
         SELECT DISTINCT DATE_TRUNC('week', reservation_date::timestamp) AS week_start
         FROM reservations
         WHERE user_id = $1 AND status = 'activa'
       ),
       consecutiveness AS (
         SELECT week_start,
                week_start - (ROW_NUMBER() OVER (ORDER BY week_start) || ' weeks')::interval AS grp
         FROM weekly_attendance
       ),
       groups AS (
         SELECT COUNT(*) AS streak FROM consecutiveness GROUP BY grp
       )
       SELECT COALESCE(MAX(streak), 0)::text AS max_streak FROM groups`,
      [userId]
    )
    return parseInt(result.rows[0]?.max_streak ?? "0", 10)
  }

  async countAllIndividualSpacesCovered(userId: number): Promise<{ covered: number; total: number }> {
    const result = await this.db.query<{ covered: string; total: string }>(
      `SELECT
         (SELECT COUNT(DISTINCT r.space_id)
          FROM reservations r JOIN spaces s ON s.id = r.space_id
          WHERE r.user_id = $1 AND r.status = 'activa'
            AND s.priority_category != 'colaborativo')::text AS covered,
         (SELECT COUNT(*)
          FROM spaces
          WHERE is_active = true
            AND priority_category != 'colaborativo')::text AS total`,
      [userId]
    )
    return {
      covered: parseInt(result.rows[0]?.covered ?? "0", 10),
      total: parseInt(result.rows[0]?.total ?? "0", 10),
    }
  }
}
