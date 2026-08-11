import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Regresión de una pérdida de datos real: al usuario le apareció «Sin empresa
 * configurada» y, si la app hubiera seguido guardando el snapshot diario de un
 * arranque en blanco, ese backup vacío habría ido empujando fuera a los buenos
 * (la retención es de 7). Un snapshot vacío **nunca** puede pisar el histórico.
 */
const almacen: { lista: unknown[] } = { lista: [] }
vi.mock('./db', () => ({
  cargarSnapshots: async () => almacen.lista,
  guardarSnapshots: async (l: unknown[]) => { almacen.lista = l },
}))

const { crearSnapshotDiario } = await import('./copias')
const { configuracionInicial } = await import('../dominio/defaults')

function datosVacios() {
  return {
    terceros: [], ventas: [], compras: [], recurrentes: [], cuentasTesoreria: [], movimientos: [], arqueos: [],
    almacenes: [], articulos: [], movimientosStock: [], importaciones: [], deudas: [], rentings: [], polizas: [],
    tarjetasCredito: [], deudores: [], presupuestos: [], logsSync: [], inversiones: [], operacionesInversion: [],
    valoracionesInversion: [],
  }
}

const conEmpresa = () => ({ ...configuracionInicial(), empresa: { ...configuracionInicial().empresa, razonSocial: 'BESPAIN 7777 SLU', cif: 'B56241854' } })

describe('snapshots diarios', () => {
  beforeEach(() => { almacen.lista = [] })

  it('guarda el del día cuando hay datos', async () => {
    await crearSnapshotDiario(conEmpresa(), datosVacios(), '2026-08-10T09:00:00.000Z')
    expect(almacen.lista.length).toBe(1)
  })

  it('NO pisa el histórico con un snapshot vacío', async () => {
    await crearSnapshotDiario(conEmpresa(), datosVacios(), '2026-08-09T09:00:00.000Z')
    // Al día siguiente la app arranca en blanco: ese backup no debe guardarse.
    await crearSnapshotDiario(configuracionInicial(), datosVacios(), '2026-08-10T09:00:00.000Z')
    expect(almacen.lista.length).toBe(1)
    expect((almacen.lista[0] as { fecha: string }).fecha.slice(0, 10)).toBe('2026-08-09')
  })

  it('sin histórico previo sí guarda, aunque esté vacío (primer arranque)', async () => {
    await crearSnapshotDiario(configuracionInicial(), datosVacios(), '2026-08-10T09:00:00.000Z')
    expect(almacen.lista.length).toBe(1)
  })

  it('no repite el snapshot del mismo día', async () => {
    await crearSnapshotDiario(conEmpresa(), datosVacios(), '2026-08-10T09:00:00.000Z')
    await crearSnapshotDiario(conEmpresa(), datosVacios(), '2026-08-10T20:00:00.000Z')
    expect(almacen.lista.length).toBe(1)
  })
})
