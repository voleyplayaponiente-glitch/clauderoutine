/**
 * Accionariado / libro registro de socios (parte pura y testeable).
 *
 * Modelo mercantil español (S.L.): el capital social se divide en
 * participaciones con un valor nominal, y el **porcentaje de un socio se deriva
 * del capital nominal que ostenta**, no se teclea a mano. Así el reparto no
 * puede quedar descuadrado por un dedazo.
 *
 * · La **prima de emisión** es dinero aportado por encima del nominal: engorda
 *   los fondos propios (cuenta 110) pero NO da más porcentaje.
 * · El **pendiente de desembolso** (socios morosos / desembolsos parciales) se
 *   registra aparte: el socio ya tiene su porcentaje aunque deba dinero.
 * · Las bajas son **lógicas** (`fechaBaja`): un socio que vendió sigue en el
 *   histórico, nunca se borra su rastro.
 *
 * Los socios que a su vez son empresas del grupo NO se dan de alta aquí: esos
 * salen de las participaciones del grupo, y `capTable` los une para que el
 * accionariado sume el 100 % real.
 */
import { aCentimos, aEuros, redondear2, formatearEuro } from './dinero'
import type { ID } from './tipos'
import type { Grupo } from './grupo'
import { accionistasDe, empresaPorId } from './grupo'

export type TipoSocio = 'PERSONA_FISICA' | 'PERSONA_JURIDICA'

export interface Socio {
  id: ID
  empresaId: ID
  nombre: string
  nifCif: string
  tipo: TipoSocio
  /** Capital NOMINAL que ostenta, en euros. De aquí sale su porcentaje. */
  capitalNominal: number
  /** Nº de participaciones o acciones (informativo). */
  numParticipaciones?: number
  /** Aportado por encima del nominal. No da porcentaje. */
  primaEmision?: number
  /** Nominal aún no desembolsado. */
  pendienteDesembolso?: number
  esAdministrador?: boolean
  fechaAlta?: string
  /** Baja lógica: dejó de ser socio en esta fecha. */
  fechaBaja?: string
  notas?: string
}

export const ETIQUETA_TIPO_SOCIO: Record<TipoSocio, string> = {
  PERSONA_FISICA: 'Persona física',
  PERSONA_JURIDICA: 'Persona jurídica',
}

/** Socios vigentes (sin baja) de una empresa. */
export function sociosVigentes(socios: Socio[], empresaId: ID): Socio[] {
  return socios.filter((s) => s.empresaId === empresaId && !s.fechaBaja)
}

/** Socios que causaron baja, para el histórico. */
export function sociosDeBaja(socios: Socio[], empresaId: ID): Socio[] {
  return socios.filter((s) => s.empresaId === empresaId && !!s.fechaBaja)
}

/** Suma del capital nominal en manos de los socios vigentes. */
export function capitalDeSocios(socios: Socio[]): number {
  return aEuros(socios.reduce((s, x) => s + aCentimos(x.capitalNominal), 0))
}

export function primaTotal(socios: Socio[]): number {
  return aEuros(socios.reduce((s, x) => s + aCentimos(x.primaEmision ?? 0), 0))
}

export function pendienteTotal(socios: Socio[]): number {
  return aEuros(socios.reduce((s, x) => s + aCentimos(x.pendienteDesembolso ?? 0), 0))
}

export interface Validacion {
  valido: boolean
  motivo?: string
}

export function validarSocio(socio: Socio): Validacion {
  if (socio.nombre.trim() === '') return { valido: false, motivo: 'Indica el nombre o la razón social del socio' }
  if (socio.capitalNominal < 0) return { valido: false, motivo: 'El capital nominal no puede ser negativo' }
  if ((socio.primaEmision ?? 0) < 0) return { valido: false, motivo: 'La prima de emisión no puede ser negativa' }
  const pendiente = socio.pendienteDesembolso ?? 0
  if (pendiente < 0) return { valido: false, motivo: 'El pendiente de desembolso no puede ser negativo' }
  if (aCentimos(pendiente) > aCentimos(socio.capitalNominal)) {
    return { valido: false, motivo: 'El pendiente de desembolso no puede superar el capital nominal suscrito' }
  }
  if ((socio.numParticipaciones ?? 0) < 0) return { valido: false, motivo: 'El nº de participaciones no puede ser negativo' }
  return { valido: true }
}

// ─────────────────────── Cuadro de accionariado (cap table) ───────────────────────

export type OrigenParticipe = 'SOCIO' | 'EMPRESA_GRUPO'

export interface FilaAccionariado {
  id: ID
  origen: OrigenParticipe
  nombre: string
  nifCif: string
  tipo: TipoSocio
  /** Nominal en euros. En empresas del grupo se deduce del % y del capital. */
  capitalNominal: number
  porcentaje: number
  numParticipaciones?: number
  esAdministrador?: boolean
}

/**
 * Cuadro completo de propiedad de una empresa: sus socios registrados más las
 * empresas del grupo que participan en ella.
 *
 * El porcentaje de un socio sale de su nominal sobre el `capitalReferencia`
 * (el escriturado si se conoce; si no, la suma de lo aportado por los socios).
 * Para las empresas del grupo el porcentaje ya está dado, y el nominal se
 * deduce de él.
 */
