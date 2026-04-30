import { BadgeRepository, BadgeInfo } from "../repositories/BadgeRepository"
import { StreakInfo } from "../repositories/StreakRepository"

export class BadgeService {
  constructor(private readonly badgeRepository: BadgeRepository) {}

  async findEarnedWithStatus(userId: number) {
    return this.badgeRepository.findAllWithStatus(userId)
  }

  async evaluateAfterCheckIn(userId: number, streak: StreakInfo): Promise<BadgeInfo[]> {
    return this.evaluateBadges(userId, streak, "checkin")
  }

  async evaluateAfterReservation(userId: number): Promise<BadgeInfo[]> {
    return this.evaluateBadges(userId, null, "reservation")
  }

  private async evaluateBadges(
    userId: number,
    streak: StreakInfo | null,
    trigger: "checkin" | "reservation"
  ): Promise<BadgeInfo[]> {
    const allBadges = await this.badgeRepository.findAll()
    const earned = await this.badgeRepository.findEarned(userId)
    const earnedIds = new Set(earned.map((b) => b.id))
    const unearned = allBadges.filter((b) => !earnedIds.has(b.id))

    const newlyEarned: BadgeInfo[] = []

    for (const badge of unearned) {
      if (this.badgeTrigger(badge.key) !== trigger) continue

      const isEarned = await this.checkCondition(badge, userId, streak)
      if (isEarned) {
        const wasNew = await this.badgeRepository.award(userId, badge.id)
        if (wasNew) newlyEarned.push(badge)
      }
    }

    return newlyEarned
  }

  private badgeTrigger(key: string): "checkin" | "reservation" {
    const reservationTriggers = new Set([
      "bienvenido_colega",
      "cafecito_en_la_mano",
      "ya_me_ubico",
      "asiduo_del_edificio",
      "inquilino_de_honor",
      "el_edificio_es_mio",
      "planificador_de_elite",
    ])
    return reservationTriggers.has(key) ? "reservation" : "checkin"
  }

  private async checkCondition(
    badge: BadgeInfo,
    userId: number,
    streak: StreakInfo | null
  ): Promise<boolean> {
    const br = this.badgeRepository
    const s = streak?.current_streak ?? 0

    switch (badge.key) {
      // ── Tier 1 ──────────────────────────────────────────────────────────────
      case "bienvenido_colega":
        return (await br.countTotalReservations(userId)) >= 1

      case "cafecito_en_la_mano":
        return (await br.countTotalReservations(userId)) >= 5

      case "diez_de_diez":
        return (await br.countTotalCheckIns(userId)) >= 10

      case "criatura_de_habitos":
        return s >= 5

      // ── Tier 2 ──────────────────────────────────────────────────────────────
      case "ya_me_ubico":
        return (await br.countTotalReservations(userId)) >= 20

      case "la_misma_silla":
        return (await br.maxSameSpaceCheckIns(userId)) >= 10

      case "el_madrugador":
        return (await br.countEarlyMorningCheckIns(userId)) >= 5

      // ── Tier 3 ──────────────────────────────────────────────────────────────
      case "asiduo_del_edificio":
        return (await br.countTotalReservations(userId)) >= 50

      case "racha_de_acero":
        return s >= 15

      case "ciudadano_del_edificio":
        return (await br.countFloorsCovered(userId)) >= 4

      case "semana_completa":
        return (await br.countFullWorkWeeks(userId)) >= 1

      case "sin_faltas": {
        const noShows = await br.countNoShows(userId)
        const checkIns = await br.countTotalCheckIns(userId)
        return noShows === 0 && checkIns >= 20
      }

      // ── Tier 4 ──────────────────────────────────────────────────────────────
      case "inquilino_de_honor":
        return (await br.countTotalReservations(userId)) >= 100

      case "el_mes_perfecto":
        return s >= 20

      case "sin_fronteras":
        return (await br.countMultiFloorWeeks(userId, 3)) >= 3

      case "planificador_de_elite":
        return (await br.countAdvanceBookings(userId, 5)) >= 10

      case "el_constante":
        return (await br.maxConsecutiveWeeksWithAttendance(userId)) >= 12

      // ── Tier 5 ──────────────────────────────────────────────────────────────
      case "el_edificio_es_mio":
        return (await br.countTotalReservations(userId)) >= 200

      case "imparable":
        return s >= 30

      case "la_leyenda_del_edificio":
        return s >= 50

      case "inmortal":
        return s >= 100

      case "el_dueno_del_edificio": {
        const { covered, total } = await br.countAllIndividualSpacesCovered(userId)
        return total > 0 && covered >= total
      }

      default:
        return false
    }
  }
}
