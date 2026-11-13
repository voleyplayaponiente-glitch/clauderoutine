// Reúne y calcula los datos de un cuadrante mensual para exportarlo.
import { empresas, centros, trabajadores, cuadrantes } from '../db/repos'
import { resumenMesTrabajador, horasDia, horasCentroMes, trabajadorDeBaja } from '../../shared/calculos'
import { horaAMinutos, hoyIso } from '../../shared/fechas'
import { colorTrabajador } from '../../shared/colores'
import type { Centro, Empresa, Trabajador, Turno } from '../../shared/types'

export interface DatosCuadrante {
  empresa: Empresa
  trabajador: Trabajador
  centrosPorId: Record<number, Centro>
  turnos: Turno[]
  resumen: ReturnType<typeof resumenMesTrabajador>
  anio: number
  mes: number
  horasDiaFn: (t: Turno) => number
}

export function datosCuadrante(trabajadorId: number, anio: number, mes: number): DatosCuadrante {
  const trabajador = trabajadores.obtener(trabajadorId)
  if (!trabajador) throw new Error('Trabajador no encontrado')
  const empresa = empresas.obtener(trabajador.empresa_id)!
  const cuad = cuadrantes.obtenerOCrear(trabajadorId, anio, mes)
  const turnos = cuadrantes.turnos(cuad.id)
  const listaCentros = centros.listar(trabajador.empresa_id)
  const centrosPorId: Record<number, Centro> = {}
  for (const c of listaCentros) centrosPorId[c.id] = c
  const resumen = resumenMesTrabajador(trabajador, turnos)
  return { empresa, trabajador, centrosPorId, turnos, resumen, anio, mes, horasDiaFn: horasDia }
}

export interface FilaResumenCentro {
  centro: Centro
  horas: number
  trabajadores: number
}

export function datosResumenCentros(empresaId: number, anio: number, mes: number) {
  const empresa = empresas.obtener(empresaId)!
  const listaCentros = centros.listar(empresaId)
  const turnos = cuadrantes.turnosMesEmpresa(empresaId, anio, mes)
  const filas: FilaResumenCentro[] = listaCentros.map((c) => {
    const suyos = turnos.filter((t) => t.situacion === 'trabaja' && t.centro_id === c.id)
    const trabs = new Set(suyos.map((t) => t.trabajador_id))
    return { centro: c, horas: horasCentroMes(c.id, turnos), trabajadores: trabs.size }
  })
  const totalHoras = filas.reduce((s, f) => s + f.horas, 0)
  return { empresa, filas, totalHoras, anio, mes }
}

// ---- Cuadrante mensual por centros (el "calendario" de la vista por centro) ----
export interface DatosCuadranteCentros {
  empresa: Empresa
  centros: Centro[]
  anio: number
  mes: number
  /** nombre visible y color efectivo por trabajador */
  trabajadoresPorId: Record<number, { nombre: string; color: string }>
  /** clave `fecha|centroId` → turnos de trabajo ordenados por hora de entrada */
  porDiaCentro: Map<string, Array<Turno & { trabajador_id: number }>>
  /** horas totales del mes por centro */
  horasPorCentro: Record<number, number>
}

export function datosCuadranteCentros(
  empresaId: number,
  anio: number,
  mes: number,
  centroId?: number
): DatosCuadranteCentros {
  const empresa = empresas.obtener(empresaId)
  if (!empresa) throw new Error('Empresa no encontrada')
  // Con centroId se exporta/imprime solo ese centro de trabajo.
  const listaCentros = centros.listar(empresaId).filter((c) => !centroId || c.id === centroId)
  const listaTrabs = trabajadores.listar({ empresaId })
  const trabajadoresPorId: Record<number, { nombre: string; color: string }> = {}
  for (const t of listaTrabs) {
    trabajadoresPorId[t.id] = {
      nombre: t.apellidos || t.nombre,
      color: colorTrabajador(t.color, t.id)
    }
  }
  const turnos = cuadrantes.turnosMesEmpresa(empresaId, anio, mes)
  const porDiaCentro = new Map<string, Array<Turno & { trabajador_id: number }>>()
  const horasPorCentro: Record<number, number> = {}
  for (const t of turnos) {
    if (t.situacion !== 'trabaja' || t.centro_id == null) continue
    const clave = `${t.fecha}|${t.centro_id}`
    if (!porDiaCentro.has(clave)) porDiaCentro.set(clave, [])
    porDiaCentro.get(clave)!.push(t)
    horasPorCentro[t.centro_id] = (horasPorCentro[t.centro_id] ?? 0) + horasDia(t)
  }
  // Dentro de cada día: primero el turno de mañana, luego el de tarde.
  const inicio = (t: Turno): number => {
    const vals = [horaAMinutos(t.entrada1), horaAMinutos(t.entrada2)].filter(
      (x): x is number => x !== null
    )
    return vals.length ? Math.min(...vals) : 9999
  }
  for (const lista of porDiaCentro.values()) lista.sort((a, b) => inicio(a) - inicio(b))
  return { empresa, centros: listaCentros, anio, mes, trabajadoresPorId, porDiaCentro, horasPorCentro }
}

// ---- Listado de trabajadores (datos personales + centros; para PRL/mutua) ----
export type FiltroListado = 'alta' | 'baja' | 'todos'

export interface FilaListadoTrabajador {
  t: Trabajador
  /** nombres de sus centros, el principal primero */
  centros: Array<{ nombre: string; principal: boolean }>
  /** de baja = ficha inactiva o fecha de baja ya alcanzada (regla compartida) */
  deBaja: boolean
}

export function datosListadoTrabajadores(
  empresaId: number,
  filtro: FiltroListado = 'alta'
): {
  empresa: Empresa
  filas: FilaListadoTrabajador[]
  filtro: FiltroListado
} {
  const empresa = empresas.obtener(empresaId)
  if (!empresa) throw new Error('Empresa no encontrada')
  const lista = trabajadores.listar({ empresaId })
  const porTrab = new Map<number, Array<{ nombre: string; principal: boolean }>>()
  for (const a of trabajadores.centrosDeEmpresa(empresaId)) {
    if (!porTrab.has(a.trabajador_id)) porTrab.set(a.trabajador_id, [])
    porTrab.get(a.trabajador_id)!.push({ nombre: a.centro_nombre, principal: a.es_principal === 1 })
  }
  const hoy = hoyIso()
  const filas = lista
    .map((t) => ({ t, centros: porTrab.get(t.id) ?? [], deBaja: trabajadorDeBaja(t, hoy) }))
    .filter((f) => (filtro === 'todos' ? true : filtro === 'baja' ? f.deBaja : !f.deBaja))
  return { empresa, filas, filtro }
}
