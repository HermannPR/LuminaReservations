/**
 * Seeds non-admin demo users and future reservations for visual QA.
 * Run: npx ts-node seed_demo_users_and_reservations.ts
 */

import "dotenv/config"
import bcrypt from "bcrypt"
import { Pool, PoolClient } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const PASSWORD = "LuminaDemo123!"

const demoUsers = [
  {
    email: "ana.garcia@lumina.demo",
    first_name: "Ana",
    last_name: "Garcia",
    employee_id: "DEMO-101",
    department: "People",
  },
  {
    email: "diego.martinez@lumina.demo",
    first_name: "Diego",
    last_name: "Martinez",
    employee_id: "DEMO-102",
    department: "Technology",
  },
  {
    email: "sofia.lopez@lumina.demo",
    first_name: "Sofia",
    last_name: "Lopez",
    employee_id: "DEMO-103",
    department: "Operations",
  },
]

const plans = [
  {
    email: "ana.garcia@lumina.demo",
    spaces: ["PB-01", "MZ-08", "P9-12"],
    reservations: [
      { dateOffset: 1, start: "09:00", end: "11:00", parking: true },
      { dateOffset: 2, start: "13:00", end: "15:00", parking: false },
      { dateOffset: 5, start: "10:00", end: "12:00", parking: true },
    ],
  },
  {
    email: "diego.martinez@lumina.demo",
    spaces: ["PB-02", "MZ-09", "P3-01"],
    reservations: [
      { dateOffset: 1, start: "11:00", end: "13:00", parking: false },
      { dateOffset: 3, start: "09:30", end: "12:30", parking: true },
      { dateOffset: 6, start: "14:00", end: "16:00", parking: false },
    ],
  },
  {
    email: "sofia.lopez@lumina.demo",
    spaces: ["PB-03", "MZ-10", "P9-13"],
    reservations: [
      { dateOffset: 1, start: "14:00", end: "17:00", parking: true },
      { dateOffset: 4, start: "10:30", end: "12:00", parking: false },
      { dateOffset: 7, start: "08:00", end: "10:00", parking: true },
    ],
  },
]

