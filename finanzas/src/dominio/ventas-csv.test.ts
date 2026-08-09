import { describe, it, expect } from 'vitest'
import { leerVentasCsv, baseYCuota, emparejarPunto } from './ventas-csv'

const CENTROS = [
  { id: 'cc-gv-alicante', codigo: 'GVA', nombre: 'VAPESSENCE GV ALICANTE' },
  { id: 'cc-san-juan', codigo: 'SJU', nombre: 'VAPESPACE SAN JUAN' },
  { id: 'cc-alfafar', codigo: 'ALF', nombre: 'VAPESSENCE ALFAFAR' },
]

describe('CSV de ventas', () => {
  it('lee un fichero con base, IVA y desglose de cobros', () => {
    const r = leerVentasCsv(
      [
        'Fecha;Tienda;Base;IVA;Total;Efectivo;Tarjeta;Bizum;Tickets',
        '01/08/2026;GVA;1.000,00;210,00;1.210,00;400,00;760,00;50,00;37',
        '02/08/2026;SJU;500,00;105,00;605,00;105,00;500,00;;21',
      ].join('\n'),
    )
    expect(r.filas).toHaveLength(2)
    expect(r.descartadas).toEqual([])
    const [a, b] = r.filas
    expect(a).toMatchObject({ fecha: '2026-08-01', puntoTexto: 'GVA', base: 1000, cuota: 210, total: 1210, numTickets: 37 })
    expect(a.cobros).toEqual([
      { forma: 'EFECTIVO', importe: 400 },
      { forma: 'TARJETA', importe: 760 },
      { forma: 'BIZUM', importe: 50 },
    ])
    // El bizum vacío no se cuela como 0.
    expect(b.cobros.map((c) => c.forma)).toEqual(['EFECTIVO', 'TARJETA'])
  })

  it('encuentra la cabecera aunque haya rótulos encima', () => {
    const r = leerVentasCsv(
      ['INFORME DE VENTAS;;;', 'Generado el 08/08/2026;;;', '', 'Fecha;Total;Efectivo;Tarjeta', '01/08/2026;121,00;21,00;100,00'].join('\n'),
    )
    expect(r.filas).toHaveLength(1)
    expect(r.filas[0].total).toBe(121)
  })

  it('deduce la convención numérica del fichero, no la supone', () => {
    // Anglosajón: 1,210.00 son mil doscientos diez, no uno con veintiuno.
    const r = leerVentasCsv(['Fecha,Total,Efectivo', '08/01/2026,"1,210.00","1,210.00"'].join('\n'))
    expect(r.filas[0].total).toBe(1210)
  })

  it('descarta con motivo lo que no se puede leer, no lo inventa', () => {
    const r = leerVentasCsv(
      ['Fecha;Total', 'sin fecha;100,00', '03/08/2026;', '04/08/2026;250,00'].join('\n'),
    )
    expect(r.filas).toHaveLength(1)
    expect(r.descartadas.map((d) => d.motivo)).toEqual(['Sin fecha válida', 'Sin importe legible'])
  })

  it('avisa si el fichero no trae el desglose de cobros', () => {
    const r = leerVentasCsv(['Fecha;Total', '01/08/2026;100,00'].join('\n'))
    expect(r.avisos.some((a) => /desglose de cobros/.test(a))).toBe(true)
    expect(r.filas[0].cobros).toEqual([])
  })

  it('si no hay cabecera reconocible lo dice, no adivina columnas', () => {
    const r = leerVentasCsv(['a;b;c', '1;2;3'].join('\n'))
    expect(r.filas).toEqual([])
    expect(r.avisos[0]).toMatch(/cabecera/)
  })

  it('«Total» no se lleva por delante a «Total tarjeta»', () => {
    const r = leerVentasCsv(['Fecha;Total tarjeta;Total', '01/08/2026;80,00;100,00'].join('\n'))
    expect(r.filas[0].total).toBe(100)
    expect(r.filas[0].cobros).toEqual([{ forma: 'TARJETA', importe: 80 }])
  })
})

describe('base y cuota', () => {
  it('con base y cuota leídas, no calcula nada', () => {
    expect(baseYCuota({ fecha: '2026-08-01', base: 1000, cuota: 210, cobros: [] }, 21)).toEqual({ base: 1000, cuota: 210, desglosado: false })
  })

  it('con base y sin cuota, la calcula al tipo que toque', () => {
    expect(baseYCuota({ fecha: '2026-08-01', base: 1000, cobros: [] }, 21)).toEqual({ base: 1000, cuota: 210, desglosado: true })
  })

  it('solo con el total, desglosa hacia atrás y lo marca', () => {
    const r = baseYCuota({ fecha: '2026-08-01', total: 121, cobros: [] }, 21)
    expect(r).toEqual({ base: 100, cuota: 21, desglosado: true })
  })

  it('respeta el tipo de IVA del propio fichero', () => {
    expect(baseYCuota({ fecha: '2026-08-01', total: 110, tipoIva: 10, cobros: [] }, 21).base).toBe(100)
  })
})

describe('emparejar el punto de venta', () => {
  it('por código y por nombre exacto', () => {
    expect(emparejarPunto('GVA', CENTROS)).toBe('cc-gv-alicante')
    expect(emparejarPunto('vapespace san juan', CENTROS)).toBe('cc-san-juan')
  })

  it('admite que uno contenga al otro', () => {
    expect(emparejarPunto('GV ALICANTE', CENTROS)).toBe('cc-gv-alicante')
  })

  it('si es ambiguo o no aparece, NO adivina', () => {
    expect(emparejarPunto('VAPESSENCE', CENTROS)).toBeUndefined() // casa con dos
    expect(emparejarPunto('MURCIA', CENTROS)).toBeUndefined()
    expect(emparejarPunto(undefined, CENTROS)).toBeUndefined()
  })
})
