/**
 * Lectura del **Modelo 200** (Impuesto sobre Sociedades) presentado.
 *
 * Es, con diferencia, el documento más denso que se puede subir a la app: lleva
 * dentro el **balance completo**, la **cuenta de pérdidas y ganancias** y la
 * **liquidación** del ejercicio anterior, ya cerrados y presentados ante
 * Hacienda. Es decir, la foto de partida del año en curso.
 *
 * DOS DECISIONES QUE SOSTIENEN TODO ESTE FICHERO:
 *
 * 1. **Se lee por número de clave, nunca por rótulo ni por posición.** Los
 *    rótulos y la maquetación de la AEAT cambian cada ejercicio; las claves
 *    (00500 resultado contable, 00552 base imponible…) no. Un lector atado al
 *    texto se rompería con el modelo del año que viene.
 *
 * 2. **Las claves se guardan por SECCIÓN, no en un saco común.** El modelo
 *    REUTILIZA números entre páginas: 00301 es «De valores negociables» en la
 *    cuenta de pérdidas y ganancias y «Correcciones por IS (aumentos)» en la
 *    liquidación. Un `Record<clave, importe>` plano mezclaría las dos y daría
 *    una cifra falsa sin avisar.
 *
 * Como el resto de lectores de la app: **propone, no decide**. Lo que no se
 * pueda leer se deja en blanco y se dice.
 */
import { parsearImporte, detectarConvencionNumerica } from './parseo-es'
import { aplanar } from './prestamo-archivo'

/** Secciones del modelo con claves propias. El orden es el del documento. */
export type SeccionModelo200 =
  | 'ACTIVO'
  | 'PASIVO'
  | 'PYG'
  | 'LIQUIDACION'
  | 'BASES_NEGATIVAS'
  | 'OTRA'

const CABECERAS: { texto: string; seccion: SeccionModelo200 }[] = [
  { texto: 'balance: activo', seccion: 'ACTIVO' },
  { texto: 'balance: patrimonio neto y pasivo', seccion: 'PASIVO' },
  { texto: 'cuenta de perdidas y ganancias', seccion: 'PYG' },
  { texto: 'detalle de la compensacion de bases imponibles negativas', seccion: 'BASES_NEGATIVAS' },
  { texto: 'liquidacion', seccion: 'LIQUIDACION' },
]

export interface ParticipadaModelo200 {
  nif?: string
  nombre?: string
  porcentaje?: number
  nominal?: number
  valorLibros?: number
  dividendos?: number
}

export interface SocioModelo200 {
  nif?: string
  nombre?: string
  nominal?: number
  porcentaje?: number
}

export interface BaseNegativaModelo200 {
  anio: number
  pendienteInicio?: number
  aplicado?: number
  pendienteFuturo?: number
}

export interface DatosModelo200 {
  ejercicio?: number
  periodo?: { desde: string; hasta: string }
  nif?: string
  razonSocial?: string
  cnae?: string

  /** Todas las claves con importe, agrupadas por sección. */
  claves: Record<SeccionModelo200, Record<string, number>>

  balance: {
    activoNoCorriente?: number
    activoCorriente?: number
    totalActivo?: number
    patrimonioNeto?: number
    capital?: number
    reservas?: number
    resultadoEjercicio?: number
    pasivoNoCorriente?: number
    pasivoCorriente?: number
    totalPasivo?: number
  }
  perdidasYGanancias: {
    importeNetoCifraNegocios?: number
    gastosPersonal?: number
    otrosGastosExplotacion?: number
    amortizacion?: number
    resultadoExplotacion?: number
    ingresosFinancieros?: number
    gastosFinancieros?: number
    resultadoFinanciero?: number
    resultadoAntesImpuestos?: number
    impuestoSociedades?: number
    resultado?: number
  }
  liquidacion: {
    resultadoContable?: number
    baseAntesCompensacion?: number
    baseImponible?: number
    tipoGravamen?: number
    cuotaIntegra?: number
    cuotaLiquida?: number
    resultadoDeclaracion?: number
  }

