import "dotenv/config"
import { Pool } from "pg"

const SQL = `
-- Remove friends feature completely.
DROP TABLE IF EXISTS friendships;

-- Parking reservations must be tied to an office reservation.
DELETE FROM reservations
WHERE space_id IS NULL;

ALTER TABLE reservations
  ALTER COLUMN space_id SET NOT NULL;

-- Admin area blocking.
CREATE TABLE IF NOT EXISTS area_blocks (
  id SERIAL PRIMARY KEY,
  floor_id INTEGER NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  priority_category TEXT NOT NULL CHECK (priority_category IN ('escritorio', 'colaborativo', 'work_lab', 'phone_booth', 'garage')),
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS area_blocks_unique_area
  ON area_blocks (floor_id, priority_category);

CREATE INDEX IF NOT EXISTS area_blocks_active_idx
  ON area_blocks (floor_id, priority_category)
  WHERE is_active = true;

-- Guard role for the parking access view.
INSERT INTO roles (name, description, permissions)
SELECT 'guardia', 'Guardia de estacionamiento', 'read:parking'
WHERE NOT EXISTS (
  SELECT 1
  FROM roles
  WHERE LOWER(name) IN ('guard', 'guardia')
);
`

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured")
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await pool.query(SQL)
    console.log("HU17 cleanup/admin/AI migration applied")
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
