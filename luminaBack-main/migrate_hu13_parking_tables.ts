/**
 * HU13 migration — parking zones, spots, and FK on reservations.
 * Run: npx ts-node migrate_hu13_parking_tables.ts
 */

import "dotenv/config"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const client = await pool.connect()
  try {
    console.log("\nHU13: Creating parking tables...\n")

    // ── 1. parking_zones ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS parking_zones (
        id             SERIAL PRIMARY KEY,
        name           VARCHAR(20)  NOT NULL,
        priority_order INTEGER      NOT NULL,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `)
    console.log("  ✓ parking_zones table")

    // ── 2. parking_spots ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS parking_spots (
        id          SERIAL PRIMARY KEY,
        zone_id     INTEGER      NOT NULL REFERENCES parking_zones(id),
        spot_number VARCHAR(20)  NOT NULL,
        is_active   BOOLEAN      NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `)
    console.log("  ✓ parking_spots table")

    // ── 3. FK on reservations ─────────────────────────────────────────────────────
    await client.query(`
      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS parking_spot_id INTEGER REFERENCES parking_spots(id)
    `)
    console.log("  ✓ reservations.parking_spot_id column")

    // ── 4. Index for availability subquery ────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reservations_parking_spot
        ON reservations(parking_spot_id) WHERE parking_spot_id IS NOT NULL
    `)
    console.log("  ✓ index on reservations.parking_spot_id")

    // ── 5. Seed zones ─────────────────────────────────────────────────────────────
    const zoneCheck = await client.query("SELECT COUNT(*) FROM parking_zones")
    if (Number(zoneCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO parking_zones (name, priority_order) VALUES
          ('T1',      1),
          ('T2',      2),
          ('Central', 3)
      `)
      console.log("  ✓ parking_zones seeded (T1, T2, Central)")
    } else {
      console.log("  ~ parking_zones already seeded, skipped")
    }

    // ── 6. Seed spots ─────────────────────────────────────────────────────────────
    const spotCheck = await client.query("SELECT COUNT(*) FROM parking_spots")
    if (Number(spotCheck.rows[0].count) === 0) {
      const zones = await client.query<{ id: number; name: string }>(
        "SELECT id, name FROM parking_zones ORDER BY priority_order"
      )

      const spotConfig: Record<string, { prefix: string; count: number }> = {
        T1:      { prefix: "T1", count: 15 },
        T2:      { prefix: "T2", count: 25 },
        Central: { prefix: "C",  count: 40 },
      }

      for (const zone of zones.rows) {
        const cfg = spotConfig[zone.name]
        if (!cfg) continue
        for (let i = 1; i <= cfg.count; i++) {
          const num = String(i).padStart(2, "0")
          await client.query(
            "INSERT INTO parking_spots (zone_id, spot_number) VALUES ($1, $2)",
            [zone.id, `${cfg.prefix}-${num}`]
          )
        }
        console.log(`  ✓ ${cfg.count} spots seeded for ${zone.name}`)
      }
    } else {
      console.log("  ~ parking_spots already seeded, skipped")
    }

    console.log("\nMigration complete.\n")
  } catch (err) {
    console.error("\nMigration failed:", err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