  participadas: ParticipadaModelo200[]
  socios: SocioModelo200[]
  basesNegativas: BaseNegativaModelo200[]
  /** Base imponible negativa que queda por compensar en ejercicios futuros. */
  binPendiente?: number

  encontrados: string[]
  avisos: string[]
}

/**
 * ¿Es esto un Modelo 200? Se piden **dos señales**: con una sola, cualquier
 * escrito de la AEAT o un modelo 202 colaría.
 */
export function esModelo200(filas: unknown[][]): boolean {
  const texto = aplanar(filas.map((f) => f.map((c) => String(c ?? '')).join(' ')).join(' \n '))
  const señales = [
    'impuesto sobre sociedades',
    'modelo 200',
    'balance: activo',
    'cuenta de perdidas y ganancias',
    'liquidacion (i)',
    'resultado de la cuenta de perdidas y ganancias',
  ]
  return señales.filter((s) => texto.includes(s)).length >= 2
}

const RE_CLAVE = /^\d{5}$/
const RE_IMPORTE_SUELTO = /^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^-?\d+(?:,\d+)?$/

function celdasDeFila(fila: unknown[]): string[] {
  return fila.map((c) => String(c ?? '').trim()).filter((c) => c !== '')
}

/**
 * Recorre el documento anotando en qué sección va y, dentro de cada una, qué
 * importe lleva cada clave.
 *
 * La regla es simple y aguanta las tres maquetaciones del modelo: **una clave
 * se queda con el importe que va justo detrás**. Si detrás hay otra clave (fila
 * de aumentos/disminuciones con la columna vacía) esa clave no tiene valor, y
 * es correcto que no lo tenga.
 *
 * **Gana la primera aparición**: la última página del modelo repite un resumen
 * de la liquidación, y no debe pisar lo leído en su sitio.
 */
export function clavesPorSeccion(filas: unknown[][]): Record<SeccionModelo200, Record<string, number>> {
  const salida: Record<SeccionModelo200, Record<string, number>> = {
    ACTIVO: {}, PASIVO: {}, PYG: {}, LIQUIDACION: {}, BASES_NEGATIVAS: {}, OTRA: {},
  }

  // La convención numérica se deduce del propio fichero, como en el resto de la
  // app: no se da por supuesto que la AEAT escriba con coma decimal.
  const todos: string[] = []
  for (const fila of filas) for (const c of celdasDeFila(fila)) if (RE_IMPORTE_SUELTO.test(c)) todos.push(c)
  const convencion = detectarConvencionNumerica(todos)
  const num = (s: string): number | undefined => {
    const n = parsearImporte(s, convencion === 'AUTO' ? 'ES' : convencion)
    return n === null ? undefined : n
  }

  let seccion: SeccionModelo200 = 'OTRA'
  for (const fila of filas) {
    const celdas = celdasDeFila(fila)
    if (celdas.length === 0) continue

    const inicio = aplanar(celdas[0])
    const cabecera = CABECERAS.find((c) => inicio.startsWith(c.texto))
    if (cabecera) seccion = cabecera.seccion

    for (let i = 0; i < celdas.length; i++) {
      if (!RE_CLAVE.test(celdas[i])) continue
      const siguiente = celdas[i + 1]
      if (siguiente === undefined || RE_CLAVE.test(siguiente) || !RE_IMPORTE_SUELTO.test(siguiente)) continue
      const n = num(siguiente)
      if (n === undefined) continue
      if (salida[seccion][celdas[i]] === undefined) salida[seccion][celdas[i]] = n
    }
  }
  return salida
}

