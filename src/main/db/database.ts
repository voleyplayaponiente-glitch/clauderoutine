import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema'

let db: Database.Database | null = null

export function rutaBaseDatos(): string {
  return join(app.getPath('userData'), 'gestor-laboral.db')
}

export function getDb(): Database.Database {
  if (db) return db
  db = new Database(rutaBaseDatos())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrar(db)
  return db
}

function migrar(d: Database.Database): void {
  d.exec(SCHEMA_SQL)
  const version = (d.pragma('user_version', { simple: true }) as number) ?? 0
  if (version < SCHEMA_VERSION) {
    // Futuras migraciones incrementales irían aquí, por versión.
    d.pragma(`user_version = ${SCHEMA_VERSION}`)
  }
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