export function capTable(grupo: Grupo, empresaId: ID, socios: Socio[]): FilaAccionariado[] {
  const vigentes = sociosVigentes(socios, empresaId)
  const empresa = empresaPorId(grupo, empresaId)
  const escriturado = empresa?.capitalSocial ?? 0
  const deSocios = capitalDeSocios(vigentes)
  const referencia = escriturado > 0 ? escriturado : deSocios

  const filasSocios: FilaAccionariado[] = vigentes.map((s) => ({
    id: s.id,
    origen: 'SOCIO',
    nombre: s.nombre,
    nifCif: s.nifCif,
    tipo: s.tipo,
    capitalNominal: s.capitalNominal,
    porcentaje: referencia > 0 ? redondear2((s.capitalNominal / referencia) * 100) : 0,
    numParticipaciones: s.numParticipaciones,
    esAdministrador: s.esAdministrador,
  }))

  const filasGrupo: FilaAccionariado[] = accionistasDe(grupo, empresaId).map((p) => {
    const matriz = empresaPorId(grupo, p.matrizId)
    return {
      id: p.id,
      origen: 'EMPRESA_GRUPO',
      nombre: matriz?.razonSocial || 'Empresa del grupo',
      nifCif: matriz?.cif ?? '',
      tipo: 'PERSONA_JURIDICA' as TipoSocio,
      capitalNominal: referencia > 0 ? redondear2((p.porcentaje / 100) * referencia) : 0,
      porcentaje: p.porcentaje,
      esAdministrador: false,
    }
  })

  return [...filasGrupo, ...filasSocios].sort((a, b) => b.porcentaje - a.porcentaje)
}

export interface ResumenAccionariado {
  /** Capital que consta escriturado en la ficha de la empresa. */
  capitalEscriturado: number
  /** Nominal efectivamente repartido entre socios y empresas del grupo. */
  capitalRepartido: number
  /** Diferencia entre lo escriturado y lo repartido (0 = cuadra). */
  descuadre: number
  cuadra: boolean
  porcentajeCubierto: number
  primaEmision: number
  pendienteDesembolso: number
  /** Un único titular al 100 %: la sociedad es unipersonal (S.L.U./S.A.U.). */
  esUnipersonal: boolean
  /** Titular con más del 50 %, si lo hay. */
  socioMayoritario?: FilaAccionariado
  numTitulares: number
}

/**
 * Resumen del accionariado. Un descuadre entre el capital escriturado y el
 * repartido NUNCA se oculta: se devuelve para pintarlo en rojo.
 */
export function resumenAccionariado(grupo: Grupo, empresaId: ID, socios: Socio[]): ResumenAccionariado {
  const filas = capTable(grupo, empresaId, socios)
  const vigentes = sociosVigentes(socios, empresaId)
  const empresa = empresaPorId(grupo, empresaId)
  const capitalEscriturado = empresa?.capitalSocial ?? 0

  const capitalRepartido = aEuros(filas.reduce((s, f) => s + aCentimos(f.capitalNominal), 0))
  const descuadre = capitalEscriturado > 0 ? aEuros(aCentimos(capitalEscriturado) - aCentimos(capitalRepartido)) : 0
  const porcentajeCubierto = redondear2(filas.reduce((s, f) => s + f.porcentaje, 0))
  const mayoritario = filas.find((f) => f.porcentaje > 50)

  return {
    capitalEscriturado,
    capitalRepartido,
    descuadre,
    cuadra: capitalEscriturado === 0 || aCentimos(descuadre) === 0,
    porcentajeCubierto,
    primaEmision: primaTotal(vigentes),
    pendienteDesembolso: pendienteTotal(vigentes),
    esUnipersonal: filas.length === 1 && filas[0].porcentaje >= 99.995,
    socioMayoritario: mayoritario,
    numTitulares: filas.length,
  }
}

/**
 * Valor nominal por participación, si el socio declaró cuántas tiene.
 * Útil para comprobar que todos los socios usan el mismo nominal unitario.
 */
export function valorNominalUnitario(socio: Socio): number | undefined {
  if (!socio.numParticipaciones || socio.numParticipaciones <= 0) return undefined
  return redondear2(socio.capitalNominal / socio.numParticipaciones)
}

/**
 * Avisos sobre el accionariado, en español y accionables. No bloquean nada:
 * informan de lo que un asesor miraría.
 */
export function avisosAccionariado(grupo: Grupo, empresaId: ID, socios: Socio[]): string[] {
  const r = resumenAccionariado(grupo, empresaId, socios)
  const avisos: string[] = []

  if (r.numTitulares === 0) {
    avisos.push('Todavía no hay ningún socio registrado en esta sociedad.')
    return avisos
  }
  if (!r.cuadra) {
    const falta = r.descuadre > 0
    avisos.push(
      falta
        ? `Faltan ${formatearEuro(r.descuadre)} por repartir para llegar al capital escriturado.`
        : `El capital repartido supera en ${formatearEuro(Math.abs(r.descuadre))} al escriturado.`,
    )
  }
  if (r.porcentajeCubierto > 100.01) {
    avisos.push(`Los porcentajes suman ${r.porcentajeCubierto} %: hay capital contado dos veces.`)
  }
  if (r.pendienteDesembolso > 0) {
    avisos.push(`Quedan ${formatearEuro(r.pendienteDesembolso)} de capital suscrito y no desembolsado.`)
  }
  if (r.esUnipersonal) {
    avisos.push('Sociedad unipersonal: debe constar como tal en la denominación y en la documentación mercantil.')
  }
  const nominales = sociosVigentes(socios, empresaId)
    .map(valorNominalUnitario)
    .filter((n): n is number => n !== undefined)
  if (nominales.length > 1 && new Set(nominales).size > 1) {
    avisos.push('Los socios no declaran el mismo valor nominal por participación: revisa el nº de participaciones.')
  }
  return avisos
}
