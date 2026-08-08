/**
 * Parser del fichero bancario Norma 43 (Cuaderno 43 del CSB / AEB).
 *
 * Formato de posiciones fijas, registros de 80 caracteres. Las posiciones de
 * abajo están en la numeración de la norma (empezando en 1); en el código se
 * restan al pasar a `slice`, que empieza en 0.
 *
 * Registro 11 — cabecera de cuenta
 *   3-6 entidad · 7-10 oficina · 11-20 cuenta · 21-26 fecha inicial
 *   27-32 fecha final · 33 debe/haber · 34-47 saldo inicial · 48-50 divisa
 *   52-77 nombre abreviado
 *
 * Registro 22 — movimiento
 *   3-6 libre · 7-10 oficina origen · 11-16 fecha operación · 17-22 fecha valor
 *   23-24 concepto común · 25-27 concepto propio · 28 debe/haber
 *   29-42 importe · 43-52 nº documento · 53-64 referencia 1 · 65-80 referencia 2
 *
 * Registro 23 — concepto complementario
 *   3-4 código de dato · 5-42 concepto · 43-80 concepto
 *
 * Registro 33 — fin de cuenta
 *   21-25 nº de apuntes · 26-39 total debe · 40-53 total haber
 *   54 debe/haber del saldo final · 55-68 saldo final
 *
 * Signo: clave debe/haber '1' = adeudo (−), '2' = abono (+). Los importes van
 * sin coma, con dos decimales implícitos (céntimos).
 */

export interface MovimientoN43 {
  fechaOperacion: string // yyyy-mm-dd
  fechaValor: string
  concepto: string
  importe: number // con signo
  referencia: string
  documento: string
}

export interface CuentaN43 {
  banco: string
  oficina: string
  cuenta: string
  fechaInicial: string
  fechaFinal: string
  saldoInicial: number
  saldoFinal?: number
  /** Nº de apuntes declarado en el registro 33 de fin de cuenta. */
  apuntesDeclarados?: number
  movimientos: MovimientoN43[]
}

export interface ResultadoN43 {
  cuentas: CuentaN43[]
  errores: string[]
}

/**
 * Descripción del «concepto común» (posiciones 23-24). Se usa cuando el fichero
 * no trae registros 23, para que el movimiento no quede sin texto.
 */
export const CONCEPTO_COMUN: Record<string, string> = {
  '01': 'Talones / reintegros',
  '02': 'Abonarés / entregas / ingresos',
  '03': 'Domiciliaciones / recibos / letras',
  '04': 'Giros / transferencias / traspasos / cheques',
  '05': 'Amortización de préstamos o créditos',
  '06': 'Remesas de efectos',
  '07': 'Suscripciones / dividendos pasivos / canjes',
  '08': 'Dividendos / retribuciones / liquidaciones',
  '09': 'Compraventa de valores',
  '10': 'Cheques gasolina',
  '11': 'Cajero automático',
  '12': 'Tarjetas de crédito o débito',
  '13': 'Operaciones con el extranjero',
  '14': 'Devoluciones e impagados',
  '15': 'Nóminas y seguros sociales',
  '16': 'Timbres / corretaje / póliza',
  '17': 'Intereses, comisiones, gastos e impuestos',
  '98': 'Anulaciones y correcciones de asiento',
  '99': 'Varios',
}

