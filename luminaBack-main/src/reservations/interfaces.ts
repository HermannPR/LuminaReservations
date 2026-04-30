export type PriorityCategory =
  | "escritorio"
  | "colaborativo"
  | "work_lab"
  | "phone_booth"
  | "garage"

export type ReservationStatus =
  | "confirmada"
  | "activa"
  | "cancelada"
  | "no_show"

export interface Floor {
  id: number
  floor_number: number
  building_id: number
  name: string
  plan_image_url: string | null
  is_active: boolean
}

export interface LayoutPoint {
  x: number
  y: number
}

export interface Space {
  id: number
  space_number: string
  floor_id: number
  priority_category: PriorityCategory | null
  is_active: boolean
  layout_type: "desk" | "rect" | "polygon" | null
  layout_direction: "up" | "down" | "left" | "right" | null
  layout_cx: number | null
  layout_cy: number | null
  layout_points: LayoutPoint[] | null
  visual_only: boolean
}

export interface ParkingSpotInfo {
  zone_name: string
  spot_number: string
}

export interface PublicUserProfile {
  id: number
  first_name: string
  last_name: string
  email: string
  department: string
  profile_photo_url: string | null
}

export interface UserReservation {
  reservation_id: number
  reservation_code: string
  space_number: string
  floor_name: string
  floor_number: number | null
  reservation_date: string
  start_time: string
  end_time: string
  status: ReservationStatus
  grace_period_minutes?: number
  check_in_time?: Date | null
  parking_spot_number: string | null
  parking_zone_name: string | null
}

export interface SpaceOccupancy {
  space_id: number
  intervals: Array<{
    start_time: string
    end_time: string
    status: Extract<ReservationStatus, "confirmada" | "activa">
    user: PublicUserProfile
  }>
}

export interface IntelligentRecommendation {
  space: Space
  score: number
  reasons: string[]
  nearby_user: PublicUserProfile | null
  predicted_occupancy: number
}

export interface RecommendationResult {
  predicted_occupancy: number
  prediction_label: "baja" | "media" | "alta"
  recommendations: IntelligentRecommendation[]
}

export interface Reservation {
  id: number
  user_id: number
  space_id: number | null
  reservation_date: string        // ISO 8601: "YYYY-MM-DD"
  start_time: string              // "HH:MM"
  end_time: string                // "HH:MM"
  status: ReservationStatus
  check_in_time: Date | null
  check_out_time: Date | null
  grace_period_minutes: number
  reservation_code: string        // 8 chars uppercase alphanumeric
  requiere_estacionamiento: boolean
  parking_spot_id: number | null
  created_at: Date
  updated_at: Date
}

export interface AvailabilityFilter {
  reservation_date: string        // "YYYY-MM-DD"
  start_time: string              // "HH:MM"
  end_time: string                // "HH:MM"
  floor_id?: number
  priority_category?: PriorityCategory
}

export interface CreateReservationInput {
  space_id?: number | null
  reservation_date: string
  start_time: string
  end_time: string
  requiere_estacionamiento?: boolean
}

export interface ReservationResult {
  reservation_id: number
  reservation_code: string
  space_id: number | null
  reservation_date: string
  start_time: string
  end_time: string
  status: ReservationStatus
  requiere_estacionamiento: boolean
  parking_spot: ParkingSpotInfo | null
  newBadges?: BadgeInfo[]
}

export interface NewReservationRecord {
  user_id: number
  space_id: number | null
  reservation_date: string
  start_time: string
  end_time: string
  reservation_code: string
  status: "confirmada"
  grace_period_minutes: number
  requiere_estacionamiento: boolean
  check_in_time: null
  check_out_time: null
}

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
}

export interface CheckInResult {
  streak: StreakInfo
  newBadges: BadgeInfo[]
}

export interface AdminKpiOverview {
  date: string
  total_reservations: number
  active_reservations: number
  parking_reservations: number
  unique_users: number
  total_spaces: number
  occupied_spaces: number
  occupancy_rate: number
  by_floor: Array<{
    floor_id: number
    floor_name: string
    total_spaces: number
    occupied_spaces: number
    occupancy_rate: number
  }>
  by_category: Array<{
    priority_category: PriorityCategory
    total_spaces: number
    occupied_spaces: number
    occupancy_rate: number
  }>
  blocked_areas: AreaBlock[]
}

export interface AreaBlock {
  id: number
  floor_id: number
  floor_name: string
  priority_category: PriorityCategory
  reason: string | null
  is_active: boolean
  created_at: Date
}

export interface ParkingReservationForGuard {
  reservation_id: number
  reservation_code: string
  reservation_date: string
  start_time: string
  end_time: string
  status: Extract<ReservationStatus, "confirmada" | "activa">
  parking_spot_number: string
  parking_zone_name: string
  user: PublicUserProfile
  space_number: string
  floor_name: string
}