function dateWithOffset(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

async function ensureEmployeeRole(client: PoolClient): Promise<number> {
  const existing = await client.query<{ id: number }>("SELECT id FROM roles WHERE name = $1", ["employee"])
  if (existing.rows[0]) return existing.rows[0].id

  const created = await client.query<{ id: number }>(
    "INSERT INTO roles (name, description, permissions) VALUES ($1, $2, $3) RETURNING id",
    ["employee", "Employee", "read,write"]
  )
  return created.rows[0].id
}

async function ensureUser(client: PoolClient, user: typeof demoUsers[number], passwordHash: string): Promise<number> {
  const existing = await client.query<{ id: number }>("SELECT id FROM users WHERE email = $1", [user.email])
  if (existing.rows[0]) return existing.rows[0].id

  const created = await client.query<{ id: number }>(
    `INSERT INTO users
       (email, password_hash, first_name, last_name, employee_id, role, department, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'employee', $6, true, NOW(), NOW())
     RETURNING id`,
    [user.email, passwordHash, user.first_name, user.last_name, user.employee_id, user.department]
  )
  return created.rows[0].id
}

async function ensureUserRole(client: PoolClient, userId: number, roleId: number): Promise<void> {
  const existing = await client.query(
    "SELECT id FROM user_roles WHERE user_id = $1 AND role_id = $2",
    [userId, roleId]
  )
  if (existing.rows[0]) return

  await client.query(
    "INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES ($1, $2, NOW())",
    [userId, roleId]
  )
}

async function findSpaces(client: PoolClient, desiredNumbers: string[]): Promise<number[]> {
  const result = await client.query<{ id: number; space_number: string }>(
    `SELECT id, space_number
     FROM spaces
     WHERE visual_only = false AND is_active = true
     ORDER BY CASE WHEN space_number = ANY($1) THEN 0 ELSE 1 END, floor_id, space_number
     LIMIT $2`,
    [desiredNumbers, desiredNumbers.length]
  )
  return result.rows.map((row) => row.id)
}

async function findSpacesByFloor(client: PoolClient, floorNumber: number, limit: number): Promise<number[]> {
  const result = await client.query<{ id: number }>(
    `SELECT s.id
     FROM spaces s
     JOIN floors f ON f.id = s.floor_id
     WHERE f.floor_number = $1
       AND s.visual_only = false
       AND s.is_active = true
     ORDER BY s.space_number
     LIMIT $2`,
    [floorNumber, limit]
  )
  return result.rows.map((row) => row.id)
}

function nextVisibleWindow(): { date: string; start: string; end: string } {
  const now = new Date()
  let startHour = now.getHours() + 1
  if (startHour < 9) startHour = 9
  if (startHour > 19) startHour = 19

  const endHour = Math.min(startHour + 2, 22)
  return {
    date: now.toISOString().slice(0, 10),
    start: `${String(startHour).padStart(2, "0")}:00`,
    end: `${String(endHour).padStart(2, "0")}:00`,
  }
}

async function assignParkingIfNeeded(
  client: PoolClient,
  reservationId: number,
  date: string,
  start: string,
  end: string
): Promise<void> {
  const spot = await client.query<{ id: number }>(
    `SELECT ps.id
     FROM parking_spots ps
     JOIN parking_zones pz ON pz.id = ps.zone_id
     WHERE ps.is_active = true
       AND NOT EXISTS (
         SELECT 1
         FROM reservations r
         WHERE r.parking_spot_id = ps.id
           AND r.status IN ('confirmada', 'activa')
           AND r.reservation_date = $1
           AND r.start_time < $3
           AND r.end_time > $2
       )
     ORDER BY pz.priority_order, ps.spot_number
     LIMIT 1`,
    [date, start, end]
  )

  if (!spot.rows[0]) return

  await client.query(
    "UPDATE reservations SET parking_spot_id = $1 WHERE id = $2",
    [spot.rows[0].id, reservationId]
  )
}

async function ensureReservation(
  client: PoolClient,
  userId: number,
  spaceId: number,
  date: string,
  start: string,
  end: string,
  parking: boolean,
  index: number
): Promise<void> {
  const exists = await client.query<{ id: number }>(
    `SELECT id FROM reservations
     WHERE user_id = $1 AND space_id = $2 AND reservation_date = $3 AND start_time = $4 AND end_time = $5`,
    [userId, spaceId, date, start, end]
  )
  if (exists.rows[0]) return

  const code = `DM${String(userId).padStart(2, "0")}${String(index).padStart(4, "0")}`.slice(0, 8)
  const created = await client.query<{ id: number }>(
    `INSERT INTO reservations
       (user_id, space_id, reservation_date, start_time, end_time,
        status, check_in_time, check_out_time, grace_period_minutes,
        created_at, updated_at, reservation_code, requiere_estacionamiento)
     VALUES ($1, $2, $3, $4, $5, 'confirmada', NULL, NULL, 15, NOW(), NOW(), $6, $7)
     RETURNING id`,
    [userId, spaceId, date, start, end, code, parking]
  )

  if (parking) {
    await assignParkingIfNeeded(client, created.rows[0].id, date, start, end)
  }
}

async function seedVisibleMapReservations(client: PoolClient, userIds: Map<string, number>): Promise<void> {
  const visibleWindow = nextVisibleWindow()
  const todayFloors = [
    { floorNumber: 0, email: "ana.garcia@lumina.demo" },
    { floorNumber: 1, email: "diego.martinez@lumina.demo" },
    { floorNumber: 3, email: "sofia.lopez@lumina.demo" },
  ]

  let index = 7000
  for (const item of todayFloors) {
    const userId = userIds.get(item.email)
    if (!userId) continue
    const [spaceId] = await findSpacesByFloor(client, item.floorNumber, 1)
    if (!spaceId) continue

    await ensureReservation(
      client,
      userId,
      spaceId,
      visibleWindow.date,
      visibleWindow.start,
      visibleWindow.end,
      false,
      index
    )
    index++
  }

  const tomorrow = dateWithOffset(1)
  const tomorrowFloors = [
    { floorNumber: 0, email: "ana.garcia@lumina.demo", start: "09:00", end: "11:00" },
    { floorNumber: 1, email: "diego.martinez@lumina.demo", start: "11:00", end: "13:00" },
    { floorNumber: 3, email: "sofia.lopez@lumina.demo", start: "13:00", end: "15:00" },
    { floorNumber: 9, email: "ana.garcia@lumina.demo", start: "15:00", end: "17:00" },
  ]

  for (const item of tomorrowFloors) {
    const userId = userIds.get(item.email)
    if (!userId) continue
    const [spaceId] = await findSpacesByFloor(client, item.floorNumber, 2)
    if (!spaceId) continue

    await ensureReservation(
      client,
      userId,
      spaceId,
      tomorrow,
      item.start,
      item.end,
      false,
      index
    )
    index++
  }
}

async function main() {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const passwordHash = await bcrypt.hash(PASSWORD, 10)
    const employeeRoleId = await ensureEmployeeRole(client)
    const userIds = new Map<string, number>()

    for (const user of demoUsers) {
      const id = await ensureUser(client, user, passwordHash)
      await ensureUserRole(client, id, employeeRoleId)
      userIds.set(user.email, id)
    }

    let reservationIndex = 1
    for (const plan of plans) {
      const userId = userIds.get(plan.email)
      if (!userId) continue

      const spaceIds = await findSpaces(client, plan.spaces)
      for (let i = 0; i < plan.reservations.length; i++) {
        const reservation = plan.reservations[i]
        const spaceId = spaceIds[i % spaceIds.length]
        if (!spaceId) continue

        await ensureReservation(
          client,
          userId,
          spaceId,
          dateWithOffset(reservation.dateOffset),
          reservation.start,
          reservation.end,
          reservation.parking,
          reservationIndex
        )
        reservationIndex++
      }
    }

    await seedVisibleMapReservations(client, userIds)

    await client.query("COMMIT")

    console.log("Demo users and reservations ready.")
    console.log("Password for demo users:", PASSWORD)
    for (const user of demoUsers) {
      console.log(`- ${user.email}`)
    }
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("Seed failed:", err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
