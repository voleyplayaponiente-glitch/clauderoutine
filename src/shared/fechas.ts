// Utilidades de fecha/hora puras. Formato español dd/mm/aaaa y horas HH:MM.
// El almacenamiento interno usa ISO "aaaa-mm-dd" para ordenar y comparar bien.

export const DIAS_SEMANA = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado'
] as const

export const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const

export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
] as const

/** ISO "aaaa-mm-dd" → "dd/mm/aaaa". */
export function isoALocal(iso: string): string {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  if (!a || !m || !d) return iso
  return `${d}/${m}/${a}`
}

/** "dd/mm/aaaa" → ISO "aaaa-mm-dd" (o null si no es válido). */
export function localAIso(local: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(local.trim())
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** Días naturales de un mes (mes 1-12). */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate()
}

/** Día de la semana (0=domingo … 6=sábado) de una fecha aaaa-mm-dd. */
export function diaSemanaIso(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).getDay()
}

/** Genera todas las fechas ISO de un mes. */
export function fechasDelMes(anio: number, mes: number): string[] {
  const total = diasDelMes(anio, mes)
  const mm = String(mes).padStart(2, '0')
  const out: string[] = []
  for (let d = 1; d <= total; d++) {
    out.push(`${anio}-${mm}-${String(d).padStart(2, '0')}`)
  }
  return out
}

/** "HH:MM" → minutos desde medianoche (o null). */
export function horaAMinutos(hora: string | null): number | null {
  if (!hora) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

/** Minutos desde medianoche → "HH:MM". */
export function minutosAHora(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Horas decimales → "Xh YYm" legible, o con coma decimal si se pide. */
export function horasLegible(horas: number): string {
  const totalMin = Math.round(horas * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/** Número con coma decimal (formato español). */
export function numEs(n: number, decimales = 2): string {
  return n.toLocaleString('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  })
}

/** Euros con coma decimal y símbolo. */
export function euros(n: number): string {
  return `${numEs(n)} €`
}

/** Diferencia en días entre dos fechas ISO (b - a). */
export function diasEntre(aIso: string, bIso: string): number {
  const [a1, a2, a3] = aIso.split('-').map(Number)
  const [b1, b2, b3] = bIso.split('-').map(Number)
  const a = Date.UTC(a1, a2 - 1, a3)
  const b = Date.UTC(b1, b2 - 1, b3)
  return Math.round((b - a) / 86400000)
}

/** Fecha de hoy en ISO. */
export function hoyIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}
