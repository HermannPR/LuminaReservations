import { Pool } from "pg"
import * as dotenv from "dotenv"
dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function runStep(label: string, sql: string, params?: unknown[]) {
  const client = await pool.connect()
  try {
    await client.query("SET LOCAL statement_timeout = 0")
    await client.query(sql, params)
    console.log(`✓ ${label}`)
  } finally {
    client.release()
  }
}

const REMOVED_KEYS = [
  "velocista",
  "al_filo_navaja",
  "lunes_de_leyenda",
  "coleccionista_espacios",
  "el_centurion",
  "valet_ejecutivo",
  "el_fantasma_redimido",
]

async function main() {
  // 1. Remove user_badges for deleted badges first (FK constraint)
  await runStep("Delete user_badges for removed badges", `
    DELETE FROM user_badges
    WHERE badge_id IN (SELECT id FROM badges WHERE key = ANY($1))
  `, [REMOVED_KEYS])

  // 2. Delete removed badges
  await runStep("Delete removed badges", `
    DELETE FROM badges WHERE key = ANY($1)
  `, [REMOVED_KEYS])

  // 3. Update names & descriptions — clean language, no "check-in"
  const updates: [string, string, string][] = [
    ["bienvenido_colega",      "Bienvenido",                  "Primera reserva"],
    ["cafecito_en_la_mano",    "Cafecito en la Mano",         "5 reservas"],
    ["diez_de_diez",           "Diez de Diez",                "10 reservas"],
    ["criatura_de_habitos",    "Criatura de Hábitos",         "Racha de 5 días consecutivos"],
    ["ya_me_ubico",            "Ya Me Ubico",                 "20 reservas"],
    ["la_misma_silla",         "La Misma Silla de Siempre",   "El mismo espacio exacto, 10 veces"],
    ["el_madrugador",          "El Madrugador",               "Llegar antes de las 8:00 AM, 5 veces"],
    ["asiduo_del_edificio",    "Asiduo del Edificio",         "50 reservas"],
    ["racha_de_acero",         "Racha de Acero",              "Racha de 15 días consecutivos"],
    ["ciudadano_del_edificio", "Ciudadano del Edificio",      "Visitar los 4 pisos del edificio al menos una vez"],
    ["inquilino_de_honor",     "Inquilino de Honor",          "100 reservas"],
    ["el_mes_perfecto",        "El Mes Perfecto",             "Racha de 20 días consecutivos"],
    ["sin_fronteras",          "Sin Fronteras",               "Reservar en 3 pisos distintos en la misma semana, 3 veces"],
    ["planificador_de_elite",  "Planificador de Élite",       "Reservar con 5 o más días de anticipación, 10 veces"],
    ["el_edificio_es_mio",     "El Edificio es Mío",          "200 reservas"],
    ["la_leyenda_del_edificio","La Leyenda del Edificio",     "Racha de 50 días consecutivos"],
    ["el_dueno_del_edificio",  "El Dueño del Edificio",       "Visitar al menos una vez todos los espacios del edificio"],
  ]

  for (const [key, name, description] of updates) {
    await runStep(`Update badge: ${key}`, `
      UPDATE badges SET name = $2, description = $3 WHERE key = $1
    `, [key, name, description])
  }

  // 4. Insert new badges
  await runStep("Insert new badges", `
    INSERT INTO badges (key, name, description, tier) VALUES
      ('semana_completa', 'Semana Completa', 'Asistir los 5 días laborales en la misma semana',                               3),
      ('sin_faltas',      'Sin Faltas',      '20 asistencias sin ningún no-show en el historial',                             3),
      ('el_constante',    'El Constante',    'Al menos 1 asistencia por semana durante 12 semanas consecutivas',              4),
      ('imparable',       'Imparable',       'Racha de 30 días consecutivos',                                                 5),
      ('inmortal',        'Inmortal',        'Racha de 100 días consecutivos',                                                5)
    ON CONFLICT (key) DO NOTHING
  `)

  await pool.end()
  console.log("Badge redesign migration complete.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
