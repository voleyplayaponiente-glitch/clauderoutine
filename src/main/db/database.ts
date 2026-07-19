import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema'

let db: Database.Database | null = null

/**
 * Carpeta de datos. La define el arranque:
 * - Electron: se fija GESTOR_DATA_DIR = app.getPath('userData').
 * - Servidor web/Docker: GESTOR_DATA_DIR = /datos (volumen) o ./datos por defecto.
 */
export function carpetaDatos(): string {
  return process.env.GESTOR_DATA_DIR || join(process.cwd(), 'datos')
}

export function rutaBaseDatos(): string {
  return join(carpetaDatos(), 'gestor-laboral.db')
}

export function getDb(): Database.Database {
  if (db) return db
  mkdirSync(carpetaDatos(), { recursive: true })
  db = new Database(rutaBaseDatos())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrar(db)
  return db
}

/** Añade una columna ignorando el error si ya existe (bases nuevas ya la tienen). */
function addColumn(d: Database.Database, tabla: string, definicion: string): void {
  try {
    d.exec(`ALTER TABLE ${tabla} ADD COLUMN ${definicion}`)
  } catch (e) {
    if (!String((e as Error).message).includes('duplicate column')) throw e
  }
}

function migrar(d: Database.Database): void {
  d.exec(SCHEMA_SQL)
  const version = (d.pragma('user_version', { simple: true }) as number) ?? 0

  if (version < 2) {
    // v2: horario del centro por tipo de día + campos de retribución del trabajador.
    addColumn(d, 'centro', 'abre_lunes_sabado INTEGER NOT NULL DEFAULT 1')
    addColumn(d, 'centro', "hora_apertura_ls TEXT NOT NULL DEFAULT '10:00'")
    addColumn(d, 'centro', "hora_cierre_ls TEXT NOT NULL DEFAULT '22:00'")
    addColumn(d, 'centro', "hora_apertura_dom TEXT NOT NULL DEFAULT '10:00'")
    addColumn(d, 'centro', "hora_cierre_dom TEXT NOT NULL DEFAULT '14:00'")
    addColumn(d, 'centro', "hora_apertura_fes TEXT NOT NULL DEFAULT '10:00'")
    addColumn(d, 'centro', "hora_cierre_fes TEXT NOT NULL DEFAULT '14:00'")
    // Traslada el horario único antiguo a los tres bloques nuevos.
    d.exec(`UPDATE centro SET
      hora_apertura_ls = hora_apertura, hora_cierre_ls = hora_cierre,
      hora_apertura_dom = hora_apertura, hora_cierre_dom = hora_cierre,
      hora_apertura_fes = hora_apertura, hora_cierre_fes = hora_cierre,
      abre_lunes_sabado = CASE WHEN abre_laborables = 1 OR abre_sabados = 1 THEN 1 ELSE 0 END`)

    addColumn(d, 'trabajador', 'plus_productividad REAL NOT NULL DEFAULT 0')
    addColumn(d, 'trabajador', 'prorrateo_pagas_extras REAL NOT NULL DEFAULT 0')
    addColumn(d, 'trabajador', 'retribucion_especie REAL NOT NULL DEFAULT 0')
    addColumn(d, 'trabajador', 'deduccion_especie REAL NOT NULL DEFAULT 0')
    addColumn(d, 'trabajador', 'deduccion_seguro_salud REAL NOT NULL DEFAULT 0')
  }

  if (version < 3) {
    // v3: retribución en especie exenta de IRPF (seguro de salud).
    addColumn(d, 'trabajador', 'retribucion_especie_exenta REAL NOT NULL DEFAULT 0')
  }

  if (version < 4) {
    // v4: código/nº de orden y plus de transporte.
    addColumn(d, 'trabajador', "codigo TEXT NOT NULL DEFAULT ''")
    addColumn(d, 'trabajador', 'plus_transporte REAL NOT NULL DEFAULT 0')
  }

  if (version < 5) {
    // v5: jornada completa semanal (para calcular el coeficiente de parcialidad).
    addColumn(d, 'trabajador', 'jornada_completa_semanal REAL NOT NULL DEFAULT 40')
  }

  if (version < 6) {
    // v6: color propio del trabajador para la agenda.
    addColumn(d, 'trabajador', "color TEXT NOT NULL DEFAULT ''")
  }

  if (version < SCHEMA_VERSION) d.pragma(`user_version = ${SCHEMA_VERSION}`)
}

/** Cierra la conexión (necesario antes de restaurar una copia). */
export function cerrarDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

/** Reabre la base de datos (tras una restauración de copia). */
export function reabrirDb(): Database.Database {
  cerrarDb()
  return getDb()
}
