import "dotenv/config"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main(): Promise<void> {
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reservations_date_status_space_time
      ON reservations (reservation_date, status, space_id, start_time, end_time)
      WHERE space_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_reservations_user_status_date_time
      ON reservations (user_id, status, reservation_date, start_time, end_time);

    CREATE INDEX IF NOT EXISTS idx_reservations_parking_date_status_time
      ON reservations (reservation_date, status, parking_spot_id, start_time)
      WHERE parking_spot_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_spaces_floor_category_active
      ON spaces (floor_id, priority_category, is_active, visual_only);

    CREATE INDEX IF NOT EXISTS idx_area_blocks_active_area
      ON area_blocks (floor_id, priority_category)
      WHERE is_active = true;
  `)
}

main()
  .then(async () => {
    console.log("HU18 realtime/AI indexes applied")
    await pool.end()
  })
  .catch(async (error) => {
    console.error("HU18 realtime/AI index migration failed:", error)
    await pool.end()
    process.exit(1)
  })
