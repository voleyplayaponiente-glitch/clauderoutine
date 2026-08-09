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
export const ENTIDADES: Record<string, string> = {
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

/**
 * Minúsculas y sin tildes **conservando la longitud**: hay que buscar en el
 * texto normalizado y cortar en el original, y con `NFD` las posiciones se
 * desplazan (cada tilde añade un carácter).
 */
const ACENTUADAS = 'áàäâéèëêíìïîóòöôúùüûñçÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑÇ'
const LLANAS = 'aaaaeeeeiiiioooouuuuncaaaaeeeeiiiioooouuuunc'

export function aplanar(s: string): string {
  let r = ''
  for (const c of s.toLowerCase()) {
    const i = ACENTUADAS.indexOf(c)
    r += i === -1 ? c : LLANAS[i]
  }
  return r
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

/**
 * Cada banco rotula sus columnas a su manera. Estos son los nombres vistos en
 * ficheros reales: BBVA («IMPORTE DE CUOTA», «CAPITAL PENDIENTE») y Bankinter
 * («IMPORTE CUOTA», «AMORTIZACION», «IMPORTE PENDIENTE DE AMORTIZACIÓN»).
 */
const COLUMNAS_VENCIMIENTO = ['fecha de vencimiento', 'fecha cuota', 'fecha de la cuota', 'fecha de pago']
const COLUMNAS_IMPORTE = ['importe de cuota', 'importe cuota', 'importe del movimiento']
const COLUMNAS_PRINCIPAL = ['importe principal', 'amortizacion']
const COLUMNAS_INTERESES = ['importe de intereses', 'intereses']
const COLUMNAS_PENDIENTE = ['capital pendiente', 'importe pendiente de amortizacion', 'pendiente de amortizacion']

/** Índice de la fila de cabeceras de la tabla y sus columnas. */
function cabeceraTabla(filas: Celda[][]): { i: number; col: Record<string, number> } | undefined {
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const n = (filas[i] ?? []).map((c) => normalizar(texto(c)))
    const buscar = (...claves: string[]) => n.findIndex((c) => c !== '' && claves.some((k) => c === k || c.startsWith(k)))
    if (buscar(...COLUMNAS_VENCIMIENTO) === -1) continue
    // La columna de fecha a secas no basta: la ficha del préstamo la usa como
    // rótulo de un dato suelto («Importe pendiente · Cuota a pagar · Fecha de
    // vencimiento»). Para ser una tabla tiene que traer además las columnas de
    // importe del cuadro; si no, se lee por texto.
    const columnasCuadro = [...COLUMNAS_IMPORTE, ...COLUMNAS_PRINCIPAL, ...COLUMNAS_INTERESES, ...COLUMNAS_PENDIENTE]
    if (columnasCuadro.filter((k) => buscar(k) !== -1).length < 2) continue
    return {
      i,
      col: {
        vencimiento: buscar(...COLUMNAS_VENCIMIENTO),
        operacion: buscar('fecha de operacion'),
        tipoMovimiento: buscar('tipo de movimiento'),
        importe: buscar(...COLUMNAS_IMPORTE),
        principal: buscar(...COLUMNAS_PRINCIPAL),
        intereses: buscar(...COLUMNAS_INTERESES),
        comisiones: buscar('comisiones'),
        estado: buscar('estado'),
        pendiente: buscar(...COLUMNAS_PENDIENTE),
        amortizado: buscar('capital amortizado'),
      },
    }
  }
  return undefined
}

/**
 * Excel guarda las fechas como número de días desde el 30/12/1899, y SheetJS
 * las devuelve así cuando se lee con `header: 1`. El cuadro de Bankinter llega
 * entero en ese formato (46247 = 13/08/2026).
 */
export function fechaDeSerieExcel(serie: number): string | undefined {
  // Se acota a un rango razonable (1982-2119) para no confundir un importe con
  // una fecha: fuera de ahí, mejor no leer nada.
  if (!Number.isFinite(serie) || serie < 30000 || serie > 80000) return undefined
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serie) * 86_400_000).toISOString().slice(0, 10)
}

