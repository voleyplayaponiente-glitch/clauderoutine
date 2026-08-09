/**
 * Lectura asistida del cuadro de un préstamo (Excel del banco o PDF).
 *
 * Igual que con las facturas: **propone, no decide**. Lo que está escrito se
 * lee; lo que no, se deja vacío y se dice. Lo único que se calcula es el **tipo
 * de interés**, y se calcula a partir del propio cuadro (intereses del periodo
 * sobre el capital vivo), no se estima: si el cuadro no da para calcularlo, se
 * queda en blanco.
 *
 * El banco reparte la información en dos ficheros y los dos hacen falta para
 * tener el préstamo completo:
 *  · «Amortizaciones y movimientos» — la formalización (importe inicial, fecha
 *    y comisión de apertura) y las cuotas ya pagadas.
 *  · «Próximas cuotas» — el cuadro que queda por pagar.
 * Por eso `fusionarPrestamos` los combina: se pueden subir los dos a la vez.
 */
import { parsearImporte, detectarConvencionNumerica, type ConvencionNumerica } from './parseo-es'
import { parsearFechaFlexible } from './importacion'

export type Celda = string | number | null | undefined

export interface CuotaLeida {
  fecha: string
  cuota: number
  principal?: number
  intereses?: number
  /** Capital vivo DESPUÉS de pagar esa cuota. */
  pendiente?: number
  pagada: boolean
}

export interface DatosPrestamo {
  /** Nº de contrato tal cual viene, con sus espacios. */
  numeroContrato?: string
  entidad?: string
  nombreProducto?: string
  cifTitular?: string
  importeOriginal?: number
  fechaInicio?: string
  comisionApertura?: number
  cuota?: number
  /** Total de cuotas: las pagadas más las que quedan. */
  nPeriodos?: number
  nPagadas?: number
  nPendientes?: number
  periodicidad?: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL'
  sistema?: 'FRANCES' | 'LINEAL'
  /** % anual, deducido del propio cuadro. */
  tipoInteres?: number
  /** Capital que queda por devolver a día de hoy. */
  capitalPendiente?: number
  cuotas: CuotaLeida[]
  avisos: string[]
  encontrados: string[]
}

/**
 * Códigos de entidad españoles (las cuatro primeras cifras del contrato).
 * Solo para **proponer** el acreedor; siempre se puede corregir.
 */
const ENTIDADES: Record<string, string> = {
  '0182': 'BBVA',
  '2100': 'CaixaBank',
  '0081': 'Banco Sabadell',
  '0128': 'Bankinter',
  '0049': 'Banco Santander',
  '0073': 'Openbank',
  '0075': 'Banco Popular',
  '2080': 'Abanca',
  '0234': 'Banco Caminos',
  '1465': 'ING',
  '0239': 'EVO Banco',
  '3058': 'Cajamar',
  '2103': 'Unicaja',
  '0487': 'Banco Mare Nostrum',
  '0186': 'Banco Mediolanum',
  '1550': 'Banca Pueyo',
}

function texto(c: Celda): string {
  return c === null || c === undefined ? '' : String(c).trim()
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function numero(c: Celda, convencion: ConvencionNumerica): number | undefined {
  if (typeof c === 'number') return Number.isFinite(c) ? c : undefined
  const t = texto(c)
  if (t === '') return undefined
  const n = parsearImporte(t, convencion)
  return n === null ? undefined : n
}

/** Valor de una fila «Etiqueta | valor» de la cabecera del fichero. */
function etiqueta(filas: Celda[][], clave: string): string | undefined {
  for (const f of filas.slice(0, 20)) {
    if (normalizar(texto(f[0])) !== clave) continue
    for (let i = 1; i < f.length; i++) {
      const v = texto(f[i])
      if (v !== '') return v
    }
  }
  return undefined
}

/** Índice de la fila de cabeceras de la tabla y sus columnas. */
function cabeceraTabla(filas: Celda[][]): { i: number; col: Record<string, number> } | undefined {
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const n = (filas[i] ?? []).map((c) => normalizar(texto(c)))
    if (!n.some((c) => c.startsWith('fecha de vencimiento'))) continue
    const buscar = (...claves: string[]) => n.findIndex((c) => c !== '' && claves.some((k) => c === k || c.startsWith(k)))
    return {
      i,
      col: {
        vencimiento: buscar('fecha de vencimiento'),
        operacion: buscar('fecha de operacion'),
        tipoMovimiento: buscar('tipo de movimiento'),
        // «Importe del movimiento» en amortizaciones, «Importe de cuota» en próximas.
        importe: buscar('importe de cuota', 'importe del movimiento'),
        principal: buscar('importe principal'),
        intereses: buscar('importe de intereses'),
        comisiones: buscar('comisiones'),
        estado: buscar('estado'),
        pendiente: buscar('capital pendiente'),
        amortizado: buscar('capital amortizado'),
      },
    }
  }
  return undefined
}

