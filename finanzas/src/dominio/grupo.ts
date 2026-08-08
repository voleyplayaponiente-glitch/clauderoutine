/**
 * Estructura societaria del grupo (parte pura y testeable).
 *
 * Principio que NO se puede romper: cada empresa es una entidad jurídica
 * independiente, con su CIF, sus libros y sus modelos. Los datos de cada una
 * viven en su propio espacio y NUNCA se mezclan. Este módulo solo describe
 * QUIÉN PARTICIPA EN QUIÉN, y agrega cifras ya calculadas por empresa para la
 * vista de dirección.
 *
 * IMPORTANTE: `agregarGrupo` es una SUMA, no una consolidación contable. No
 * elimina operaciones intragrupo (ventas entre empresas, dividendos internos,
 * préstamos entre ellas), así que sus cifras NO sirven para depositar cuentas
 * consolidadas. La UI debe decirlo de forma visible.
 */
import type { ID } from './tipos'
import type { Socio } from './socios'

export const VERSION_GRUPO = 1

/** Ficha mínima de una empresa en el índice del grupo (el detalle vive en su espacio). */
export interface EmpresaResumen {
  id: ID
  razonSocial: string
  cif: string
  /** Sociedad cabecera: su actividad es tenencia y control de participadas. */
  esHolding: boolean
  creadaEn: string
  color?: string
  /** Capital social escriturado (Registro Mercantil), en euros. */
  capitalSocial?: number
}

/** Participación de una empresa (matriz) en el capital de otra (participada). */
export interface Participacion {
  id: ID
  matrizId: ID
  participadaId: ID
  porcentaje: number // 0 < p <= 100
  desde?: string
}

export interface Grupo {
  version: number
  nombre: string
  empresas: EmpresaResumen[]
  participaciones: Participacion[]
  /** Libro registro de socios de cada empresa (personas y terceros ajenos al grupo). */
  socios: Socio[]
  empresaActivaId: ID
}

/**
 * Relación con la participada según el porcentaje de control, con la
 * terminología del PGC (NECA 13.ª) y de las normas de consolidación:
 *  · DEPENDIENTE (> 50 %): hay control.
 *  · ASOCIADA (>= 20 %): influencia significativa.
 *  · PARTICIPADA (< 20 %): mera inversión financiera.
 * Los umbrales son los de la norma; se exponen aquí para poder citarlos en la UI.
 */
export type Relacion = 'DEPENDIENTE' | 'ASOCIADA' | 'PARTICIPADA'

export function relacionPorPorcentaje(porcentaje: number): Relacion {
  if (porcentaje > 50) return 'DEPENDIENTE'
  if (porcentaje >= 20) return 'ASOCIADA'
  return 'PARTICIPADA'
}

export const ETIQUETA_RELACION: Record<Relacion, string> = {
  DEPENDIENTE: 'Dependiente (control)',
  ASOCIADA: 'Asociada (influencia significativa)',
  PARTICIPADA: 'Participada',
}

export function grupoInicial(empresa: EmpresaResumen, nombre = 'Mi grupo'): Grupo {
  return { version: VERSION_GRUPO, nombre, empresas: [empresa], participaciones: [], socios: [], empresaActivaId: empresa.id }
}

export function empresaPorId(grupo: Grupo, id: ID): EmpresaResumen | undefined {
  return grupo.empresas.find((e) => e.id === id)
}

/** Participaciones directas que ostenta `matrizId`. */
export function participadasDe(grupo: Grupo, matrizId: ID): Participacion[] {
  return grupo.participaciones.filter((p) => p.matrizId === matrizId)
}

/** Participaciones directas sobre `participadaId` (su accionariado conocido). */
export function accionistasDe(grupo: Grupo, participadaId: ID): Participacion[] {
  return grupo.participaciones.filter((p) => p.participadaId === participadaId)
}

/** Porcentaje del capital de `participadaId` ya repartido entre otras matrices. */
export function porcentajeAsignado(grupo: Grupo, participadaId: ID, excluyendoId?: ID): number {
  return accionistasDe(grupo, participadaId)
    .filter((p) => p.id !== excluyendoId)
    .reduce((s, p) => s + p.porcentaje, 0)
}

/** ¿Se llega de `desdeId` a `hastaId` siguiendo participaciones? (detección de ciclos) */
export function alcanza(grupo: Grupo, desdeId: ID, hastaId: ID): boolean {
  const vistos = new Set<ID>()
  const pila = [desdeId]
  while (pila.length > 0) {
    const actual = pila.pop() as ID
    if (actual === hastaId && actual !== desdeId) return true
    if (vistos.has(actual)) continue
    vistos.add(actual)
    for (const p of participadasDe(grupo, actual)) pila.push(p.participadaId)
  }
  return false
}

export interface Validacion {
  valido: boolean
  motivo?: string
}

/**
 * Valida una participación antes de guardarla. Si `p.id` ya existe se trata
 * como edición (no cuenta contra sí misma al sumar el capital).
 */
