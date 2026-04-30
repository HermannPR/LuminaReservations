require("dotenv/config")

const bcrypt = require("bcrypt")
const { Pool } = require("pg")

const EMAIL = "guardia@lumina.demo"
const PASSWORD = "LuminaDemo123!"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const client = await pool.connect()

  try {
    await client.query("begin")

    let roleResult = await client.query(
      "select id from roles where lower(name) = 'guardia' order by id limit 1"
    )
    let roleId = roleResult.rows[0]?.id

    if (!roleId) {
      roleResult = await client.query(
        "insert into roles (name, description, permissions) values ($1, $2, $3) returning id",
        ["guardia", "Guardia de estacionamiento", "read:parking"]
      )
      roleId = roleResult.rows[0].id
    } else {
      await client.query(
        "update roles set description = $2, permissions = $3 where id = $1",
        [roleId, "Guardia de estacionamiento", "read:parking"]
      )
    }

    let userResult = await client.query(
      "select id from users where lower(email) = lower($1) order by id limit 1",
      [EMAIL]
    )
    let userId = userResult.rows[0]?.id

    if (userId) {
      userResult = await client.query(
        `update users
         set password_hash = $2,
             first_name = $3,
             last_name = $4,
             employee_id = $5,
             role = $6,
             department = $7,
             is_active = true
         where id = $1
         returning id, email, role`,
        [userId, passwordHash, "Guardia", "Estacionamiento", "GUARD-001", "guardia", "Security"]
      )
    } else {
      userResult = await client.query(
        `insert into users
          (email, password_hash, first_name, last_name, employee_id, role, department, is_active, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, true, now(), now())
         returning id, email, role`,
        [EMAIL, passwordHash, "Guardia", "Estacionamiento", "GUARD-001", "guardia", "Security"]
      )
      userId = userResult.rows[0].id
    }

    const linkResult = await client.query(
      "select 1 from user_roles where user_id = $1 and role_id = $2 limit 1",
      [userId, roleId]
    )

    if (linkResult.rowCount === 0) {
      await client.query(
        "insert into user_roles (user_id, role_id, assigned_at) values ($1, $2, now())",
        [userId, roleId]
      )
    }

    await client.query("commit")
    console.log(JSON.stringify({ user: userResult.rows[0], password: PASSWORD }, null, 2))
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