/** YYMMDD → yyyy-mm-dd. Devuelve undefined si la fecha no es válida. */
export function fecha6(s: string): string | undefined {
  if (!/^\d{6}$/.test(s)) return undefined
  const yy = Number(s.slice(0, 2))
  const mm = Number(s.slice(2, 4))
  const dd = Number(s.slice(4, 6))
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined
  // Ventana de siglo: los ficheros bancarios no traen extractos del siglo XX.
  const anio = 2000 + yy
  const iso = `${anio}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  // Descarta 31 de febrero y similares.
  const d = new Date(`${iso}T00:00:00Z`)
  if (d.getUTCMonth() + 1 !== mm || d.getUTCDate() !== dd) return undefined
  return iso
}

/** 14 dígitos en céntimos + clave debe/haber → euros con signo. */
export function importe14(s: string, signo: string): number | undefined {
  if (!/^\d+$/.test(s.trim())) return undefined
  const n = Number(s) / 100
  if (!Number.isFinite(n)) return undefined
  return signo === '1' ? -n : n
}

/**
 * Separa el fichero en registros. Admite saltos de línea (lo habitual) y
 * también ficheros de una sola tirada, troceándolos de 80 en 80.
 */
export function separarRegistros(texto: string): string[] {
  const limpio = texto.replace(/\r/g, '')
  const porLineas = limpio.split('\n').filter((l) => l.trim().length > 0)
  if (porLineas.length > 1) return porLineas

  const seguido = limpio.replace(/\n/g, '')
  if (seguido.length >= 160 && seguido.length % 80 === 0) {
    const trozos: string[] = []
    for (let i = 0; i < seguido.length; i += 80) trozos.push(seguido.slice(i, i + 80))
    return trozos
  }
  return porLineas
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100
}

export function parsearN43(texto: string): ResultadoN43 {
  const cuentas: CuentaN43[] = []
  const errores: string[] = []
  let actual: CuentaN43 | null = null
  let ultimoMov: MovimientoN43 | null = null

  const registros = separarRegistros(texto)
  for (const [i, registro] of registros.entries()) {
    // Los bancos rellenan a 80 con espacios; algunos recortan la cola.
    const linea = registro.padEnd(80, ' ')
    const n = i + 1
    const tipo = linea.slice(0, 2)

    if (tipo === '11') {
      const fi = fecha6(linea.slice(20, 26))
      const ff = fecha6(linea.slice(26, 32))
      const saldo = importe14(linea.slice(33, 47), linea.slice(32, 33))
      if (saldo === undefined) errores.push(`Línea ${n}: el saldo inicial de la cuenta no es un importe válido`)
      actual = {
        banco: linea.slice(2, 6).trim(),
        oficina: linea.slice(6, 10).trim(),
        cuenta: linea.slice(10, 20).trim(),
        fechaInicial: fi ?? '',
        fechaFinal: ff ?? '',
        saldoInicial: saldo ?? 0,
        movimientos: [],
      }
      if (!fi || !ff) errores.push(`Línea ${n}: las fechas del extracto no son válidas`)
      cuentas.push(actual)
      ultimoMov = null
    } else if (tipo === '22') {
      if (!actual) {
        errores.push(`Línea ${n}: hay un movimiento antes de la cabecera de cuenta`)
        continue
      }
      const fOp = fecha6(linea.slice(10, 16))
      const fVal = fecha6(linea.slice(16, 22))
      const importe = importe14(linea.slice(28, 42), linea.slice(27, 28))

      if (!fOp) {
        errores.push(`Línea ${n}: fecha de operación ilegible ("${linea.slice(10, 16)}"); el movimiento se descarta`)
        continue
      }
      if (importe === undefined) {
        errores.push(`Línea ${n}: importe ilegible ("${linea.slice(28, 42)}"); el movimiento se descarta`)
        continue
      }

      const comun = linea.slice(22, 24)
      const mov: MovimientoN43 = {
        fechaOperacion: fOp,
        fechaValor: fVal ?? fOp,
        concepto: '',
        importe,
        referencia: linea.slice(52, 64).trim(),
        documento: linea.slice(42, 52).trim(),
      }
      actual.movimientos.push(mov)
      ultimoMov = mov
      // Se guarda para usarlo solo si no llega ningún registro 23.
      ;(mov as MovimientoN43 & { _comun?: string })._comun = CONCEPTO_COMUN[comun] ?? ''
    } else if (tipo === '23') {
      if (ultimoMov) {
        const extra = `${linea.slice(4, 42)} ${linea.slice(42, 80)}`.replace(/\s+/g, ' ').trim()
        if (extra !== '') ultimoMov.concepto = `${ultimoMov.concepto} ${extra}`.trim()
      }
    } else if (tipo === '33') {
      if (!actual) continue
      const apuntes = Number(linea.slice(20, 25))
      const totalDebe = importe14(linea.slice(25, 39), '2')
      const totalHaber = importe14(linea.slice(39, 53), '2')
      const saldoFinal = importe14(linea.slice(54, 68), linea.slice(53, 54))
      if (Number.isFinite(apuntes)) actual.apuntesDeclarados = apuntes
      if (saldoFinal !== undefined) actual.saldoFinal = saldoFinal

      // Comprobaciones de integridad: si el fichero no cuadra hay que decirlo,
      // nunca dar por buenos unos movimientos que no suman lo que el banco dice.
      if (Number.isFinite(apuntes) && apuntes !== actual.movimientos.length) {
        errores.push(
          `Cuenta ${actual.cuenta}: el fichero declara ${apuntes} apuntes y se han leído ${actual.movimientos.length}`,
        )
      }
      if (saldoFinal !== undefined && totalDebe !== undefined && totalHaber !== undefined) {
        const esperado = redondear2(actual.saldoInicial - totalDebe + totalHaber)
        if (Math.abs(esperado - saldoFinal) > 0.005) {
          errores.push(
            `Cuenta ${actual.cuenta}: el saldo final del fichero (${saldoFinal}) no cuadra con saldo inicial y movimientos (${esperado})`,
          )
        }
      }
    }
    // 88 (fin de fichero) no requiere acción.
  }

  // Los movimientos sin registro 23 se quedan con la glosa del concepto común.
  for (const c of cuentas) {
    for (const m of c.movimientos) {
      const conComun = m as MovimientoN43 & { _comun?: string }
      if (m.concepto === '') m.concepto = conComun._comun || 'Movimiento bancario'
      delete conComun._comun
    }
  }

  return { cuentas, errores }
}