export function validarParticipacion(grupo: Grupo, p: Participacion): Validacion {
  if (!empresaPorId(grupo, p.matrizId)) return { valido: false, motivo: 'La empresa matriz no existe' }
  if (!empresaPorId(grupo, p.participadaId)) return { valido: false, motivo: 'La empresa participada no existe' }
  if (p.matrizId === p.participadaId) return { valido: false, motivo: 'Una empresa no puede participar en sí misma' }
  if (!(p.porcentaje > 0) || p.porcentaje > 100) return { valido: false, motivo: 'El porcentaje debe estar entre 0 y 100' }

  const duplicada = grupo.participaciones.some(
    (x) => x.id !== p.id && x.matrizId === p.matrizId && x.participadaId === p.participadaId,
  )
  if (duplicada) return { valido: false, motivo: 'Ya existe una participación entre esas dos empresas' }

  const asignado = porcentajeAsignado(grupo, p.participadaId, p.id)
  // Tolerancia por redondeo al teclear porcentajes con decimales.
  if (asignado + p.porcentaje > 100.0001) {
    return { valido: false, motivo: `El capital repartido superaría el 100 % (ya hay un ${asignado} % asignado)` }
  }

  // Un ciclo (A participa en B y B en A) haría infinito el cálculo del
  // porcentaje efectivo y no representa ninguna estructura societaria real.
  const sinEsta: Grupo = { ...grupo, participaciones: grupo.participaciones.filter((x) => x.id !== p.id) }
  if (p.participadaId === p.matrizId || alcanza(sinEsta, p.participadaId, p.matrizId)) {
    return { valido: false, motivo: 'Esa participación crearía un círculo entre empresas (A participa en B y B en A)' }
  }
  return { valido: true }
}

/**
 * Porcentaje efectivo (interés económico) de `matrizId` sobre `participadaId`,
 * sumando todos los caminos y multiplicando por el camino. Ejemplo: el holding
 * tiene el 60 % de A y A el 50 % de B → el holding tiene un 30 % efectivo de B.
 */
export function porcentajeEfectivo(grupo: Grupo, matrizId: ID, participadaId: ID): number {
  if (matrizId === participadaId) return 100
  let total = 0
  for (const p of participadasDe(grupo, matrizId)) {
    if (p.participadaId === participadaId) total += p.porcentaje
    else total += (p.porcentaje / 100) * porcentajeEfectivo(grupo, p.participadaId, participadaId)
  }
  return redondear2(total)
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface NodoOrganigrama {
  empresa: EmpresaResumen
  nivel: number
  /** Porcentaje directo con el que cuelga de su padre (undefined en la raíz). */
  porcentaje?: number
  relacion?: Relacion
  hijos: NodoOrganigrama[]
}

/**
 * Árbol del grupo. Las raíces son las empresas sin ningún accionista dentro del
 * grupo (típicamente el holding). Las empresas sueltas aparecen como raíz para
 * que nunca se pierda ninguna de vista.
 */
export function organigrama(grupo: Grupo): NodoOrganigrama[] {
  const raices = grupo.empresas.filter((e) => accionistasDe(grupo, e.id).length === 0)
  return raices.map((e) => construirNodo(grupo, e, 0, undefined))
}

function construirNodo(grupo: Grupo, empresa: EmpresaResumen, nivel: number, porcentaje?: number): NodoOrganigrama {
  const hijos = participadasDe(grupo, empresa.id)
    .map((p) => {
      const hija = empresaPorId(grupo, p.participadaId)
      return hija ? construirNodo(grupo, hija, nivel + 1, p.porcentaje) : undefined
    })
    .filter((n): n is NodoOrganigrama => n !== undefined)
  return {
    empresa,
    nivel,
    porcentaje,
    relacion: porcentaje === undefined ? undefined : relacionPorPorcentaje(porcentaje),
    hijos,
  }
}

/** Aplana el organigrama en filas listas para pintar en una tabla. */
export function filasOrganigrama(grupo: Grupo): NodoOrganigrama[] {
  const filas: NodoOrganigrama[] = []
  const recorrer = (n: NodoOrganigrama) => {
    filas.push(n)
    n.hijos.forEach(recorrer)
  }
  organigrama(grupo).forEach(recorrer)
  return filas
}

// ───────────────────────────── Vista agregada ─────────────────────────────

/** Cifras de una empresa, ya calculadas en su propio espacio de datos. */
export interface CifrasEmpresa {
  empresaId: ID
  razonSocial: string
  tesoreria: number
  ventaMes: number
  resultadoMes: number
  deudaTotal: number
  stockValorado: number
}

export interface AgregadoGrupo {
  empresas: CifrasEmpresa[]
  tesoreria: number
  ventaMes: number
  resultadoMes: number
  deudaTotal: number
  stockValorado: number
}

/**
 * Suma las cifras de todas las empresas. NO es una consolidación: no elimina
 * saldos ni operaciones entre empresas del grupo, de modo que las cifras pueden
 * estar infladas si hay tráfico intragrupo. Sirve para dirección, no para
 * depositar cuentas consolidadas.
 */
export function agregarGrupo(cifras: CifrasEmpresa[]): AgregadoGrupo {
  const suma = (f: (c: CifrasEmpresa) => number) => redondear2(cifras.reduce((s, c) => s + f(c), 0))
  return {
    empresas: cifras,
    tesoreria: suma((c) => c.tesoreria),
    ventaMes: suma((c) => c.ventaMes),
    resultadoMes: suma((c) => c.resultadoMes),
    deudaTotal: suma((c) => c.deudaTotal),
    stockValorado: suma((c) => c.stockValorado),
  }
}
