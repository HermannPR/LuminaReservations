import { Pool } from "pg"
import * as dotenv from "dotenv"
dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function runStep(label: string, sql: string) {
  const client = await pool.connect()
  try {
    await client.query("SET LOCAL statement_timeout = 0")
    await client.query(sql)
    console.log(`✓ ${label}`)
  } finally {
    client.release()
  }
}

async function main() {
  await runStep("Create user_streaks", `
    CREATE TABLE IF NOT EXISTS user_streaks (
      user_id            INTEGER PRIMARY KEY REFERENCES users(id),
      current_streak     INTEGER NOT NULL DEFAULT 0,
      longest_streak     INTEGER NOT NULL DEFAULT 0,
      last_check_in_date DATE,
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await runStep("Create badges", `
    CREATE TABLE IF NOT EXISTS badges (
      id          SERIAL PRIMARY KEY,
      key         VARCHAR(64) UNIQUE NOT NULL,
      name        VARCHAR(128) NOT NULL,
      description TEXT NOT NULL,
      tier        INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5)
    )
  `)

  await runStep("Create user_badges", `
    CREATE TABLE IF NOT EXISTS user_badges (
      user_id    INTEGER NOT NULL REFERENCES users(id),
      badge_id   INTEGER NOT NULL REFERENCES badges(id),
      earned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, badge_id)
    )
  `)

  await runStep("Index user_badges_user", `
    CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id)
  `)

  await runStep("Seed badges", `
    INSERT INTO badges (key, name, description, tier) VALUES
      ('bienvenido_colega',       'Bienvenido, Colega',          'Realiza tu primera reserva',                                                          1),
      ('cafecito_en_la_mano',     'Cafecito en la Mano',         '5 reservas totales',                                                                  1),
      ('diez_de_diez',            'Diez de Diez',                '10 check-ins exitosos acumulados',                                                    1),
      ('criatura_de_habitos',     'Criatura de Hábitos',         'Racha de 5 días con check-in',                                                        1),
      ('ya_me_ubico',             'Ya Me Ubico',                 '20 reservas totales',                                                                 2),
      ('la_misma_silla',          'La Misma Silla de Siempre',   'Reservar el mismo espacio con check-in 10 veces',                                     2),
      ('el_madrugador',           'El Madrugador',               'Check-in antes de las 8:00 AM en hora local, 5 veces',                                2),
      ('velocista',               'Velocista',                   'Check-in dentro de los primeros 3 minutos del inicio de la reserva, 10 veces',        2),
      ('asiduo_del_edificio',     'Asiduo del Edificio',         '50 reservas totales',                                                                 3),
      ('racha_de_acero',          'Racha de Acero',              'Racha de 15 días con check-in',                                                       3),
      ('ciudadano_del_edificio',  'Ciudadano del Edificio',      'Reservar en los 4 pisos del edificio al menos una vez cada uno',                      3),
      ('coleccionista_espacios',  'Coleccionista de Espacios',   'Reservar los 5 tipos de espacio al menos una vez cada uno',                           3),
      ('al_filo_navaja',          'Al Filo de la Navaja',        'Check-in en los últimos 2 minutos del periodo de gracia, 5 veces',                    3),
      ('lunes_de_leyenda',        'Lunes de Leyenda',            'Check-in todos los lunes durante 4 semanas consecutivas',                             3),
      ('inquilino_de_honor',      'Inquilino de Honor',          '100 reservas totales',                                                                4),
      ('el_centurion',            'El Centurión',                '100 check-ins exitosos acumulados',                                                   4),
      ('el_mes_perfecto',         'El Mes Perfecto',             'Racha de 20 días con check-in',                                                       4),
      ('sin_fronteras',           'Sin Fronteras',               'Reservar en 3 pisos distintos en la misma semana, logrado 3 veces',                   4),
      ('valet_ejecutivo',         'Valet Ejecutivo',             'Estacionamiento asignado exitosamente 15 veces',                                      4),
      ('planificador_de_elite',   'Planificador de Élite',       'Reservar con 5 o más días de anticipación, 10 veces',                                 4),
      ('el_edificio_es_mio',      'El Edificio es Mío',          '200 reservas totales',                                                                5),
      ('la_leyenda_del_edificio', 'La Leyenda del Edificio',     'Racha de 50 días con check-in',                                                       5),
      ('el_fantasma_redimido',    'El Fantasma Redimido',        '2 o más no-shows en historial y luego racha de 10 check-ins consecutivos',            5),
      ('el_dueno_del_edificio',   'El Dueño del Edificio',       'Reservar cada tipo de espacio en cada piso disponible del edificio',                  5)
    ON CONFLICT (key) DO NOTHING
  `)

  await pool.end()
  console.log("Migration complete.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
