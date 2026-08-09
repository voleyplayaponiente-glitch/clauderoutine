/**
 * Tarjetas de crédito: **deuda financiera a corto plazo**.
 *
 * Lo gastado con la tarjeta se le debe al banco hasta la liquidación, así que
 * cuenta como deuda aunque no tenga cuadro de amortización. Dos modalidades muy
 * distintas:
 *  · **FIN_DE_MES** — se paga entero en el cargo mensual y no devenga
 *    intereses. Es deuda a días: aparece y desaparece cada mes.
 *  · **APLAZADO** — se paga a plazos y devenga interés, normalmente **el más
 *    caro de toda la financiación de la empresa**. Por eso se destaca.
 *
 * No se inventa el saldo: se teclea o se cuadra con el extracto. Lo que sí se
 * calcula es cuánto se ha gastado con esa tarjeta según las compras ya
 * registradas, para poder cotejarlo.
 */
import { aCentimos, aEuros, redondear2 } from './dinero'
import { totalesCompra } from './compras'
import type { Compra, TarjetaCredito } from './tipos'

/** Umbral de consumo por defecto, igual que en la póliza. */
export const UMBRAL_TARJETA = 75

export interface SituacionTarjeta {
  limite: number
  dispuesto: number
  disponible: number
  porcentajeDispuesto: number
  /** Se ha pasado del límite: el banco lo cobra caro y puede bloquearla. */
  excedida: boolean
}

export function situacionTarjeta(t: TarjetaCredito): SituacionTarjeta {
  const disponible = aEuros(aCentimos(t.limite) - aCentimos(t.dispuesto))
  return {
    limite: t.limite,
    dispuesto: t.dispuesto,
    disponible: Math.max(0, disponible),
    porcentajeDispuesto: t.limite > 0 ? redondear2((t.dispuesto / t.limite) * 100) : 0,
    excedida: disponible < 0,
  }
}

/**
 * Lo gastado con esta tarjeta en un mes según las compras registradas.
 * Es un **contraste**, no el saldo: sirve para ver si lo que dice el extracto
 * cuadra con lo que hay metido en Compras.
 */
export function gastoDelMes(t: TarjetaCredito, compras: Compra[], mes: string): number {
  if (!t.tarjetaId) return 0
  let cent = 0
  for (const c of compras) {
    if (c.anuladoEn || c.tarjetaId !== t.tarjetaId) continue
    if ((c.fechaFactura ?? '').slice(0, 7) !== mes) continue
    cent += aCentimos(totalesCompra(c).total)
  }
  return aEuros(cent)
}

/**
 * Coste anual estimado del saldo aplazado. Con pago a fin de mes es 0: no hay
 * intereses, y decirlo importa porque es la diferencia entre una tarjeta cara
 * y una gratis.
 */
export function costeAnualTarjeta(t: TarjetaCredito): number {
  if (t.modalidad !== 'APLAZADO' || !t.tipoInteres) return 0
  return aEuros(Math.round((aCentimos(t.dispuesto) * t.tipoInteres) / 100))
}

export function avisosTarjeta(t: TarjetaCredito, compras: Compra[], mes: string): string[] {
  const avisos: string[] = []
  const s = situacionTarjeta(t)
  const umbral = t.umbralAviso ?? UMBRAL_TARJETA

  if (s.excedida) {
    avisos.push('Se ha pasado del límite: el banco cobra comisión por excedido y puede bloquear la tarjeta.')
  } else if (s.porcentajeDispuesto >= umbral) {
    avisos.push(`Consumida al ${s.porcentajeDispuesto.toFixed(1)} % del límite, por encima del ${umbral} % que te has marcado.`)
  }

  if (t.modalidad === 'APLAZADO') {
    const coste = costeAnualTarjeta(t)
    avisos.push(
      t.tipoInteres
        ? `Saldo aplazado al ${t.tipoInteres} %: unos ${coste.toLocaleString('es-ES', { minimumFractionDigits: 2 })} € al año. Suele ser la financiación más cara que tienes; mira si compensa pasarlo a la póliza.`
        : 'Está en modalidad aplazada pero no has indicado el tipo de interés, así que su coste no se puede calcular.',
    )
  }

  // Contraste con lo registrado en Compras, solo si la tarjeta está enlazada.
  if (t.tarjetaId) {
    const gasto = gastoDelMes(t, compras, mes)
    if (gasto > 0 && Math.abs(aCentimos(gasto) - aCentimos(t.dispuesto)) > 100) {
      avisos.push(
        `Este mes hay ${gasto.toLocaleString('es-ES', { minimumFractionDigits: 2 })} € de compras registradas con esta tarjeta y el saldo dispuesto es ` +
          `${t.dispuesto.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €. Puede ser normal (el corte no es el día 1), pero conviene cotejarlo con el extracto.`,
      )
    }
  } else {
    avisos.push('Sin enlazar con una tarjeta de Configuración: no se puede contrastar con las compras pagadas con ella.')
  }

  return avisos
}