/** Fecha de una celda, venga como texto o como número de serie de Excel. */
function fechaDeCelda(c: Celda): string | undefined {
  if (typeof c === 'number') return fechaDeSerieExcel(c)
  // Bankinter escribe las fechas con puntos («13.07.2026»); el resto de la app
  // trabaja con barras. Solo se cambia cuando la forma es inequívocamente una
  // fecha, para no tocar un importe.
  const t = texto(c).replace(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/, '$1/$2/$3')
  return parsearFechaFlexible(t) ?? undefined
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

/**
 * Entidad a partir del IBAN que aparezca en el fichero. Bankinter no rotula el
 * contrato: pone «Número de cuenta: ES97 0128…» en la primera línea, y ahí el
 * código de entidad son las cuatro cifras que siguen al dígito de control.
 */
function ibanDelFichero(filas: Celda[][]): { iban: string; entidad?: string; esCuentaCargo: boolean } | undefined {
  for (const f of filas.slice(0, 12)) {
    const linea = f.map(texto).join(' ')
    const m = /\b(ES\d{2})\s?(\d{4})[\d\s]{10,}/i.exec(linea)
    if (!m) continue
    return {
      iban: linea.slice(m.index, m.index + m[0].length).trim(),
      entidad: ENTIDADES[m[2]],
      // La «cuenta de cargo» es de dónde se paga la cuota, no el préstamo: sirve
      // para saber el banco, pero no es su número de contrato.
      esCuentaCargo: normalizar(linea).includes('cuenta de cargo'),
    }
  }
  return undefined
}

/**
 * Ficha «Condiciones» de Bankinter: una fila de rótulos y una sola fila de
 * valores, sin cuadro de cuotas. Trae lo que el cuadro no dice —importe
 * inicial, fechas, tipo y clase de cuota—, así que se sube junto al cuadro.
 */
export function leerCondicionesPrestamo(filas: Celda[][]): DatosPrestamo | undefined {
  const avisos: string[] = []
  const encontrados: string[] = []

  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const n = (filas[i] ?? []).map((c) => normalizar(texto(c)))
    const col = (...claves: string[]) => n.findIndex((c) => c !== '' && claves.some((k) => c === k || c.startsWith(k)))
    const iInicio = col('fecha inicio', 'fecha de inicio', 'f. inicio')
    const iImporte = col('importe inicial', 'imp. inicial')
    if (iInicio === -1 || iImporte === -1) continue

    // La fila de valores es la primera que trae cifras: en el PDF los rótulos
    // largos se parten en dos líneas («F. Inicio /» arriba, «F. Vencimiento»
    // debajo) y esa segunda línea no es un valor.
    const valores = filas.slice(i + 1).find((f) => f.some((c) => /^\d/.test(texto(c))))
    if (!valores) continue

    const datos: DatosPrestamo = { cuotas: [], avisos, encontrados }
    const marca = <K extends keyof DatosPrestamo>(campo: K, valor: DatosPrestamo[K]) => {
      if (valor === undefined) return
      datos[campo] = valor
      encontrados.push(String(campo))
    }
    /** Importes de esta ficha vienen como «15000 EUR» y «0 %». */
    const cifra = (j: number) => {
      if (j === -1) return undefined
      const v = numero(texto(valores[j]).replace(/eur|€|%/gi, '').trim(), 'ES')
      return v
    }

    marca('fechaInicio', fechaDeCelda(valores[iInicio]))
    marca('importeOriginal', cifra(iImporte))
    marca('tipoInteres', cifra(col('tipo interes', 'tipo de interes', 'tipo intere')))

    const clase = normalizar(texto(valores[col('clases de cuota', 'clase de cuota')] ?? ''))
    // «CUOTAS AMORT CTE» = amortización constante, es decir, sistema lineal.
    if (clase.includes('amort') && (clase.includes('cte') || clase.includes('constante'))) marca('sistema', 'LINEAL')

    const iban = ibanDelFichero(filas)
    if (iban) {
      if (!iban.esCuentaCargo) marca('numeroContrato', iban.iban.replace(/^.*?(ES)/i, '$1'))
      marca('entidad', iban.entidad)
    }

    const vencimiento = fechaDeCelda(valores[col('fecha vencimiento', 'fecha de vencimiento', 'f. vencimiento')])
    if (datos.fechaInicio && vencimiento) {
      avisos.push(`El préstamo vence el ${vencimiento}; el nº de cuotas sale del cuadro de amortización.`)
    }
    if (datos.tipoInteres === 0) avisos.push('El fichero dice tipo de interés 0 %: es un préstamo sin intereses.')

    return datos
  }
  return undefined
}

