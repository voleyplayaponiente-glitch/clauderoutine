import { parsearImporte, type Centimos } from '../dinero.js'
import type { FechaISO } from '../fechas.js'
import { type ApunteExtraido, type LecturaExtracto, ponerHuellas } from './apuntes.js'
import { leerFecha } from './fechas-texto.js'
import { buscarIban, enmascararSensibles } from './sensibles.js'

/** Una celda tal como la devuelve un lector de hoja de cálculo. */
export type Celda = string | number | boolean | Date | null | undefined

/**
 * Leer una tabla de movimientos.
 *
 * Esto vale para el `.xlsx` del BBVA, para el `.xls` antiguo de otro banco y
 * para un CSV, porque los tres acaban siendo la misma cuadrícula. Lo que
 * cambia entre bancos —y cambia siempre— es dónde empieza la tabla y cómo se
 * llaman las columnas, así que nada de posiciones fijas: se busca la fila de
 * cabecera y se traduce por nombre.
 *
 * Los dos extractos reales que se usaron para escribirlo empiezan en la fila 5
 * y en la 8 respectivamente, y uno de ellos deja la columna A vacía. Un lector
 * que diera por hecho «cabecera en la fila 1, columna A» habría fallado con
 * los dos.
 */

type Papel =
  | 'fecha'
  | 'fechaValor'
  | 'concepto'
  | 'detalle'
  | 'importe'
  | 'debe'
  | 'haber'
  | 'saldo'
  | 'divisa'

/** Sinónimos por papel. El orden importa: gana la coincidencia más larga, para
 *  que «fecha valor» no se lleve la columna de «fecha». */
const NOMBRES: [Papel, string[]][] = [
  ['fechaValor', ['fecha valor', 'f valor', 'fvalor', 'f. valor', 'valor', 'data valor']],
  ['fecha', ['fecha operacion', 'fecha de operacion', 'f operacion', 'fecha contable', 'fecha', 'data']],
  ['concepto', ['concepto', 'descripcion', 'operacion', 'movimiento', 'detalle', 'texto']],
  ['detalle', ['observaciones', 'mas datos', 'referencia', 'concepto ampliado', 'beneficiario ordenante']],
  ['importe', ['importe eur', 'importe', 'cantidad', 'monto', 'euros']],
  ['debe', ['debe', 'cargo', 'cargos', 'salida']],
  ['haber', ['haber', 'abono', 'abonos', 'entrada', 'ingreso']],
  ['saldo', ['saldo posterior', 'saldo', 'disponible']],
  ['divisa', ['divisa', 'moneda']],
]

function texto(celda: Celda): string {
  if (celda == null) return ''
  if (celda instanceof Date) return celda.toISOString().slice(0, 10)
  return String(celda).trim()
}

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function papelDe(cabecera: string): Papel | null {
  const limpia = normalizar(cabecera)
  if (limpia === '') return null
  let mejor: { papel: Papel; largo: number } | null = null
  for (const [papel, sinonimos] of NOMBRES) {
    for (const sinonimo of sinonimos) {
      if (limpia === sinonimo || limpia.startsWith(`${sinonimo} `) || limpia.endsWith(` ${sinonimo}`)) {
        if (!mejor || sinonimo.length > mejor.largo) mejor = { papel, largo: sinonimo.length }
      }
    }
  }
  return mejor?.papel ?? null
}

interface Cabecera {
  fila: number
  columnas: Map<Papel, number>
  /** Todas las columnas que aportan texto al concepto, en orden de aparición.
   *  El BBVA reparte la descripción entre «Concepto», «Movimiento» y
   *  «Observaciones»; quedarse solo con la primera pierde justo el trozo que
   *  dice de qué era la transferencia. */
  descripcion: number[]
}

/** Busca la fila que hace de cabecera. Se exige fecha + algo con dinero: sin
 *  eso no es una tabla de movimientos aunque tenga palabras que lo parezcan. */
function buscarCabecera(filas: Celda[][]): Cabecera | null {
  const limite = Math.min(filas.length, 40)
  let mejor: Cabecera | null = null
  let mejorPuntos = 0

  for (let f = 0; f < limite; f++) {
    const columnas = new Map<Papel, number>()
    const descripcion: number[] = []
    const fila = filas[f] ?? []
    for (let c = 0; c < fila.length; c++) {
      const papel = papelDe(texto(fila[c]))
      if (!papel) continue
      if (papel === 'concepto' || papel === 'detalle') descripcion.push(c)
      // El primero gana: si hay dos columnas «Divisa» (las hay), la de al lado
      // del importe es la que vale.
      if (!columnas.has(papel)) columnas.set(papel, c)
    }
    const tieneFecha = columnas.has('fecha') || columnas.has('fechaValor')
    const tieneDinero = columnas.has('importe') || (columnas.has('debe') && columnas.has('haber'))
    if (!tieneFecha || !tieneDinero) continue
    const puntos = columnas.size
    if (puntos > mejorPuntos) {
      mejorPuntos = puntos
      mejor = { fila: f, columnas, descripcion }
    }
  }
  return mejor
}

function celdaImporte(celda: Celda): Centimos | null {
  if (typeof celda === 'number') {
    if (!Number.isFinite(celda)) return null
    // Los euros llegan como número con decimales; se pasan a céntimos aquí y no
    // antes, porque `parsearImporte` solo entiende texto.
    return Math.round(celda * 100)
  }
  const valor = texto(celda)
  return valor === '' ? null : parsearImporte(valor)
}

/** Junta concepto y detalle sin repetir: los bancos suelen escribir lo mismo en
 *  dos columnas («Movimiento» y «Observaciones» del BBVA son idénticas). */
