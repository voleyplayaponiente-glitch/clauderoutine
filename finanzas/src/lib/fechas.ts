/** Utilidades de fecha en formato español. */

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** "2026-07-30" → "30/07/2026". */
export function formatearFecha(iso: string): string {
  if (!iso || iso.length < 10) return iso
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** Suma días a una fecha ISO. */
export function sumarDias(iso: string, dias: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "2026-07" → "julio 2026". */
export function nombreMes(aaaaMm: string): string {
  const [a, m] = aaaaMm.split('-')
  return `${MESES[Number(m) - 1]} ${a}`
}

export function mesDe(iso: string): string {
  return iso.slice(0, 7)
}