/** Lee un fichero del banco (ya convertido a filas). */
export function leerPrestamo(filas: Celda[][]): DatosPrestamo {
  const avisos: string[] = []
  const encontrados: string[] = []
  const datos: DatosPrestamo = { cuotas: [], avisos, encontrados }

  const cab = cabeceraTabla(filas)
  if (!cab) {
    // Antes de darlo por texto: puede ser la ficha de condiciones, que no trae
    // cuadro pero sí el importe, las fechas y el tipo.
    const condiciones = leerCondicionesPrestamo(filas)
    if (condiciones) return condiciones
    // El Excel del banco viene en columnas; un PDF, en líneas de texto. Si no
    // hay tabla por columnas se intenta leer el texto tal cual.
    return leerTextoPrestamo(filas.map((f) => f.map(texto).filter((c) => c !== '').join(' ')))
  }

  // Bankinter identifica el préstamo por el IBAN de su cuenta, no por un
  // rótulo «Contrato».
  const iban = ibanDelFichero(filas)
  if (iban?.entidad) {
    datos.entidad = iban.entidad
    encontrados.push('entidad')
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
    const fecha = fechaDeCelda(f[cab.col.vencimiento])
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
      const fOper = fechaDeCelda(f[cab.col.operacion]) ?? fecha
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
    const primera = cuerpo.find((f) => fechaDeCelda(f[cab2.col.vencimiento]))
    const pend = primera ? val(primera, cab2.col.pendiente) : undefined
    const amort = primera ? val(primera, cab2.col.amortizado) : undefined
    if (pend !== undefined && amort !== undefined) {
      datos.importeOriginal = Math.round((pend + amort) * 100) / 100
      encontrados.push('importeOriginal')
      avisos.push('El importe inicial se ha reconstruido sumando capital pendiente y amortizado; confírmalo.')
    } else if (pend !== undefined && cuotas[0]?.principal !== undefined) {
      // Sin columna de capital amortizado (Bankinter), el capital vivo antes de
      // la primera cuota es pendiente + su principal. Eso solo es el importe
      // inicial si el cuadro trae TODAS las cuotas, y se comprueba: la suma de
      // los principales tiene que dar lo mismo. Si no cuadra, no se rellena.
      const vivo = Math.round((pend + cuotas[0].principal) * 100) / 100
      const suma = Math.round(cuotas.reduce((s, c) => s + (c.principal ?? 0), 0) * 100) / 100
      if (Math.abs(vivo - suma) < 0.02) {
        datos.importeOriginal = vivo
        encontrados.push('importeOriginal')
        avisos.push('El importe inicial se ha reconstruido con el cuadro completo; confírmalo.')
      }
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
  const importeOriginal = primero((l) => l.importeOriginal)
  const cuota = primero((l) => l.cuota)
  const tipoInteres = primero((l) => l.tipoInteres) ?? (periodicidad ? tipoDeCuadro(cuotas, periodicidad) : undefined)
  // El fichero puede listar solo parte del cuadro (CaixaBank imprime 10 filas):
  // el plazo real se deduce del importe, el tipo y la cuota.
  const deducido =
    importeOriginal !== undefined && tipoInteres !== undefined && cuota !== undefined
      ? nPeriodosPorCuota(importeOriginal, tipoInteres, cuota, periodicidad ?? 'MENSUAL')
      : undefined
  const fusion: DatosPrestamo = {
    numeroContrato: primero((l) => l.numeroContrato),
    entidad: primero((l) => l.entidad),
    nombreProducto: primero((l) => l.nombreProducto),
    cifTitular: primero((l) => l.cifTitular),
    importeOriginal,
    fechaInicio: primero((l) => l.fechaInicio),
    comisionApertura: primero((l) => l.comisionApertura),
    cuota,
    nPagadas,
    nPendientes: cuotas.length - nPagadas,
    nPeriodos: primero((l) => l.nPeriodos) ?? deducido ?? cuotas.length,
    periodicidad,
    sistema: primero((l) => l.sistema),
    tipoInteres,
    capitalPendiente: primero((l) => l.capitalPendiente),
    cuotas,
    avisos: [...new Set(validas.flatMap((l) => l.avisos))],
    encontrados: [...new Set(validas.flatMap((l) => l.encontrados))],
  }

  // Si un fichero trae la formalización, el importe inicial es un dato leído y
  // no una reconstrucción: sobra el aviso del otro fichero.
  const hayFormalizacion = validas.some((l) => l.importeOriginal !== undefined && l.fechaInicio !== undefined)
  if (hayFormalizacion) fusion.avisos = fusion.avisos.filter((a) => !/reconstruido/.test(a))

  if (deducido !== undefined && deducido > cuotas.length) {
    fusion.avisos.push(
      `El fichero lista ${cuotas.length} cuotas, pero el préstamo son ${deducido}: el resto no venía impreso. ` +
        'Se ha tomado el plazo completo; compruébalo.',
    )
  }

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

// ─────────────── Lectura por texto (PDF y hojas sin columnas) ───────────────

/**
 * No todos los bancos dan una tabla con columnas. CaixaBank imprime el cuadro
 * como líneas de texto —«14 01/09/2026 494,43 33,01 527,44 7.150,34»— y la
 * cabecera entera en una sola línea. Aquí se lee eso:
 *  · el **orden de las columnas se toma de la propia cabecera**, no se supone;
 *  · una fila es cualquier línea con una fecha y al menos dos importes.
 * Y de la ficha del préstamo se sacan tipo de interés, fecha de constitución
 * e importe, que en ese banco no están en el cuadro.
 */
const RE_IMPORTE_TXT = /-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}/g
const RE_FECHA_TXT = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/

/** Columnas de importe en el orden en que aparecen en la línea de cabecera. */
export function ordenColumnas(cabecera: string): ('principal' | 'intereses' | 'cuota' | 'pendiente')[] {
  const n = normalizar(cabecera)
  const marcas: { pos: number; col: 'principal' | 'intereses' | 'cuota' | 'pendiente' }[] = []
  const buscar = (col: 'principal' | 'intereses' | 'cuota' | 'pendiente', ...frases: string[]) => {
    for (const f of frases) {
      const pos = n.indexOf(f)
      if (pos !== -1) {
        marcas.push({ pos, col })
        return
      }
    }
  }
  // «capital pendiente» primero: si no, «capital» se lo llevaría amortización.
  buscar('pendiente', 'capital pendiente', 'saldo pendiente')
  buscar('principal', 'amortizacion', 'importe principal', 'capital amortizado', 'capital')
  buscar('intereses', 'intereses', 'interes')
  buscar('cuota', 'importe de cuota', 'importe del movimiento', 'total', 'cuota')
  return marcas.sort((a, b) => a.pos - b.pos).map((m) => m.col)
}

/** Nº de cuotas que hace que la cuota calculada coincida con la del banco. */
export function nPeriodosPorCuota(
  principal: number,
  tipoAnual: number,
  cuota: number,
  periodicidad: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL',
): number | undefined {
  if (principal <= 0 || cuota <= 0) return undefined
  if (tipoAnual === 0) return Math.round(principal / cuota)
  const i = tipoAnual / 100 / PERIODOS_ANIO[periodicidad]
  const x = 1 - (principal * i) / cuota
  // Con una cuota que no cubre ni los intereses, el préstamo no se amortiza.
  if (x <= 0) return undefined
  const n = -Math.log(x) / Math.log(1 + i)
  return Number.isFinite(n) && n > 0 && n < 1000 ? Math.round(n) : undefined
}

export function leerTextoPrestamo(lineas: string[]): DatosPrestamo {
  const avisos: string[] = []
  const encontrados: string[] = []
  const datos: DatosPrestamo = { cuotas: [], avisos, encontrados }
  const texto = lineas.join('\n')
  // Mismo largo que `texto`, así una posición vale para los dos.
  const plano = aplanar(texto)

  // ── Cabecera del cuadro y orden de sus columnas ──
  const iCab = lineas.findIndex((l) => {
    const x = normalizar(l)
    return x.includes('vencimiento') && (x.includes('amortizacion') || x.includes('intereses') || x.includes('capital'))
  })
  const orden = iCab >= 0 ? ordenColumnas(lineas[iCab]) : []

  const cuotas: CuotaLeida[] = []
  for (const l of lineas) {
    const mf = RE_FECHA_TXT.exec(l)
    if (!mf) continue
    const fecha = parsearFechaFlexible(mf[1])
    if (!fecha) continue
    // Los importes que van DESPUÉS de la fecha son los de la fila.
    const resto = l.slice(l.indexOf(mf[1]) + mf[1].length)
    const importes = [...resto.matchAll(RE_IMPORTE_TXT)].map((m) => parsearImporte(m[0], 'ES')).filter((v): v is number => v !== null)
    if (importes.length < 2) continue

    const fila: CuotaLeida = { fecha, cuota: 0, pagada: false }
    if (orden.length === importes.length) {
      orden.forEach((col, i) => {
        if (col === 'cuota') fila.cuota = importes[i]
        else fila[col] = importes[i]
      })
    } else {
      // Sin cabecera fiable: el último importe es el capital pendiente y el
      // mayor de los demás, la cuota.
      fila.pendiente = importes[importes.length - 1]
      fila.cuota = Math.max(...importes.slice(0, -1))
    }
    if (fila.cuota > 0) cuotas.push(fila)
  }

  cuotas.sort((a, b) => a.fecha.localeCompare(b.fecha))

  // ── Datos de la ficha del préstamo ──
  // Las etiquetas pueden estar partidas en dos líneas («Fecha» / «constitución»),
  // así que el salto de línea cuenta como un espacio más al buscarlas.
  const trasEtiqueta = (etiquetas: string[], patron: RegExp): string | undefined => {
    for (const e of etiquetas) {
      const re = new RegExp(e.replace(/ /g, '\\s+'), 'g')
      let m: RegExpExecArray | null
      while ((m = re.exec(plano)) !== null) {
        const trozo = texto.slice(m.index, m.index + 220)
        const v = patron.exec(trozo)
        if (v) return v[1]
      }
    }
    return undefined
  }

  const contrato = trasEtiqueta(['numero de contrato', 'nº de contrato', 'contrato'], /[:\s]\s*([0-9][0-9.\-/ ]{6,30}[0-9])/)
  if (contrato) {
    datos.numeroContrato = contrato.trim()
    encontrados.push('numeroContrato')
  }
  const producto = trasEtiqueta(['tipo de contrato', 'tipo de prestamo', 'nombre comercial'], /:\s*([^\n]{3,60})/)
  if (producto) {
    datos.nombreProducto = producto.trim()
    encontrados.push('nombreProducto')
  }

  // La entidad, por el IBAN de la cuenta vinculada (4 cifras tras «ES»+control).
  const iban = /\bES\d{2}\s?(\d{4})\b/.exec(texto)
  if (iban && ENTIDADES[iban[1]]) {
    datos.entidad = ENTIDADES[iban[1]]
    encontrados.push('entidad')
  }

  const tipo = trasEtiqueta(['tipo de interes'], /(\d{1,2}[,.]\d{1,3})\s*%/)
  if (tipo) {
    datos.tipoInteres = parsearImporte(tipo, 'ES') ?? undefined
    if (datos.tipoInteres !== undefined) encontrados.push('tipoInteres')
  }

  // «Fecha» y «constitución» pueden acabar en líneas distintas porque el PDF
  // entrelaza columnas, así que también se busca la palabra suelta.
  const constitucion = trasEtiqueta(
    ['fecha constitucion', 'fecha de constitucion', 'fecha de formalizacion', 'constitucion', 'formalizacion'],
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  )
  if (constitucion) {
    datos.fechaInicio = parsearFechaFlexible(constitucion) ?? undefined
    if (datos.fechaInicio) encontrados.push('fechaInicio')
  }

  // Importe concedido: el que va en el título del producto («… de 12.000€»).
  const concedido = /\bde\s+(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/.exec(texto)
  if (concedido) {
    datos.importeOriginal = parsearImporte(concedido[1], 'ES') ?? undefined
    if (datos.importeOriginal !== undefined) encontrados.push('importeOriginal')
  }

  if (cuotas.length > 0) {
    datos.cuotas = cuotas
    encontrados.push('cuotas')
    datos.nPagadas = 0
    datos.nPendientes = cuotas.length
    const frecuencia = new Map<number, number>()
    for (const c of cuotas) frecuencia.set(c.cuota, (frecuencia.get(c.cuota) ?? 0) + 1)
    datos.cuota = [...frecuencia.entries()].sort((a, b) => b[1] - a[1])[0][0]
    encontrados.push('cuota')
    datos.periodicidad = periodicidadDe(cuotas.map((c) => c.fecha))
    if (datos.periodicidad) encontrados.push('periodicidad')
    datos.sistema = new Set(cuotas.map((c) => c.cuota)).size <= 3 ? 'FRANCES' : 'LINEAL'
    const primera = cuotas[0]
    if (primera.pendiente !== undefined && primera.principal !== undefined) {
      datos.capitalPendiente = Math.round((primera.pendiente + primera.principal) * 100) / 100
    }
    if (datos.tipoInteres === undefined && datos.periodicidad) {
      const t = tipoDeCuadro(cuotas, datos.periodicidad)
      if (t !== undefined) {
        datos.tipoInteres = t
        encontrados.push('tipoInteres')
        avisos.push(`El tipo de interés (${t} % anual) se ha calculado con el propio cuadro. Confírmalo con la escritura.`)
      }
    }
  }

  // El nº de cuotas rara vez viene escrito: se deduce del importe, el tipo y la
  // cuota, y la pantalla comprueba después que la cuota resultante coincide.
  const per = datos.periodicidad ?? 'MENSUAL'
  if (datos.importeOriginal !== undefined && datos.tipoInteres !== undefined && datos.cuota !== undefined) {
    const nP = nPeriodosPorCuota(datos.importeOriginal, datos.tipoInteres, datos.cuota, per)
    if (nP !== undefined) {
      datos.nPeriodos = nP
      datos.periodicidad = per
      encontrados.push('nPeriodos')
      avisos.push(`El nº de cuotas (${nP}) se ha deducido del importe, el tipo y la cuota. Comprueba que cuadra.`)
    }
  }

  if (datos.encontrados.length === 0) {
    avisos.push(
      'No se reconoce el préstamo en este fichero. Sube el cuadro de amortización y la ficha del préstamo que descarga el ' +
        'banco (Excel o PDF).',
    )
  }
  return datos
}
