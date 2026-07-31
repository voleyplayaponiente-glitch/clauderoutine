/**
 * Parser del fichero bancario Norma 43 (Cuaderno 43 del CSB / AEB).
 * Formato de posiciones fijas. Se extraen cabecera de cuenta (registro 11),
 * movimientos (22) y conceptos complementarios (23).
 *
 * Convención de signo del registro 22: campo debe/haber → '1' adeudo (−),
 * '2' abono (+). Los importes vienen sin coma, con 2 decimales implícitos.
 */

export interface MovimientoN43 {
  fechaOperacion: string // yyyy-mm-dd
  fechaValor: string
  concepto: string
  importe: number // con signo
  referencia: string
}

export interface CuentaN43 {
  banco: string
  oficina: string
  cuenta: string
  fechaInicial: string
  fechaFinal: string
  saldoInicial: number
  movimientos: MovimientoN43[]
}

export interface ResultadoN43 {
  cuentas: CuentaN43[]
  errores: string[]
}

function fecha6(s: string): string {
  // YYMMDD → 20YY-MM-DD (asume siglo 2000).
  const yy = s.slice(0, 2)
  const mm = s.slice(2, 4)
  const dd = s.slice(4, 6)
  return `20${yy}-${mm}-${dd}`
}

function importe14(s: string, signo: string): number {
  const n = Number(s) / 100
  if (!Number.isFinite(n)) return 0
  return signo === '1' ? -n : n
}

export function parsearN43(texto: string): ResultadoN43 {
  const cuentas: CuentaN43[] = []
  const errores: string[] = []
  let actual: CuentaN43 | null = null
  let ultimoMov: MovimientoN43 | null = null

  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0)
  for (const [i, linea] of lineas.entries()) {
    const tipo = linea.slice(0, 2)
    try {
      if (tipo === '11') {
        actual = {
          banco: linea.slice(2, 6),
          oficina: linea.slice(6, 10),
          cuenta: linea.slice(10, 20),
          fechaInicial: fecha6(linea.slice(20, 26)),
          fechaFinal: fecha6(linea.slice(26, 32)),
          saldoInicial: importe14(linea.slice(33, 47), linea.slice(32, 33)),
          movimientos: [],
        }
        cuentas.push(actual)
        ultimoMov = null
      } else if (tipo === '22') {
        if (!actual) {
          errores.push(`Línea ${i + 1}: movimiento sin cabecera de cuenta`)
          continue
        }
        const mov: MovimientoN43 = {
          fechaOperacion: fecha6(linea.slice(6, 12)),
          fechaValor: fecha6(linea.slice(12, 18)),
          concepto: '',
          importe: importe14(linea.slice(24, 38), linea.slice(23, 24)),
          referencia: linea.slice(48, 60).trim(),
        }
        actual.movimientos.push(mov)
        ultimoMov = mov
      } else if (tipo === '23') {
        if (ultimoMov) {
          const extra = (linea.slice(4, 42) + ' ' + linea.slice(42, 80)).replace(/\s+/g, ' ').trim()
          ultimoMov.concepto = (ultimoMov.concepto + ' ' + extra).trim()
        }
      }
      // 33 (fin cuenta) y 88 (fin fichero) no requieren acción.
    } catch {
      errores.push(`Línea ${i + 1}: no se pudo interpretar`)
    }
  }
  return { cuentas, errores }
}
