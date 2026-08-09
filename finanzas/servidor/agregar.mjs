/**
 * Agregación de pedidos de Square a ventas diarias.
 *
 * Square devuelve un pedido por ticket; la app registra **un día por tienda**.
 * Aquí se suman los pedidos de cada (tienda, día) y se reparte el cobro por
 * forma de pago, que es lo que luego permite cuadrar con el banco.
 *
 * Función pura y sin dependencias: se prueba desde los tests de la app aunque
 * viva en el servidor.
 *
 * Dos decisiones que conviene tener presentes:
 *  · La **fecha es la del cierre** del pedido (`closed_at`), no la de creación:
 *    un ticket abierto a las 23:55 y cobrado a las 00:05 es venta del día en que
 *    se cobra. Si no hay cierre se usa la creación, que es lo único que queda.
 *  · Los importes de Square vienen en **céntimos**; aquí se pasan a euros una
 *    sola vez, al final, para no arrastrar redondeos.
 */

/**
 * Forma de cobro de la app según el tipo de «tender» de Square.
 * EXTERNAL y THIRD_PARTY_CARD son cobros por un datáfono que no es de Square:
 * es exactamente lo que en los informes aparece como «Otros / origen del pago
 * desconocido».
 */
export const FORMA_POR_TENDER = {
  CASH: 'EFECTIVO',
  CARD: 'TARJETA',
  THIRD_PARTY_CARD: 'TARJETA',
  EXTERNAL: 'TARJETA',
  WALLET: 'TARJETA',
  SQUARE_GIFT_CARD: 'OTRO',
  BUY_NOW_PAY_LATER: 'APLAZADO',
  BANK_ACCOUNT: 'TRANSFERENCIA',
}

const céntimos = (m) => Number(m?.amount ?? 0)

/** Día al que pertenece el pedido, en la zona horaria que se indique. */
export function diaDelPedido(pedido, desfaseHoras = 0) {
  const iso = pedido.closed_at || pedido.created_at || ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return undefined
  return new Date(t + desfaseHoras * 3_600_000).toISOString().slice(0, 10)
}

/**
 * Agrupa los pedidos por tienda y día.
 * `desfaseHoras` desplaza el corte del día (España: 1 en invierno, 2 en verano)
 * y debe coincidir con el que use el informe de Square para que los números
 * cuadren.
 */
export function agregarVentasSquare(pedidos, desfaseHoras = 0) {
  const porClave = new Map()

  for (const p of pedidos ?? []) {
    const fecha = diaDelPedido(p, desfaseHoras)
    if (!fecha) continue
    const clave = `${p.location_id || ''}|${fecha}`
    const dia =
      porClave.get(clave) ??
      { locationId: p.location_id || '', fecha, totalCent: 0, ivaCent: 0, descuentoCent: 0, devueltoCent: 0, numTickets: 0, cobrosCent: {} }

    dia.totalCent += céntimos(p.total_money)
    dia.ivaCent += céntimos(p.total_tax_money)
    dia.descuentoCent += céntimos(p.total_discount_money)
    // Lo devuelto ya viene restado del total; se guarda solo para informar.
    dia.devueltoCent += céntimos(p.return_amounts?.total_money)
    dia.numTickets += 1

    for (const t of p.tenders ?? []) {
      const forma = FORMA_POR_TENDER[t.type] ?? 'OTRO'
      dia.cobrosCent[forma] = (dia.cobrosCent[forma] ?? 0) + céntimos(t.amount_money)
    }

    porClave.set(clave, dia)
  }

  return [...porClave.values()]
    .map((d) => ({
      locationId: d.locationId,
      fecha: d.fecha,
      // La base es el total menos el IVA: así cuadra siempre con lo cobrado.
      base: (d.totalCent - d.ivaCent) / 100,
      cuota: d.ivaCent / 100,
      total: d.totalCent / 100,
      descuentos: d.descuentoCent / 100,
      devoluciones: d.devueltoCent / 100,
      numTickets: d.numTickets,
      cobros: Object.entries(d.cobrosCent)
        .filter(([, c]) => c !== 0)
        .map(([forma, c]) => ({ forma, importe: c / 100 })),
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.locationId.localeCompare(b.locationId))
}
