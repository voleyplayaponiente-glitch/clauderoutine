/**
 * Conciliación bancaria semiautomática. Empareja líneas del extracto con
 * movimientos ya registrados por importe (exacto) + fecha (con tolerancia) +
 * concepto (similitud), devolviendo sugerencias ordenadas por probabilidad.
 */
import { aCentimos } from './dinero'

export interface Emparejable {
  id: string
  fecha: string // yyyy-mm-dd
  concepto: string
  importe: number
}

function diasEntre(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.abs(Math.round((da - db) / 86400000))
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

function similitudConcepto(a: string, b: string): number {
  const ta = new Set(tokens(a))
  const tb = new Set(tokens(b))
  if (ta.size === 0 || tb.size === 0) return 0
  let comunes = 0
  for (const t of ta) if (tb.has(t)) comunes++
  return comunes / Math.max(ta.size, tb.size)
}

/**
 * Puntúa un emparejamiento (0..1). El importe debe coincidir al céntimo;
 * si no, el score es 0 (no se sugiere).
 */
export function puntuar(a: Emparejable, b: Emparejable, tolDias = 3): number {
  if (aCentimos(a.importe) !== aCentimos(b.importe)) return 0
  const dias = diasEntre(a.fecha, b.fecha)
  if (dias > tolDias) return 0.6 // importe exacto pero fuera de fecha: sugerencia débil
  const proximidad = 1 - dias / (tolDias + 1) // 1 mismo día → 0 en el límite
  const concepto = similitudConcepto(a.concepto, b.concepto)
  return 0.6 + 0.25 * proximidad + 0.15 * concepto
}

export interface Sugerencia {
  extracto: Emparejable
  candidato: Emparejable
  score: number
}

/** Para cada línea del extracto, la mejor sugerencia de candidato (si supera 0). */
export function sugerencias(
  extracto: Emparejable[],
  candidatos: Emparejable[],
  tolDias = 3,
): Sugerencia[] {
  const usados = new Set<string>()
  const salida: Sugerencia[] = []
  // Ordena por mejor match global para no “robar” candidatos entre líneas.
  const todas: Sugerencia[] = []
  for (const e of extracto) {
    for (const c of candidatos) {
      const score = puntuar(e, c, tolDias)
      if (score > 0) todas.push({ extracto: e, candidato: c, score })
    }
  }
  todas.sort((x, y) => y.score - x.score)
  const extractoUsado = new Set<string>()
  for (const s of todas) {
    if (usados.has(s.candidato.id) || extractoUsado.has(s.extracto.id)) continue
    usados.add(s.candidato.id)
    extractoUsado.add(s.extracto.id)
    salida.push(s)
  }
  return salida
}
