/**
 * HU14 migration — add requiere_estacionamiento to reservations.
 * Run: npx ts-node migrate_hu14_parking_field.ts
 */

import "dotenv/config"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const client = await pool.connect()
  try {
    console.log("\nHU14: Adding requiere_estacionamiento column...")
    await client.query(
      "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS requiere_estacionamiento BOOLEAN NOT NULL DEFAULT false"
    )
    console.log("  ✓ requiere_estacionamiento added\n")
  } catch (err) {
    console.error("Migration failed:", err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
