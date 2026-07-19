// Esquema de la base de datos SQLite. Versionado sencillo por PRAGMA user_version.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS empresa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  razon_social TEXT NOT NULL,
  cif TEXT NOT NULL DEFAULT '',
  domicilio TEXT NOT NULL DEFAULT '',
  admin_nombre TEXT NOT NULL DEFAULT '',
  admin_nif TEXT NOT NULL DEFAULT '',
  sello_imagen TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS centro (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  provincia TEXT NOT NULL DEFAULT '',
  localidad TEXT NOT NULL DEFAULT '',
  direccion TEXT NOT NULL DEFAULT '',
  convenio TEXT NOT NULL DEFAULT '',
  horas_anuales_convenio REAL NOT NULL DEFAULT 1768,
  hora_apertura TEXT NOT NULL DEFAULT '10:00',
  hora_cierre TEXT NOT NULL DEFAULT '22:00',
  abre_laborables INTEGER NOT NULL DEFAULT 1,
  abre_sabados INTEGER NOT NULL DEFAULT 1,
  abre_lunes_sabado INTEGER NOT NULL DEFAULT 1,
  hora_apertura_ls TEXT NOT NULL DEFAULT '10:00',
  hora_cierre_ls TEXT NOT NULL DEFAULT '22:00',
  abre_domingos INTEGER NOT NULL DEFAULT 0,
  hora_apertura_dom TEXT NOT NULL DEFAULT '10:00',
  hora_cierre_dom TEXT NOT NULL DEFAULT '14:00',
  abre_festivos INTEGER NOT NULL DEFAULT 0,
  hora_apertura_fes TEXT NOT NULL DEFAULT '10:00',
  hora_cierre_fes TEXT NOT NULL DEFAULT '14:00',
  color TEXT NOT NULL DEFAULT '#3b82f6',
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS festivo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  centro_id INTEGER NOT NULL REFERENCES centro(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS trabajador (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'ajena',
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL DEFAULT '',
  dni_nie TEXT NOT NULL DEFAULT '',
  nss TEXT NOT NULL DEFAULT '',
  direccion TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  iban TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT '',
  tipo_contrato TEXT NOT NULL DEFAULT 'indefinido',
  fecha_contrato_inicio TEXT,
  fecha_contrato_fin TEXT,
  fecha_alta TEXT,
  fecha_baja TEXT,
  fecha_fin_periodo_prueba TEXT,
  horas_contrato_semanales REAL NOT NULL DEFAULT 40,
  jornada_completa_semanal REAL NOT NULL DEFAULT 40,
  horas_convenio_completa REAL NOT NULL DEFAULT 1768,
  coef_parcialidad REAL NOT NULL DEFAULT 1,
  sueldo_convenio_completo REAL NOT NULL DEFAULT 0,
  irpf REAL NOT NULL DEFAULT 0,
  vacaciones_anuales REAL NOT NULL DEFAULT 30,
  vacaciones_disfrutadas REAL NOT NULL DEFAULT 0,
  precio_hora_complementaria REAL NOT NULL DEFAULT 0,
  plus_productividad REAL NOT NULL DEFAULT 0,
  plus_transporte REAL NOT NULL DEFAULT 0,
  prorrateo_pagas_extras REAL NOT NULL DEFAULT 0,
  retribucion_especie REAL NOT NULL DEFAULT 0,
  retribucion_especie_exenta REAL NOT NULL DEFAULT 0,
  deduccion_especie REAL NOT NULL DEFAULT 0,
  deduccion_seguro_salud REAL NOT NULL DEFAULT 0,
  observaciones TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS trabajador_centro (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trabajador_id INTEGER NOT NULL REFERENCES trabajador(id) ON DELETE CASCADE,
  centro_id INTEGER NOT NULL REFERENCES centro(id) ON DELETE CASCADE,
  es_principal INTEGER NOT NULL DEFAULT 0,
  UNIQUE(trabajador_id, centro_id)
);

CREATE TABLE IF NOT EXISTS cuadrante (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trabajador_id INTEGER NOT NULL REFERENCES trabajador(id) ON DELETE CASCADE,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  fecha_entrega TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(trabajador_id, anio, mes)
);

CREATE TABLE IF NOT EXISTS turno (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cuadrante_id INTEGER NOT NULL REFERENCES cuadrante(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  dia_semana INTEGER NOT NULL,
  situacion TEXT NOT NULL DEFAULT 'libre',
  centro_id INTEGER REFERENCES centro(id) ON DELETE SET NULL,
  entrada1 TEXT,
  salida1 TEXT,
  entrada2 TEXT,
  salida2 TEXT,
  descanso_min INTEGER NOT NULL DEFAULT 0,
  UNIQUE(cuadrante_id, fecha)
);

CREATE TABLE IF NOT EXISTS vacacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trabajador_id INTEGER NOT NULL REFERENCES trabajador(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  UNIQUE(trabajador_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_vacacion_trab ON vacacion(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_centro_empresa ON centro(empresa_id);
CREATE INDEX IF NOT EXISTS idx_trabajador_empresa ON trabajador(empresa_id);
CREATE INDEX IF NOT EXISTS idx_turno_cuadrante ON turno(cuadrante_id);
CREATE INDEX IF NOT EXISTS idx_cuadrante_trab ON cuadrante(trabajador_id, anio, mes);
CREATE INDEX IF NOT EXISTS idx_festivo_centro ON festivo(centro_id);
`

export const SCHEMA_VERSION = 6
