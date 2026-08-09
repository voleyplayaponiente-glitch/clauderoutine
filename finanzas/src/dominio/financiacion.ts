/**
 * Resumen de TODA la financiación: préstamos, pólizas, tarjetas de crédito,
 * renting y la deuda no bancaria (Hacienda, Seguridad Social, proveedores…).
 *
 * Pedido por el usuario: *la deuda total bancaria debería sumar los préstamos,
 * las pólizas y los renting, identificando cada total pero con un sumatorio de
 * todo.* Así que hay **un total por bloque y un total general**, y cada bloque
 * dice con qué criterio está medido, porque no todos miden lo mismo:
 *  · Préstamos → **capital vivo** del cuadro de amortización.
 *  · Póliza → **dispuesto** (lo devuelto vuelve a estar disponible).
 *  · Tarjeta de crédito → **saldo pendiente de liquidar**.
 *  · Renting → **compromiso pendiente sin IVA**. Ojo: contablemente NO es deuda
 *    del balance (es un arrendamiento operativo), pero se paga igual todos los
 *    meses y por eso se suma aquí, marcado como compromiso.
 */
import { aCentimos, aEuros } from './dinero'
import { generarCuadro, resumenCuadro, type Cuota } from './amortizacion'
import { polizaConCuenta, situacionPoliza } from './poliza'
import { resumenRenting } from './renting'
import { situacionTarjeta } from './tarjeta-credito'
import type { CuentaTesoreria, Deuda, MovimientoTesoreria, Poliza, Renting, TarjetaCredito } from './tipos'

/**
 * Cuadro de una deuda. Si trae un calendario leído de un documento (un
 * aplazamiento de Hacienda), **manda ese**: sus plazos son los que son y no
 * tienen por qué salir de una fórmula.
 */
export function cuadroDeuda(d: Deuda): Cuota[] {
  if (d.cuadroFijo?.length) {
    let pendiente = d.cuadroFijo.reduce((s, p) => s + aCentimos(p.capital ?? p.cuota), 0)
    return d.cuadroFijo.map((p, i) => {
      const capital = p.capital ?? aEuros(aCentimos(p.cuota) - aCentimos(p.intereses ?? 0))
      pendiente -= aCentimos(capital)
      return {
        numero: i + 1,
        fecha: p.fecha,
        cuota: p.cuota,
        interes: p.intereses ?? aEuros(aCentimos(p.cuota) - aCentimos(capital)),
        capital,
        pendiente: aEuros(Math.max(0, pendiente)),
      }
    })
  }
  return generarCuadro({
    principal: d.importeOriginal,
    tipoAnual: d.tipoInteres,
    nPeriodos: d.nPeriodos,
    periodicidad: d.periodicidad,
    fechaInicio: d.fechaInicio,
    sistema: d.sistema,
  })
}

/** Capital que queda por devolver de una deuda a una fecha. */
export function pendienteDeuda(d: Deuda, hoy: string): number {
  try {
    return resumenCuadro(cuadroDeuda(d)).pendienteA(hoy)
  } catch {
    return 0 // una deuda mal configurada no debe tumbar el resumen
  }
}

export type BloqueFinanciacion = 'PRESTAMOS' | 'POLIZAS' | 'TARJETAS' | 'RENTING' | 'NO_BANCARIA'

export interface LineaFinanciacion {
  bloque: BloqueFinanciacion
  titulo: string
  /** Con qué se mide este bloque; se enseña para no comparar peras con manzanas. */
  criterio: string
  importe: number
  /** Cuántos contratos hay detrás. */
  numero: number
  /** El renting no es deuda del balance aunque se sume al compromiso total. */
  esCompromiso?: boolean
}

export interface ResumenFinanciacion {
  bloques: LineaFinanciacion[]
  /** Préstamos + pólizas + tarjetas + renting. */
  totalBancaria: number
  /** Lo que se debe a Hacienda, Seguridad Social, proveedores, socios… */
  totalNoBancaria: number
  /** Todo junto: es la cifra de «cuánto debemos». */
  total: number
}

/** Tipos de deuda que son financiación bancaria con cuadro. */
const TIPOS_BANCARIOS = ['PRESTAMO', 'LEASING']

export function resumenFinanciacion(
  datos: {
    deudas: Deuda[]
    polizas?: Poliza[]
    rentings?: Renting[]
    tarjetasCredito?: TarjetaCredito[]
    /** Hacen falta para las pólizas que toman lo dispuesto del saldo de la cuenta. */
    cuentasTesoreria?: CuentaTesoreria[]
    movimientos?: MovimientoTesoreria[]
  },
  hoy: string,
): ResumenFinanciacion {
  const vivas = datos.deudas.filter((d) => !d.anuladoEn)

  const prestamos = vivas.filter((d) => TIPOS_BANCARIOS.includes(d.tipo))
  const otras = vivas.filter((d) => !TIPOS_BANCARIOS.includes(d.tipo))
  // La póliza en cuenta corriente lleva el dispuesto en el saldo del banco, no
  // en su propio campo: sin resolverla contra la cuenta sumaría 0.
  const cuentas = (datos.cuentasTesoreria ?? []).filter((c) => !c.anuladoEn)
  const polizas = (datos.polizas ?? [])
    .filter((p) => !p.anuladoEn)
    .map((p) => polizaConCuenta(p, cuentas, datos.movimientos ?? [], hoy))
  const tarjetas = (datos.tarjetasCredito ?? []).filter((t) => !t.anuladoEn)
  const rentings = (datos.rentings ?? []).filter((r) => !r.anuladoEn)

  const suma = (xs: number[]) => aEuros(xs.reduce((s, x) => s + aCentimos(x), 0))

  const bloques: LineaFinanciacion[] = [
    {
      bloque: 'PRESTAMOS',
      titulo: 'Préstamos y leasing',
      criterio: 'capital vivo del cuadro',
      importe: suma(prestamos.map((d) => pendienteDeuda(d, hoy))),
      numero: prestamos.length,
    },
    {
      bloque: 'POLIZAS',
      titulo: 'Pólizas de crédito',
      criterio: 'capital dispuesto',
      importe: suma(polizas.map((p) => situacionPoliza(p).dispuesto)),
      numero: polizas.length,
    },
    {
      bloque: 'TARJETAS',
      titulo: 'Tarjetas de crédito',
      criterio: 'saldo pendiente de liquidar',
      importe: suma(tarjetas.map((t) => situacionTarjeta(t).dispuesto)),
      numero: tarjetas.length,
    },
    {
      bloque: 'RENTING',
      titulo: 'Renting',
      criterio: 'cuotas pendientes sin IVA',
      importe: suma(rentings.map((r) => resumenRenting(r, hoy).compromisoPendiente)),
      numero: rentings.length,
      esCompromiso: true,
    },
    {
      bloque: 'NO_BANCARIA',
      titulo: 'Hacienda, Seguridad Social y otros acreedores',
      criterio: 'pendiente de pagar',
      importe: suma(otras.map((d) => pendienteDeuda(d, hoy))),
      numero: otras.length,
    },
  ]

  const totalBancaria = suma(bloques.filter((b) => b.bloque !== 'NO_BANCARIA').map((b) => b.importe))
  const totalNoBancaria = bloques.find((b) => b.bloque === 'NO_BANCARIA')?.importe ?? 0

  return {
    bloques,
    totalBancaria,
    totalNoBancaria,
    total: aEuros(aCentimos(totalBancaria) + aCentimos(totalNoBancaria)),
  }
}