/** Fecha del modelo (día, mes y año sueltos) a ISO. */
function iso(d: string, m: string, a: string): string | undefined {
  const dd = Number(d), mm = Number(m), aa = Number(a)
  if (!dd || !mm || !aa || mm > 12 || dd > 31 || aa < 1990 || aa > 2100) return undefined
  return `${aa}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

export function leerModelo200(filas: unknown[][]): DatosModelo200 {
  const claves = clavesPorSeccion(filas)
  const d: DatosModelo200 = {
    claves,
    balance: {}, perdidasYGanancias: {}, liquidacion: {},
    participadas: [], socios: [], basesNegativas: [],
    encontrados: [], avisos: [],
  }

  const v = (s: SeccionModelo200, clave: string) => claves[s][clave]

  d.balance = {
    activoNoCorriente: v('ACTIVO', '00101'),
    activoCorriente: v('ACTIVO', '00136'),
    totalActivo: v('ACTIVO', '00180'),
    patrimonioNeto: v('PASIVO', '00185'),
    capital: v('PASIVO', '00187'),
    reservas: v('PASIVO', '00191'),
    resultadoEjercicio: v('PASIVO', '00199'),
    pasivoNoCorriente: v('PASIVO', '00210'),
    pasivoCorriente: v('PASIVO', '00228'),
    totalPasivo: v('PASIVO', '00252'),
  }
  d.perdidasYGanancias = {
    importeNetoCifraNegocios: v('PYG', '00255'),
    gastosPersonal: v('PYG', '00274'),
    otrosGastosExplotacion: v('PYG', '00279'),
    amortizacion: v('PYG', '00284'),
    resultadoExplotacion: v('PYG', '00296'),
    ingresosFinancieros: v('PYG', '00297'),
    gastosFinancieros: v('PYG', '00305'),
    resultadoFinanciero: v('PYG', '00324'),
    resultadoAntesImpuestos: v('PYG', '00325'),
    impuestoSociedades: v('PYG', '00326'),
    resultado: v('PYG', '00500'),
  }
  d.liquidacion = {
    resultadoContable: v('LIQUIDACION', '00500'),
    baseAntesCompensacion: v('LIQUIDACION', '00550'),
    baseImponible: v('LIQUIDACION', '00552'),
    tipoGravamen: v('LIQUIDACION', '00558'),
    cuotaIntegra: v('LIQUIDACION', '00562'),
    cuotaLiquida: v('LIQUIDACION', '00592'),
    resultadoDeclaracion: v('LIQUIDACION', '00621'),
  }

  leerIdentificacion(filas, d)
  leerParticipadasYSocios(filas, d)
  leerBasesNegativas(filas, d)

  if (d.balance.totalActivo !== undefined) d.encontrados.push('balance')
  if (d.perdidasYGanancias.resultado !== undefined) d.encontrados.push('perdidasYGanancias')
  if (d.liquidacion.baseImponible !== undefined) d.encontrados.push('liquidacion')

  comprobarCuadres(d)
  return d
}

function leerIdentificacion(filas: unknown[][], d: DatosModelo200): void {
  for (const fila of filas) {
    const celdas = celdasDeFila(fila)
    const linea = celdas.join(' ')
    const plano = aplanar(linea)

    // «EL 1 1 2025 AL 31 12 2025» — el periodo impositivo, en celdas sueltas.
    if (d.periodo === undefined && plano.includes(' al ')) {
      const cifras = celdas.filter((c) => /^\d{1,4}$/.test(c))
      if (cifras.length >= 6) {
        const desde = iso(cifras[0], cifras[1], cifras[2])
        const hasta = iso(cifras[3], cifras[4], cifras[5])
        if (desde && hasta) {
          d.periodo = { desde, hasta }
          d.ejercicio = Number(cifras[2])
          d.encontrados.push('periodo')
        }
      }
    }

    // La cabecera de cada página repite NIF y razón social: es el sitio más
    // fiable, porque va siempre en la misma celda y sin rótulo que estorbe.
    if (d.nif === undefined) {
      const i = celdas.findIndex((c) => /^[A-HJ-NP-SUVW]\d{7}[0-9A-J]$/i.test(c))
      if (i !== -1 && celdas[i + 1] && /[A-ZÁÉÍÓÚÑ]{3}/i.test(celdas[i + 1])) {
        d.nif = celdas[i].toUpperCase()
        d.razonSocial = celdas[i + 1].trim()
        d.encontrados.push('nif', 'razonSocial')
      }
    }

    if (d.cnae === undefined && plano.includes('cnae')) {
      const m = celdas.map((c) => c.trim()).find((c) => /^\d{4}$/.test(c))
      if (m) {
        d.cnae = m
        d.encontrados.push('cnae')
      }
    }
  }
}

const RE_NIF_PERSONA = /^\d{8}[A-Z]$/i
const RE_NIF_EMPRESA = /^[A-HJ-NP-SUVW]\d{7}[0-9A-J]$/i
const RE_NUM = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/

/**
 * Socios de la declarante (apartado B.2) y participaciones en otras (B.1).
 *
 * Va aparte del resto porque **no son claves**: son tablas de texto. Los socios
 * son filas regulares (`NIF | F | Nombre | provincia | nominal | %`); las
 * participadas van por rótulos y la AEAT **parte la razón social entre dos
 * líneas** («BESPAIN 7777, S» + «.L.U.»), así que hay que recomponerla.
 */
function leerParticipadasYSocios(filas: unknown[][], d: DatosModelo200): void {
  const lineas = filas.map(celdasDeFila)
  const numero = (s: string | undefined) => (s && RE_NUM.test(s) ? parsearImporte(s, 'ES') ?? undefined : undefined)

  let enB1 = false
  let participada: ParticipadaModelo200 | undefined

  for (let i = 0; i < lineas.length; i++) {
    const celdas = lineas[i]
    if (celdas.length === 0) continue
    const plano = aplanar(celdas.join(' '))

    if (plano.includes('participaciones de la declarante en otras entidades')) { enB1 = true; participada = {} }
    if (plano.includes('participaciones de personas o entidades en la declarante')) {
      if (participada && (participada.nif || participada.nombre)) d.participadas.push(participada)
      enB1 = false
      participada = undefined
    }

    if (enB1 && participada) {
      const ultima = celdas[celdas.length - 1]
      if (plano.startsWith('nif') && RE_NIF_EMPRESA.test(ultima)) participada.nif = ultima.toUpperCase()
      else if (plano.startsWith('nombre o razon social')) {
        let nombre = ultima
        // La razón social partida: la línea siguiente empieza por punto.
        const siguiente = lineas[i + 1]?.[0]
        if (siguiente && /^\./.test(siguiente)) nombre += siguiente
        participada.nombre = nombre.trim()
      } else if (plano.includes('porcentaje de participacion')) participada.porcentaje = numero(ultima)
      else if (plano.includes('valor nominal total de la participacion')) participada.nominal = numero(ultima)
      else if (plano.includes('valor en libros')) participada.valorLibros = numero(ultima)
      else if (plano.includes('dividendos recibidos')) participada.dividendos = numero(ultima)
      continue
    }

    // Socio: NIF de persona o empresa + F/J + nombre + … + nominal + %.
    if ((RE_NIF_PERSONA.test(celdas[0]) || RE_NIF_EMPRESA.test(celdas[0])) && /^[FJ]$/i.test(celdas[1] ?? '')) {
      const importes = celdas.filter((c) => RE_NUM.test(c)).map((c) => parsearImporte(c, 'ES') ?? 0)
      const nombre = celdas.find((c, j) => j > 1 && /[A-ZÁÉÍÓÚÑ]{3}/i.test(c) && !RE_NUM.test(c))
      // Con dos importes son nominal y porcentaje, en ese orden. Con uno solo no
      // se adivina cuál es: se deja fuera antes que inventarlo.
      if (importes.length >= 2) {
        d.socios.push({
          nif: celdas[0].toUpperCase(),
          nombre: nombre?.trim(),
          nominal: importes[importes.length - 2],
          porcentaje: importes[importes.length - 1],
        })
      }
    }
  }
  if (participada && (participada.nif || participada.nombre)) d.participadas.push(participada)

  if (d.socios.length > 0) d.encontrados.push('socios')
  if (d.participadas.length > 0) d.encontrados.push('participadas')
}

/**
 * Bases imponibles negativas por año de origen.
 *
 * Interesa sobre todo **lo que queda pendiente para el futuro**: es un activo
 * fiscal que se pierde de vista con facilidad y que reduce el impuesto de los
 * años siguientes.
 */
function leerBasesNegativas(filas: unknown[][], d: DatosModelo200): void {
  const vistos = new Set<number>()
  for (const fila of filas) {
    const celdas = celdasDeFila(fila)
    const plano = aplanar(celdas.join(' '))
    const m = /compensacion de base a[nñ]o (\d{4})/.exec(plano)
    if (!m) continue
    const anio = Number(m[1])

    // Misma regla que con las claves: cada importe va detrás de la suya.
    const valores: number[] = []
    for (let i = 0; i < celdas.length; i++) {
      if (!RE_CLAVE.test(celdas[i])) continue
      const s = celdas[i + 1]
      valores.push(s !== undefined && !RE_CLAVE.test(s) && RE_NUM.test(s) ? parsearImporte(s, 'ES') ?? 0 : 0)
    }
    if (valores.every((x) => x === 0)) continue
    if (vistos.has(anio)) continue
    vistos.add(anio)

    d.basesNegativas.push({
      anio,
      pendienteInicio: valores[0] || undefined,
      aplicado: valores[1] || undefined,
      // La fila del ejercicio corriente solo trae dos columnas (generada y
      // pendiente), así que el pendiente es el último valor, no el tercero.
      pendienteFuturo: (valores.length >= 3 ? valores[2] : valores[1]) || undefined,
    })
  }

  const pendiente = d.basesNegativas.reduce((s, b) => s + (b.pendienteFuturo ?? 0), 0)
  if (pendiente > 0) {
    d.binPendiente = Math.round(pendiente * 100) / 100
    d.encontrados.push('binPendiente')
  }
}

/**
 * Comprobaciones de cuadre. **No se corrige nada**: si algo no cuadra es que se
 * ha leído mal, y hay que verlo antes de meterlo en la contabilidad.
 */
function comprobarCuadres(d: DatosModelo200): void {
  const { totalActivo, totalPasivo, resultadoEjercicio } = d.balance
  if (totalActivo !== undefined && totalPasivo !== undefined && Math.abs(totalActivo - totalPasivo) > 0.02) {
    d.avisos.push(
      `El balance no cuadra: activo ${totalActivo} € frente a patrimonio neto y pasivo ${totalPasivo} €. ` +
        'Revisa el documento antes de usar estos datos.',
    )
  }
  const resultadoPyG = d.perdidasYGanancias.resultado
  if (resultadoEjercicio !== undefined && resultadoPyG !== undefined && Math.abs(resultadoEjercicio - resultadoPyG) > 0.02) {
    d.avisos.push(
      `El resultado del balance (${resultadoEjercicio} €) no coincide con el de pérdidas y ganancias (${resultadoPyG} €).`,
    )
  }
  if (d.liquidacion.baseImponible !== undefined && d.liquidacion.baseImponible < 0) {
    d.avisos.push(
      `La base imponible del ejercicio fue negativa (${d.liquidacion.baseImponible} €): queda pendiente de ` +
        'compensar en ejercicios futuros y reduce el impuesto de los años siguientes.',
    )
  }
  if (d.encontrados.length === 0) {
    d.avisos.push('No se ha reconocido ningún dato del modelo. ¿Es un Modelo 200 con capa de texto?')
  }
}
