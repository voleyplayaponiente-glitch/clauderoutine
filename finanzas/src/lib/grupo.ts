/**
 * Lectura de las cifras de TODAS las empresas del grupo para la vista de
 * dirección. Cada empresa se lee de su propio espacio en IndexedDB y se calcula
 * por separado con el mismo motor que usa su dashboard; aquí solo se suman.
 *
 * Recordatorio: la suma NO es una consolidación contable (no elimina el tráfico
 * intragrupo). La pantalla lo advierte de forma visible.
 */
import { cargarConfig, cargarDatos } from './db'
import { calcularDashboard } from './dashboard'
import { configuracionInicial } from '../dominio/defaults'
import { agregarGrupo, type AgregadoGrupo, type CifrasEmpresa, type Grupo } from '../dominio/grupo'
import type { DatosOperativos } from '../dominio/tipos'

function datosVacios(): DatosOperativos {
  return {
    terceros: [], ventas: [], compras: [], recurrentes: [], cuentasTesoreria: [], movimientos: [], arqueos: [],
    almacenes: [], articulos: [], movimientosStock: [], importaciones: [], deudas: [], deudores: [], presupuestos: [],
    logsSync: [],
  }
}

/** Calcula las cifras de una empresa concreta leyendo su espacio de datos. */
export async function cifrasDeEmpresa(empresaId: string, razonSocial: string, hoy: string): Promise<CifrasEmpresa> {
  const [config, datos] = await Promise.all([cargarConfig(empresaId), cargarDatos(empresaId)])
  const c = config ?? configuracionInicial()
  const d = { ...datosVacios(), ...(datos ?? {}) }
  const dash = calcularDashboard(d, c, hoy)
  return {
    empresaId,
    razonSocial: razonSocial || c.empresa.razonSocial || 'Sin nombre',
    tesoreria: dash.tesoreria,
    ventaMes: dash.ventaMes,
    resultadoMes: dash.resultadoMes,
    deudaTotal: dash.deudaTotal,
    stockValorado: dash.stockValorado,
  }
}

/** Cifras agregadas de todo el grupo, en el orden del índice de empresas. */
export async function agregadoDelGrupo(grupo: Grupo, hoy: string): Promise<AgregadoGrupo> {
  const cifras = await Promise.all(grupo.empresas.map((e) => cifrasDeEmpresa(e.id, e.razonSocial, hoy)))
  return agregarGrupo(cifras)
}
