/**
 * DB cleanup migration.
 * Run: npx ts-node migrate_db_cleanup.ts
 *
 * Each step runs in its own transaction with statement_timeout = 0
 * to work around Supabase pgbouncer transaction-mode limits.
 *
 * Changes:
 *  1. Drop redundant is_no_show column (status = 'no_show' is the source of truth)
 *  2. Add UNIQUE constraint on reservation_code
 *  3. Add indexes on hot query columns
 *  4. Add CHECK constraints on status and priority_category
 */

import "dotenv/config"
import { Pool, PoolClient } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function step(label: string, fn: (client: PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query("SET LOCAL statement_timeout = 0")
    await fn(client)
    console.log(`  ✓ ${label}`)
  } catch (err) {
    const pgErr = err as { code?: string; message?: string }
    // 42710 = duplicate constraint/index, 42P07 = duplicate table
    if (pgErr.code === "42710" || pgErr.code === "42P07") {
      console.log(`  ~ ${label} (already exists, skipped)`)
    } else {
      console.error(`  ✗ ${label}: ${pgErr.message}`)
      throw err
    }
  } finally {
    client.release()
  }
}

async function main() {
  console.log("\nRunning DB cleanup migration...")

  console.log("\n1. Dropping redundant is_no_show column...")
  await step("drop is_no_show", async (c) => {
    await c.query("ALTER TABLE reservations DROP COLUMN IF EXISTS is_no_show")
  })

  console.log("\n2. Adding UNIQUE constraint on reservation_code...")
  await step("uq_reservation_code", async (c) => {
    await c.query(
      "ALTER TABLE reservations ADD CONSTRAINT uq_reservation_code UNIQUE (reservation_code)"
    )
  })

  console.log("\n3. Adding indexes on hot query columns...")
  await step("idx_reservations_date_status", async (c) => {
    await c.query("CREATE INDEX IF NOT EXISTS idx_reservations_date_status ON reservations(reservation_date, status)")
  })
  await step("idx_reservations_space_date", async (c) => {
    await c.query("CREATE INDEX IF NOT EXISTS idx_reservations_space_date ON reservations(space_id, reservation_date)")
  })
  await step("idx_reservations_user_id", async (c) => {
    await c.query("CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id)")
  })
  await step("idx_spaces_floor_id", async (c) => {
    await c.query("CREATE INDEX IF NOT EXISTS idx_spaces_floor_id ON spaces(floor_id)")
  })

  console.log("\n4. Adding CHECK constraints...")
  await step("chk_reservation_status", async (c) => {
    await c.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reservation_status') THEN
          ALTER TABLE reservations
            ADD CONSTRAINT chk_reservation_status
              CHECK (status IN ('confirmada', 'activa', 'cancelada', 'no_show'));
        END IF;
      END $$
    `)
  })
  await step("chk_priority_category", async (c) => {
    await c.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_priority_category') THEN
          ALTER TABLE spaces
            ADD CONSTRAINT chk_priority_category
              CHECK (priority_category IS NULL OR priority_category IN (
                'escritorio', 'colaborativo', 'work_lab', 'phone_booth', 'garage'
              ));
        END IF;
      END $$
    `)
  })

  await pool.end()
  console.log("\nMigration complete.\n")
}

main().catch((err) => {
  console.error("\nMigration failed:", err)
  process.exit(1)
})
