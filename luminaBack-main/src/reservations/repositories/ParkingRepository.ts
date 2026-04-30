import { Pool, PoolClient } from "pg"
import { ReservationError } from "../errors"

export interface AssignedSpot {
  spot_id: number
  spot_number: string
  zone_name: string
}

export class ParkingRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Finds the first available spot in priority order (T1 → T2 → Central),
   * assigns it to the reservation, and returns the spot info.
   * Returns null when all spots are taken for that time window.
   *
   * Uses SELECT FOR UPDATE SKIP LOCKED inside a transaction to prevent
   * duplicate assignments under concurrent requests.
   */
  async assignSpot(
    reservationId: number,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<AssignedSpot | null> {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")

      const spot = await this.lockAvailableSpot(client, date, startTime, endTime)
      if (!spot) {
        await client.query("ROLLBACK")
        return null
      }

      await client.query(
        "UPDATE reservations SET parking_spot_id = $1 WHERE id = $2",
        [spot.id, reservationId]
      )
      await client.query("COMMIT")

      return { spot_id: spot.id, spot_number: spot.spot_number, zone_name: spot.zone_name }
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {})
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error al asignar lugar de estacionamiento")
    } finally {
      client.release()
    }
  }

  private async lockAvailableSpot(
    client: Pick<PoolClient, "query">,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<{ id: number; spot_number: string; zone_name: string } | null> {
    const result = await client.query<{ id: number; spot_number: string; zone_name: string }>(`
      SELECT ps.id, ps.spot_number, pz.name AS zone_name
      FROM parking_spots ps
      JOIN parking_zones pz ON pz.id = ps.zone_id
      WHERE ps.is_active = true
        AND NOT EXISTS (
          SELECT 1
          FROM reservations r2
          WHERE r2.parking_spot_id = ps.id
            AND r2.status IN ('confirmada', 'activa')
            AND r2.reservation_date = $1
            AND r2.start_time < $3
            AND r2.end_time > $2
        )
      ORDER BY pz.priority_order, ps.spot_number
      LIMIT 1
      FOR UPDATE OF ps SKIP LOCKED
    `, [date, startTime, endTime])

    return result.rows[0] ?? null
  }
}
