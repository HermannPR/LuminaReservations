/**
 * Migration + seed script.
 * Run: ts-node migrate_and_seed.ts
 *
 * Actions:
 *  1. ALTER TABLE spaces — add layout columns
 *  2. ALTER TABLE floors — add floor_name, plan_image_url
 *  3. UPDATE floors with names and image URLs
 *  4. DELETE existing spaces per floor then INSERT from lumina-map-corrected.json
 */

import "dotenv/config"
import { Pool } from "pg"
import * as fs from "fs"
import * as path from "path"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ── Map crop label → floor_number ────────────────────────────────────────────
const FLOOR_MAP: Record<string, { floor_number: number; prefix: string; image: string }> = {
  "Planta Baja (PB)": { floor_number: 0, prefix: "PB",  image: "/floorplans/pb.png"    },
  "Mezzanine (MZ)":   { floor_number: 1, prefix: "MZ",  image: "/floorplans/mz.png"    },
  "Piso 3":           { floor_number: 3, prefix: "P3",  image: "/floorplans/piso3.png" },
  "Piso 9":           { floor_number: 9, prefix: "P9",  image: "/floorplans/piso9.png" },
}

const FLOOR_NAMES: Record<number, string> = {
  0: "Planta Baja",
  1: "Mezzanine",
  3: "Piso 3",
  9: "Piso 9",
}

async function main() {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // ── 1. Extend spaces table ────────────────────────────────────────────────
    console.log("1. Adding layout columns to spaces...")
    await client.query(`
      ALTER TABLE spaces
        ADD COLUMN IF NOT EXISTS layout_type      VARCHAR(10),
        ADD COLUMN IF NOT EXISTS layout_direction VARCHAR(5),
        ADD COLUMN IF NOT EXISTS layout_cx        FLOAT,
        ADD COLUMN IF NOT EXISTS layout_cy        FLOAT,
        ADD COLUMN IF NOT EXISTS layout_points    JSONB,
        ADD COLUMN IF NOT EXISTS visual_only      BOOLEAN DEFAULT false
    `)

    // ── 2. Extend floors table ────────────────────────────────────────────────
    console.log("2. Adding plan_image_url column to floors...")
    await client.query(`
      ALTER TABLE floors
        ADD COLUMN IF NOT EXISTS plan_image_url VARCHAR(255)
    `)

    // ── 3. Populate floor image URLs (name column already exists) ─────────────
    console.log("3. Updating floor image URLs...")
    for (const [, info] of Object.entries(FLOOR_MAP)) {
      await client.query(
        `UPDATE floors SET plan_image_url = $1 WHERE floor_number = $2`,
        [info.image, info.floor_number]
      )
    }

    // ── 4. Load mapper JSON ───────────────────────────────────────────────────
    const jsonPath = path.resolve(
      "/Users/hermannpauwells/ANTIGRAVITY/Lumina Reservations/luminaMapperV2/lumina-map-corrected.json"
    )
    const raw = fs.readFileSync(jsonPath, "utf8")
    const data = JSON.parse(raw) as {
      crops: Array<{
        label: string
        spaces: Array<{
          type: "desk" | "rect" | "polygon"
          direction?: string
          points: Array<{ x: number; y: number }>
          center?: { x: number; y: number }
          metadata: { space_number: string; kind: string }
        }>
      }>
    }

    // ── 5. Reseed spaces per floor ────────────────────────────────────────────
    for (const crop of data.crops) {
      const floorInfo = FLOOR_MAP[crop.label]
      if (!floorInfo) {
        console.warn(`  SKIP unknown crop label: ${crop.label}`)
        continue
      }

      // Get floor PK
      const floorRes = await client.query<{ id: number }>(
        "SELECT id FROM floors WHERE floor_number = $1",
        [floorInfo.floor_number]
      )
      if (floorRes.rows.length === 0) {
        console.warn(`  SKIP floor_number ${floorInfo.floor_number} not found in DB`)
        continue
      }
      const floorId = floorRes.rows[0].id

      // Delete reservations referencing spaces on this floor, then delete the spaces
      const delRes = await client.query(
        "DELETE FROM reservations WHERE space_id IN (SELECT id FROM spaces WHERE floor_id = $1)",
        [floorId]
      )
      const deleted = await client.query(
        "DELETE FROM spaces WHERE floor_id = $1",
        [floorId]
      )
      console.log(`  ${crop.label}: deleted ${delRes.rowCount} reservations, ${deleted.rowCount} old spaces`)

      // Insert new spaces
      let inserted = 0
      for (const sp of crop.spaces) {
        const visualOnly = sp.metadata.kind === "visual"

        // priority_category
        let category: string | null = null
        if (!visualOnly) {
          category = sp.type === "desk" ? "escritorio" : "colaborativo"
        }

        // space_number: prefix + mapper number (desks), or prefix+shape type for areas
        let spaceNumber: string
        if (sp.metadata.space_number && sp.metadata.space_number !== "") {
          spaceNumber = `${floorInfo.prefix}-${sp.metadata.space_number}`
        } else {
          // unnamed visual/area shape — give it a unique placeholder
          spaceNumber = `${floorInfo.prefix}-AREA-${inserted + 1}`
        }

        // center coords
        const cx = sp.center?.x ?? (sp.points[0].x + sp.points[sp.points.length - 1].x) / 2
        const cy = sp.center?.y ?? (sp.points[0].y + sp.points[sp.points.length - 1].y) / 2

        const direction = sp.direction ?? null

        await client.query(
          `INSERT INTO spaces
             (space_number, floor_id, priority_category, is_active,
              layout_type, layout_direction, layout_cx, layout_cy, layout_points, visual_only,
              created_at)
           VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            spaceNumber,
            floorId,
            category,
            sp.type,
            direction,
            cx,
            cy,
            JSON.stringify(sp.points),
            visualOnly,
          ]
        )
        inserted++
      }
      console.log(`  ${crop.label}: inserted ${inserted} spaces`)
    }

    await client.query("COMMIT")
    console.log("\nDone.")
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("Error — rolled back:", err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
