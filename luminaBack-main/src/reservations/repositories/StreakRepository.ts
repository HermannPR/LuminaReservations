import { DbClient } from "../../shared/db"

export interface StreakInfo {
  current_streak: number
  longest_streak: number
  last_check_in_date: string | null
}

export class StreakRepository {
  constructor(private readonly db: DbClient) {}

  async upsertAfterCheckIn(userId: number, reservationDate: string): Promise<StreakInfo> {
    const existing = await this.findByUserId(userId)
    const yesterday = this.addDays(reservationDate, -1)

    let newStreak: number

    if (!existing) {
      newStreak = 1
    } else if (existing.last_check_in_date === reservationDate) {
      return existing
    } else if (existing.last_check_in_date === yesterday) {
      newStreak = existing.current_streak + 1
    } else {
      newStreak = 1
    }

    const longestStreak = existing
      ? Math.max(existing.longest_streak, newStreak)
      : newStreak

    await this.db.query(
      `INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_check_in_date, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET current_streak     = $2,
             longest_streak     = $3,
             last_check_in_date = $4,
             updated_at         = NOW()`,
      [userId, newStreak, longestStreak, reservationDate]
    )

    return {
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_check_in_date: reservationDate,
    }
  }

  async findByUserId(userId: number): Promise<StreakInfo | null> {
    const result = await this.db.query<{
      current_streak: number
      longest_streak: number
      last_check_in_date: string | null
    }>(
      `SELECT current_streak, longest_streak, last_check_in_date::text
       FROM user_streaks WHERE user_id = $1`,
      [userId]
    )
    return result.rows[0] ?? null
  }

  private addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + "T00:00:00Z")
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().split("T")[0]
  }
}
