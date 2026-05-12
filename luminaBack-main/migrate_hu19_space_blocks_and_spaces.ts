import "dotenv/config"
import { Pool } from "pg"

type ExpectedSpace = {
  floorId: number
  spaceNumber: string
  category: "escritorio" | "colaborativo"
  layoutType: "desk" | "polygon"
  layoutCx: number
  layoutCy: number
  layoutPoints: Array<{ x: number; y: number }>
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

function clamp(value: number, min = 0.04, max = 0.96): number {
  return Math.max(min, Math.min(max, value))
}

function makeDesk(floorId: number, prefix: string, index: number, cols: number, total: number): ExpectedSpace {
  const zeroIndex = index - 1
  const rows = Math.ceil(total / cols)
  const col = zeroIndex % cols
  const row = Math.floor(zeroIndex / cols)
  const cx = (col + 1) / (cols + 1)
  const cy = (row + 1) / (rows + 1)
  const w = 0.018
  const h = 0.014

  return {
    floorId,
    spaceNumber: `${prefix}-${index}`,
    category: "escritorio",
    layoutType: "desk",
    layoutCx: cx,
    layoutCy: cy,
    layoutPoints: [
      { x: clamp(cx - w), y: clamp(cy - h) },
      { x: clamp(cx + w), y: clamp(cy + h) },
    ],
  }
}

function makeArea(floorId: number, spaceNumber: string, order: number, count: number): ExpectedSpace {
  const cx = 0.74 + order * 0.07
  const cy = 0.18 + (order % Math.max(1, count)) * 0.14
  const w = 0.04
  const h = 0.032

  return {
    floorId,
    spaceNumber,
    category: "colaborativo",
    layoutType: "polygon",
    layoutCx: clamp(cx),
    layoutCy: clamp(cy),
    layoutPoints: [
      { x: clamp(cx - w), y: clamp(cy - h) },
      { x: clamp(cx + w), y: clamp(cy - h) },
      { x: clamp(cx + w), y: clamp(cy + h) },
      { x: clamp(cx - w), y: clamp(cy + h) },
    ],
  }
}

function expectedSpaces(): ExpectedSpace[] {
  const spaces: ExpectedSpace[] = []

  for (let i = 1; i <= 71; i += 1) spaces.push(makeDesk(0, "PB", i, 10, 71))
  ;["PB-A1", "PB-A2", "PB-A3"].forEach((spaceNumber, index, list) => {
    spaces.push(makeArea(0, spaceNumber, index, list.length))
  })

  for (let i = 1; i <= 114; i += 1) spaces.push(makeDesk(1, "MZ", i, 12, 114))
  ;["MZ-A1", "MZ-A2", "MZ-AREA-72"].forEach((spaceNumber, index, list) => {
    spaces.push(makeArea(1, spaceNumber, index, list.length))
  })

  for (let i = 1; i <= 34; i += 1) spaces.push(makeDesk(3, "P3", i, 8, 34))
  ;["P3-A1", "P3-AREA-33"].forEach((spaceNumber, index, list) => {
    spaces.push(makeArea(3, spaceNumber, index, list.length))
  })

  for (let i = 1; i <= 71; i += 1) spaces.push(makeDesk(9, "P9", i, 10, 71))
  ;["P9-A1", "P9-A2", "P9-A3"].forEach((spaceNumber, index, list) => {
    spaces.push(makeArea(9, spaceNumber, index, list.length))
  })

  return spaces
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured")
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    await client.query(`
      CREATE TABLE IF NOT EXISTS space_blocks (
        id SERIAL PRIMARY KEY,
        space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        block_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        reason TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT space_blocks_valid_time CHECK (end_time > start_time)
      );

      CREATE INDEX IF NOT EXISTS idx_space_blocks_active_lookup
        ON space_blocks (space_id, block_date, start_time, end_time)
        WHERE is_active = true;

      CREATE INDEX IF NOT EXISTS idx_space_blocks_date
        ON space_blocks (block_date, is_active);
    `)

    const maxIdResult = await client.query<{ max_id: number | null }>("SELECT MAX(id)::int AS max_id FROM spaces")
    let nextId = (maxIdResult.rows[0]?.max_id ?? 0) + 1
    let inserted = 0

    for (const space of expectedSpaces()) {
      const exists = await client.query<{ id: number }>(
        "SELECT id FROM spaces WHERE floor_id = $1 AND space_number = $2 LIMIT 1",
        [space.floorId, space.spaceNumber]
      )
      if (exists.rows.length > 0) continue

      await client.query(
        `INSERT INTO spaces (
           id, floor_id, space_number, priority_category, is_active, created_at,
           layout_type, layout_direction, layout_cx, layout_cy, layout_points, visual_only
         )
         VALUES ($1, $2, $3, $4, true, NOW(), $5, 'up', $6, $7, $8::jsonb, false)`,
        [
          nextId,
          space.floorId,
          space.spaceNumber,
          space.category,
          space.layoutType,
          space.layoutCx,
          space.layoutCy,
          JSON.stringify(space.layoutPoints),
        ]
      )
      nextId += 1
      inserted += 1
    }

    await client.query(`
      UPDATE floors f
      SET total_spaces = counts.total
      FROM (
        SELECT floor_id, COUNT(*)::int AS total
        FROM spaces
        WHERE is_active = true
          AND COALESCE(visual_only, false) = false
        GROUP BY floor_id
      ) counts
      WHERE counts.floor_id = f.id;
    `)

    const counts = await client.query(`
      SELECT f.id AS floor_id, f.name, COUNT(s.id)::int AS total
      FROM floors f
      LEFT JOIN spaces s
        ON s.floor_id = f.id
       AND s.is_active = true
       AND COALESCE(s.visual_only, false) = false
      GROUP BY f.id, f.name, f.floor_number
      ORDER BY f.floor_number
    `)

    await client.query("COMMIT")
    console.log(JSON.stringify({ inserted, floors: counts.rows }, null, 2))
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("HU19 space block/space migration failed:", error)
  process.exit(1)
})
