// Tipos de dominio compartidos entre el proceso principal (Electron/SQLite)
// y la interfaz (React). Sin dependencias externas: son datos puros.

export type TipoTrabajador = 'ajena' | 'autonomo'
export type TipoContrato = 'indefinido' | 'temporal'

export type SituacionDia =
  | 'trabaja'
  | 'libre'
  | 'vacaciones'
  | 'baja'
  | 'festivo'
  | 'permiso'

export interface Empresa {
  id: number
  razon_social: string
  cif: string
  domicilio: string
  admin_nombre: string
  admin_nif: string
  sello_imagen: string | null // data URL (base64) del sello para los PDF
  creado_en: string
}

export interface Centro {
  id: number
  empresa_id: number
  codigo: string
  nombre: string
  provincia: string
  localidad: string
  direccion: string
  convenio: string
  horas_anuales_convenio: number
  // Horario por tipo de día. Tres bloques: lunes-a-sábado, domingos y festivos.
  abre_lunes_sabado: number // 0/1 (SQLite no tiene boolean)
  hora_apertura_ls: string // "10:00"
  hora_cierre_ls: string // "22:00"
  abre_domingos: number
  hora_apertura_dom: string
  hora_cierre_dom: string
  abre_festivos: number
  hora_apertura_fes: string
  hora_cierre_fes: string
  // Campos heredados (compatibilidad con datos antiguos; ya no se editan).
  hora_apertura: string
  hora_cierre: string
  abre_laborables: number
  abre_sabados: number
  color: string // hex, para el código de colores del cuadrante
  activo: number
}

export interface Festivo {
  id: number
  centro_id: number
  fecha: string // "aaaa-mm-dd"
  descripcion: string
}

export interface Trabajador {
  id: number
  empresa_id: number
  tipo: TipoTrabajador
  nombre: string
  apellidos: string
  dni_nie: string
  nss: string
  direccion: string
  telefono: string
  email: string
  iban: string
  categoria: string
  tipo_contrato: TipoContrato
  fecha_contrato_inicio: string | null
  fecha_contrato_fin: string | null
  fecha_alta: string | null
  fecha_baja: string | null
  fecha_fin_periodo_prueba: string | null
  horas_contrato_semanales: number
  horas_convenio_completa: number
  coef_parcialidad: number
  sueldo_convenio_completo: number // salario base según convenio (jornada completa)
  irpf: number
  vacaciones_anuales: number
  vacaciones_disfrutadas: number
  precio_hora_complementaria: number
  // Retribución (importes mensuales en €). Iguales para ajena y autónomo.
  plus_productividad: number
  prorrateo_pagas_extras: number
  retribucion_especie: number // en especie SUJETA a IRPF
  retribucion_especie_exenta: number // en especie EXENTA de IRPF (seguro de salud)
  deduccion_especie: number
  deduccion_seguro_salud: number
  observaciones: string
  activo: number
}

/** Relación trabajador ↔ centros donde puede trabajar. */
export interface TrabajadorCentro {
  id: number
  trabajador_id: number
  centro_id: number
  es_principal: number
}

export interface Cuadrante {
  id: number
  trabajador_id: number
  anio: number
  mes: number // 1-12
  fecha_entrega: string | null
  creado_en: string
}

export interface Turno {
  id: number
  cuadrante_id: number
  fecha: string // "aaaa-mm-dd"
  dia_semana: number // 0=domingo … 6=sábado
  situacion: SituacionDia
  centro_id: number | null
  entrada1: string | null // "HH:MM"
  salida1: string | null
  entrada2: string | null // segundo tramo (turno partido)
  salida2: string | null
  descanso_min: number // minutos de descanso a descontar
}

/** Resultado de operaciones que muestran un diálogo del sistema (export/backup). */
export type ResultadoOperacion = { ok: boolean; ruta?: string; error?: string }

// ---- Tipos "de entrada" para altas (sin id ni campos calculados) ----
export type NuevaEmpresa = Omit<Empresa, 'id' | 'creado_en'>
export type NuevoCentro = Omit<Centro, 'id'>
export type NuevoTrabajador = Omit<Trabajador, 'id'>
export type NuevoTurno = Omit<Turno, 'id'>