/** Meses entre dos fechas ISO, redondeado. */
function mesesEntre(a: string, b: string): number {
  const d1 = new Date(a + 'T00:00:00Z')
  const d2 = new Date(b + 'T00:00:00Z')
  return Math.round((d2.getTime() - d1.getTime()) / (30.44 * 86_400_000))
}

function periodicidadDe(fechas: string[]): 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL' | undefined {
  if (fechas.length < 2) return undefined
  const m = mesesEntre(fechas[0], fechas[1])
  if (m <= 1) return 'MENSUAL'
  if (m <= 4) return 'TRIMESTRAL'
  if (m >= 10) return 'ANUAL'
  return undefined
}

const PERIODOS_ANIO = { MENSUAL: 12, TRIMESTRAL: 4, ANUAL: 1 } as const

/**
 * Tipo de interés anual deducido del cuadro: intereses del periodo entre el
 * capital vivo ANTES de pagar esa cuota (que es el pendiente de después más el
 * principal amortizado en ella). Se toma la mediana de varias cuotas para que
 * un redondeo suelto no desvíe el resultado.
 */
export function tipoDeCuadro(cuotas: CuotaLeida[], periodicidad: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL'): number | undefined {
  const tasas: number[] = []
  for (const c of cuotas) {
    if (c.intereses === undefined || c.principal === undefined || c.pendiente === undefined) continue
    const vivoAntes = c.pendiente + c.principal
    if (vivoAntes <= 0 || c.intereses <= 0) continue
    tasas.push((c.intereses / vivoAntes) * PERIODOS_ANIO[periodicidad] * 100)
  }
  if (tasas.length === 0) return undefined
  tasas.sort((a, b) => a - b)
  const mediana = tasas[Math.floor(tasas.length / 2)]
  return Math.round(mediana * 1000) / 1000
}