function componerConcepto(partes: string[]): string {
  const limpias: string[] = []
  for (const parte of partes) {
    const valor = parte.trim()
    if (valor === '') continue
    if (limpias.some((y) => normalizar(y) === normalizar(valor))) continue
    limpias.push(valor)
  }
  return limpias.join(' · ')
}

export function leerTablaDeApuntes(filas: Celda[][]): LecturaExtracto {
  const avisos: string[] = []
  const cabecera = buscarCabecera(filas)
  if (!cabecera) {
    return {
      apuntes: [],
      cuenta: leerCabeceraLibre(filas, filas.length),
      avisos: [
        'No he encontrado la fila de cabecera con las columnas de fecha e importe. ' +
          'Comprueba que es el fichero de movimientos y no un resumen.',
      ],
    }
  }

  const { columnas } = cabecera
  const sinHuella: Omit<ApunteExtraido, 'huella'>[] = []
  let saltadas = 0

  for (let f = cabecera.fila + 1; f < filas.length; f++) {
    const fila = filas[f] ?? []
    const vacia = fila.every((c) => texto(c) === '')
    if (vacia) continue

    const columnaFecha = columnas.get('fecha') ?? columnas.get('fechaValor')!
    const fecha = leerFecha(fila[columnaFecha] ?? null)

    let importe: Centimos | null = null
    if (columnas.has('importe')) {
      importe = celdaImporte(fila[columnas.get('importe')!])
    } else {
      const debe = celdaImporte(fila[columnas.get('debe')!])
      const haber = celdaImporte(fila[columnas.get('haber')!])
      // Debe y haber vienen en positivo; el signo lo pone la columna.
      if (debe) importe = -Math.abs(debe)
      else if (haber) importe = Math.abs(haber)
    }

    if (!fecha || importe === null) {
      // Los totales de pie de tabla («TOTAL … 1.234,56») caen aquí y está bien
      // que caigan; se cuentan para poder decirlo.
      saltadas++
      continue
    }
    if (importe === 0) {
      saltadas++
      continue
    }

    const bruto = componerConcepto(cabecera.descripcion.map((c) => texto(fila[c])))
    const { texto: concepto, tarjetas } = enmascararSensibles(bruto)

    const fechaValor = columnas.has('fechaValor')
      ? leerFecha(fila[columnas.get('fechaValor')!] ?? null)
      : null
    const saldo = columnas.has('saldo') ? celdaImporte(fila[columnas.get('saldo')!]) : null
    const divisa = texto(fila[columnas.get('divisa') ?? -1]).toUpperCase()

    sinHuella.push({
      fecha,
      ...(fechaValor && fechaValor !== fecha ? { fechaValor } : {}),
      concepto: concepto || 'Movimiento sin concepto',
      importe,
      ...(saldo !== null ? { saldo } : {}),
      divisa: /^[A-Z]{3}$/.test(divisa) ? divisa : 'EUR',
      origen: f + 1,
      ...(tarjetas[0] ? { tarjeta: tarjetas[0] } : {}),
    })
  }

  if (saltadas > 0) {
    avisos.push(
      `He dejado fuera ${saltadas} fila${saltadas === 1 ? '' : 's'} sin fecha o sin importe ` +
        '(suelen ser totales o filas de adorno).',
    )
  }
  if (sinHuella.length === 0) {
    avisos.push('La tabla tenía cabecera pero ninguna fila con fecha e importe.')
  }

  const apuntes = ponerHuellas(sinHuella)
  const fechas = apuntes.map((a) => a.fecha).sort()

  return {
    apuntes,
    cuenta: leerCabeceraLibre(filas, cabecera.fila),
    ...(fechas.length > 0 ? { desde: fechas[0] as FechaISO, hasta: fechas[fechas.length - 1] as FechaISO } : {}),
    avisos,
  }
}

/**
 * Lo que hay por encima de la tabla: titular, IBAN, saldo. No sigue ningún
 * estándar, así que se rastrea por etiquetas sueltas y se acepta no
 * encontrarlo.
 *
 * Se mira la celda de al lado **y la de debajo**: uno de los dos extractos
 * reales pone «Titular» en una fila y el nombre en la siguiente, así que
 * buscar solo a la derecha devolvía la etiqueta de la columna vecina.
 */
function leerCabeceraLibre(filas: Celda[][], hasta: number): LecturaExtracto['cuenta'] {
  const limite = Math.min(hasta, 40)
  const cuenta: LecturaExtracto['cuenta'] = {}

  const todo: string[] = []
  for (let f = 0; f < limite; f++) {
    for (const celda of filas[f] ?? []) {
      const valor = texto(celda)
      if (valor !== '') todo.push(valor)
    }
  }
  const iban = buscarIban(todo.join('\n'))
  if (iban) cuenta.ibanUltimos4 = iban.slice(-4)

  for (let f = 0; f < limite; f++) {
    const fila = filas[f] ?? []
    for (let c = 0; c < fila.length; c++) {
      const etiqueta = normalizar(texto(fila[c])).replace(/:$/, '')
      if (etiqueta !== 'titular' && etiqueta !== 'titulares' && etiqueta !== 'saldo') continue

      const candidatos = [texto(fila[c + 1]), texto((filas[f + 1] ?? [])[c])].filter((v) => v !== '')
      for (const valor of candidatos) {
        if (etiqueta === 'saldo') {
          const saldo = parsearImporte(valor)
          if (saldo !== null && cuenta.saldoFinal === undefined) {
            cuenta.saldoFinal = saldo
            const divisa = valor.match(/\b([A-Z]{3})\b/)
            if (divisa) cuenta.divisa = divisa[1]
          }
        } else if (cuenta.titular === undefined && !papelDe(valor)) {
          cuenta.titular = valor
        }
      }
    }
  }
  return cuenta
}
