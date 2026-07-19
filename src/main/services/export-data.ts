// Reúne y calcula los datos de un cuadrante mensual para exportarlo.
import { empresas, centros, trabajadores, cuadrantes } from '../db/repos'
import { resumenMesTrabajador, horasDia, horasCentroMes } from '../../shared/calculos'
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