/** Lee un fichero del banco (ya convertido a filas). */
export function leerPrestamo(filas: Celda[][]): DatosPrestamo {
  const avisos: string[] = []
  const encontrados: string[] = []
  const datos: DatosPrestamo = { cuotas: [], avisos, encontrados }

  const cab = cabeceraTabla(filas)
  if (!cab) {
    return {
      cuotas: [],
      avisos: [
        'No se reconoce el cuadro del préstamo: falta una tabla con la columna «Fecha de vencimiento». ' +
          'Descarga del banco el cuadro de amortización o las próximas cuotas en Excel.',
      ],
      encontrados: [],
    }
  }

  // ── Cabecera: contrato, producto, titular ──
  const contrato = etiqueta(filas, 'contrato') ?? etiqueta(filas, 'numero de contrato')
  if (contrato) {
    datos.numeroContrato = contrato
    encontrados.push('numeroContrato')
    const codigo = contrato.replace(/\D/g, '').slice(0, 4)
    const entidad = ENTIDADES[codigo]
    if (entidad) {
      datos.entidad = entidad
      encontrados.push('entidad')
    }
  }
  const producto = etiqueta(filas, 'nombre comercial') ?? etiqueta(filas, 'producto')
  if (producto) {
    datos.nombreProducto = producto
    encontrados.push('nombreProducto')
  }
  const cif = etiqueta(filas, 'cif') ?? etiqueta(filas, 'nif')
  if (cif) datos.cifTitular = cif

  // ── Cuerpo de la tabla ──
  const cuerpo = filas.slice(cab.i + 1)
  const muestras: string[] = []
  for (const f of cuerpo) {
    for (const i of [cab.col.importe, cab.col.principal, cab.col.intereses, cab.col.pendiente]) {
      if (i >= 0 && typeof f[i] === 'string') muestras.push(f[i] as string)
    }
  }
  const convencion = detectarConvencionNumerica(muestras)
  const val = (f: Celda[], i: number) => (i >= 0 ? numero(f[i], convencion) : undefined)

  const cuotas: CuotaLeida[] = []
  for (const f of cuerpo) {
    const fecha = parsearFechaFlexible(texto(f[cab.col.vencimiento]))
    if (!fecha) continue
    const tipoMov = normalizar(texto(f[cab.col.tipoMovimiento]))
    const estado = normalizar(texto(f[cab.col.estado]))
    const importe = val(f, cab.col.importe)
    const principal = val(f, cab.col.principal)

    // La formalización no es una cuota: es el alta del préstamo.
    if (tipoMov.includes('formalizacion')) {
      if (principal !== undefined) {
        datos.importeOriginal = principal
        encontrados.push('importeOriginal')
      }
      const fOper = parsearFechaFlexible(texto(f[cab.col.operacion])) ?? fecha
      datos.fechaInicio = fOper
      encontrados.push('fechaInicio')
      const com = val(f, cab.col.comisiones)
      if (com !== undefined && com > 0) {
        datos.comisionApertura = com
        encontrados.push('comisionApertura')
      }
      continue
    }
    if (importe === undefined || importe <= 0) continue

    cuotas.push({
      fecha,
      cuota: importe,
      principal,
      intereses: val(f, cab.col.intereses),
      pendiente: val(f, cab.col.pendiente),
      // Sin columna de tipo de movimiento es el fichero de próximas cuotas.
      pagada: estado.includes('pagada'),
    })
  }

  cuotas.sort((a, b) => a.fecha.localeCompare(b.fecha))
  datos.cuotas = cuotas
  if (cuotas.length === 0) {
    avisos.push('La tabla no tiene ninguna cuota legible.')
    return datos
  }

  datos.nPagadas = cuotas.filter((c) => c.pagada).length
  datos.nPendientes = cuotas.length - datos.nPagadas
  encontrados.push('cuotas')

  // El importe de la cuota: el más repetido, que un cuadro puede traer una
  // última cuota de ajuste distinta de las demás.
  const frecuencia = new Map<number, number>()
  for (const c of cuotas) frecuencia.set(c.cuota, (frecuencia.get(c.cuota) ?? 0) + 1)
  datos.cuota = [...frecuencia.entries()].sort((a, b) => b[1] - a[1])[0][0]
  encontrados.push('cuota')

  datos.periodicidad = periodicidadDe(cuotas.map((c) => c.fecha))
  if (datos.periodicidad) encontrados.push('periodicidad')
  else avisos.push('No se ha podido deducir la periodicidad de las cuotas; indícala a mano.')

  // Cuota constante = francés; capital constante = lineal.
  const principales = cuotas.map((c) => c.principal).filter((p): p is number => p !== undefined)
  if (principales.length >= 2) {
    const cuotaConstante = new Set(cuotas.map((c) => c.cuota)).size <= 2
    datos.sistema = cuotaConstante ? 'FRANCES' : 'LINEAL'
    encontrados.push('sistema')
  }

  if (datos.periodicidad) {
    const tipo = tipoDeCuadro(cuotas, datos.periodicidad)
    if (tipo !== undefined) {
      datos.tipoInteres = tipo
      encontrados.push('tipoInteres')
      avisos.push(`El tipo de interés (${tipo} % anual) se ha calculado con el propio cuadro. Confírmalo con la escritura.`)
    }
  }

  // Capital vivo: el pendiente de la última cuota pagada, o el de la primera
  // pendiente más su principal.
  const ultimaPagada = [...cuotas].reverse().find((c) => c.pagada)
  const primeraPendiente = cuotas.find((c) => !c.pagada)
  datos.capitalPendiente =
    ultimaPagada?.pendiente ??
    (primeraPendiente?.pendiente !== undefined && primeraPendiente.principal !== undefined
      ? primeraPendiente.pendiente + primeraPendiente.principal
      : undefined)

  // El importe inicial también se puede reconstruir: lo que queda más lo ya
  // amortizado. Sirve cuando solo se tiene el fichero de próximas cuotas.
  if (datos.importeOriginal === undefined) {
    const cab2 = cabeceraTabla(filas)!
    const primera = cuerpo.find((f) => parsearFechaFlexible(texto(f[cab2.col.vencimiento])))
    const pend = primera ? val(primera, cab2.col.pendiente) : undefined
    const amort = primera ? val(primera, cab2.col.amortizado) : undefined
    if (pend !== undefined && amort !== undefined) {
      datos.importeOriginal = Math.round((pend + amort) * 100) / 100
      encontrados.push('importeOriginal')
      avisos.push('El importe inicial se ha reconstruido sumando capital pendiente y amortizado; confírmalo.')
    }
  }

  return datos
}

