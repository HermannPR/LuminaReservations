export interface StreakInfo {
  current_streak: number
  longest_streak: number
  last_check_in_date: string | null
}

export interface BadgeInfo {
  id: number
  key: string
  name: string
  description: string
  tier: number
  earned_percentage: number
}

export interface BadgeWithStatus extends BadgeInfo {
  earned_at: string | null
}

export interface CheckInPayload {
  message: string
  streak: StreakInfo
  newBadges: BadgeInfo[]
}

export interface MyStats {
  streak: StreakInfo
  badges: BadgeWithStatus[]
}
