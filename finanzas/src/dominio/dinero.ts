/**
 * Dinero. El importe se maneja internamente en CÉNTIMOS enteros para evitar
 * los errores de coma flotante que en contabilidad acaban en descuadre.
 * Un euro = 100 céntimos. Nada de `float` para dinero.
 */

/** Redondeo comercial a 2 decimales (mitad hacia arriba en valor absoluto). */
export function redondear2(euros: number): number {
  if (!Number.isFinite(euros)) throw new Error('Importe no finito')
  const signo = euros < 0 ? -1 : 1
  // +Number.EPSILON corrige casos como 1.005 que en binario cae por debajo.
  return signo * Math.round((Math.abs(euros) + Number.EPSILON) * 100) / 100
}

/** Euros (con decimales) → céntimos enteros. */
export function aCentimos(euros: number): number {
  if (!Number.isFinite(euros)) throw new Error('Importe no finito')
  const signo = euros < 0 ? -1 : 1
  return signo * Math.round((Math.abs(euros) + Number.EPSILON) * 100)
}

/** Céntimos enteros → euros. */
export function aEuros(centimos: number): number {
  return Math.trunc(centimos) / 100
}

/** Suma exacta de una lista de importes en euros (opera en céntimos). */
export function sumar(...euros: number[]): number {
  return aEuros(euros.reduce((acc, e) => acc + aCentimos(e), 0))
}

/** Resta exacta a − b en euros. */
export function restar(a: number, b: number): number {
  return aEuros(aCentimos(a) - aCentimos(b))
}

/**
 * Formatea un número al estilo español: punto de millar y coma decimal.
 * Implementado a mano para no depender de los datos de locale de Intl
 * (que en algunos runtimes de Node vienen recortados). Determinista y testeable.
 */
export function formatearNumeroEs(valor: number, decimales = 2): string {
  const negativo = valor < 0
  const fijo = Math.abs(valor).toFixed(decimales) // "1234.50"
  const [entera, decimal] = fijo.split('.')
  const conMillar = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const cuerpo = decimal ? `${conMillar},${decimal}` : conMillar
  return negativo ? `-${cuerpo}` : cuerpo
}

/**
 * Formato español con símbolo € detrás.
 * formatearEuro(1234.5) => "1.234,50 €"
 */
export function formatearEuro(
  euros: number,
  opts: { decimales?: number; conSimbolo?: boolean; signoMas?: boolean } = {},
): string {
  const { decimales = 2, conSimbolo = true, signoMas = false } = opts
  const valor = decimales === 2 ? redondear2(euros) : euros
  const txt = formatearNumeroEs(valor, decimales)
  const conSigno = signoMas && valor > 0 ? `+${txt}` : txt
  return conSimbolo ? `${conSigno} €` : conSigno
}

/** Porcentaje en formato español: 21 => "21 %", 12.5 => "12,5 %". */
export function formatearPorcentaje(pct: number, decimales = 0): string {
  // Sin ceros de más: 21 => "21", 12.5 => "12,5".
  const redondeado = Number(pct.toFixed(Math.max(decimales, 2)))
  const dec = Number.isInteger(redondeado) ? decimales : Math.max(decimales, 1)
  return `${formatearNumeroEs(redondeado, dec)} %`
}