/**
 * Combina las lecturas de varios ficheros del mismo préstamo. Gana el primero
 * que traiga cada dato, y las cuotas se unen sin repetir fecha (la versión
 * pagada manda sobre la prevista).
 */
export function fusionarPrestamos(lecturas: DatosPrestamo[]): DatosPrestamo {
  const validas = lecturas.filter((l) => l.cuotas.length > 0 || l.encontrados.length > 0)
  if (validas.length === 0) return lecturas[0] ?? { cuotas: [], avisos: ['No se ha leído ningún fichero.'], encontrados: [] }
  // Con un solo fichero se sigue el mismo camino: así el nº total de cuotas y
  // los avisos salen igual que cuando son dos.

  const porFecha = new Map<string, CuotaLeida>()
  for (const l of validas) {
    for (const c of l.cuotas) {
      const previa = porFecha.get(c.fecha)
      if (!previa || (c.pagada && !previa.pagada)) porFecha.set(c.fecha, c)
    }
  }
  const cuotas = [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const primero = <T,>(f: (l: DatosPrestamo) => T | undefined): T | undefined => {
    for (const l of validas) {
      const v = f(l)
      if (v !== undefined) return v
    }
    return undefined
  }

  const nPagadas = cuotas.filter((c) => c.pagada).length
  const periodicidad = primero((l) => l.periodicidad) ?? periodicidadDe(cuotas.map((c) => c.fecha))
  const fusion: DatosPrestamo = {
    numeroContrato: primero((l) => l.numeroContrato),
    entidad: primero((l) => l.entidad),
    nombreProducto: primero((l) => l.nombreProducto),
    cifTitular: primero((l) => l.cifTitular),
    importeOriginal: primero((l) => l.importeOriginal),
    fechaInicio: primero((l) => l.fechaInicio),
    comisionApertura: primero((l) => l.comisionApertura),
    cuota: primero((l) => l.cuota),
    nPagadas,
    nPendientes: cuotas.length - nPagadas,
    nPeriodos: cuotas.length,
    periodicidad,
    sistema: primero((l) => l.sistema),
    tipoInteres: primero((l) => l.tipoInteres) ?? (periodicidad ? tipoDeCuadro(cuotas, periodicidad) : undefined),
    capitalPendiente: primero((l) => l.capitalPendiente),
    cuotas,
    avisos: [...new Set(validas.flatMap((l) => l.avisos))],
    encontrados: [...new Set(validas.flatMap((l) => l.encontrados))],
  }

  // Si un fichero trae la formalización, el importe inicial es un dato leído y
  // no una reconstrucción: sobra el aviso del otro fichero.
  const hayFormalizacion = validas.some((l) => l.importeOriginal !== undefined && l.fechaInicio !== undefined)
  if (hayFormalizacion) fusion.avisos = fusion.avisos.filter((a) => !/reconstruido/.test(a))

  // Con un solo fichero, el nº total de cuotas es solo el de ese fichero: se
  // dice, porque de ahí sale la duración del préstamo.
  if (!hayFormalizacion) {
    fusion.avisos.push(
      'Con un solo fichero puede faltar parte del cuadro. Sube también el otro (amortizaciones y próximas cuotas) para tener ' +
        'el préstamo completo.',
    )
  }
  return fusion
}
