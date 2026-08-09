import { describe, it, expect } from 'vitest'
import { esFichaRenting, leerRenting } from './renting-archivo'
import { leerFicha, valorFicha } from './ficha-banco'

/**
 * Texto REAL del PDF «RENTING - CaixaBank | banca digital CaixaBankNow» que
 * subió el usuario, tal y como lo entrega `filasDePrestamo` (líneas del PDF
 * partidas por dos o más espacios). No se retoca: si el lector cambia, tiene
 * que seguir leyendo esto.
 */
const PDF_RENTING = [
  '9/8/26, 18:07  CaixaBank | banca digital CaixaBankNow',
  '  Volver',
  'Fecha impresión:  09/08/2026',
  'Mis contratos',
  'RENAULT Clio / 2023 / 5P / b',
  'Número de contrato:  Cuenta vinculada:',
  '6800.71.0338566-83  2100 3985 02 0036574859',
  'Moneda:  Estado:',
  'EURO  Vigente',
  'Datos generales del contrato  ',
  'Fecha de contratación:  Fecha de vencimiento:  Modalidad impositiva:',
  '26/11/2025  25/11/2029  IVA',
  'Fianza:  Periodicidad de las cuotas:  Importe de la cuota',
  'periódica:',
  '0,00 €  MENSUAL',
  '319,00 €',
  'Cuotas contratadas:  Cuotas facturadas:',
  'Fecha de la última cuota:',
  '48  10',
  '01/08/2026',
  'Fecha de la próxima cuota:',
  '01/08/2026',
  'Datos del vehículo  ',
  'Modelo:  Marca:  Matrícula:',
  'Clio / 2023 / 5P / b  RENAULT  7803NHK',
  'Número de bastidor:  Versión:',
  'VF1RJA00675694666  Evolution dCi 100 (7',
  'Servicios contratados  ',
  'https://loc3.caixabank.es/GPeticiones;WebLogicSession=YY7nQBd…1/2',
  '9/8/26, 18:07  CaixaBank | banca digital CaixaBankNow',
  'Km totales contratados:  Cargo por km adicional  Neumáticos que se pueden',
  'superior a:  cambiar en toda la duración',
  '40.000',
  'del contrato:',
  '40.000 hasta 0 km : 0,06643',
  'Abono por km no recorrido:  €  Ilimitados',
  '48.000 hasta 40.000 km :',
  '0,02879 €',
  'Vehículo de sustitución y',
  'días:',
  'NO',
  'https://loc3.caixabank.es/GPeticiones;WebLogicSession=YY7nQBd…2/2',
]

const filas = () => PDF_RENTING.map((l) => l.split(/\s{2,}/).map((c) => c.trim()))

describe('ficha del banco: rótulos y valores en columnas', () => {
  it('empareja cada rótulo con su valor aunque estén en filas distintas', () => {
    const ficha = leerFicha(filas())
    expect(valorFicha(ficha, 'Número de contrato')).toBe('6800.71.0338566-83')
    expect(valorFicha(ficha, 'Cuenta vinculada')).toBe('2100 3985 02 0036574859')
    expect(valorFicha(ficha, 'Estado')).toBe('Vigente')
  })

  it('recompone un rótulo partido en dos líneas por el ancho de la columna', () => {
    // «Importe de la cuota» + «periódica:» son la misma etiqueta, y su valor
    // (319,00 €) llega una fila después que los de sus compañeros.
    const ficha = leerFicha(filas())
    expect(valorFicha(ficha, 'Importe de la cuota periódica')).toBe('319,00 €')
    expect(valorFicha(ficha, 'Fianza')).toBe('0,00 €')
    expect(valorFicha(ficha, 'Periodicidad de las cuotas')).toBe('MENSUAL')
  })

  it('no confunde un valor numérico con la continuación de un rótulo', () => {
    // «Fecha impresión: 09/08/2026» va en la misma fila: el valor empieza por
    // cifra, la continuación de un rótulo empieza por letra.
    const ficha = leerFicha(filas())
    expect(valorFicha(ficha, 'Fecha impresión')).toBe('09/08/2026')
  })

  it('descarta titulares de sección y pies de página', () => {
    const ficha = leerFicha(filas())
    for (const [, v] of ficha) expect(v).not.toContain('Datos generales del contrato')
  })
})

describe('lectura del contrato de renting de CaixaBank', () => {
  it('reconoce que la ficha es de un renting', () => {
    expect(esFichaRenting(filas())).toBe(true)
    expect(esFichaRenting([['Fecha de vencimiento', 'Amortización', 'Intereses']])).toBe(false)
  })

  it('lee los datos del contrato real', () => {
    const d = leerRenting(filas())
    expect(d.numeroContrato).toBe('6800.71.0338566-83')
    expect(d.cuentaVinculada).toBe('2100 3985 02 0036574859')
    expect(d.arrendador).toBe('CaixaBank') // por el 2100 de la cuenta vinculada
    expect(d.fechaInicio).toBe('2025-11-26')
    expect(d.fechaFin).toBe('2029-11-25')
    expect(d.cuotaBase).toBe(319)
    expect(d.nCuotas).toBe(48)
    expect(d.cuotasFacturadas).toBe(10)
    expect(d.periodicidad).toBe('MENSUAL')
    expect(d.fianza).toBe(0)
    expect(d.llevaIva).toBe(true)
  })

  it('lee el vehículo y el kilometraje', () => {
    const d = leerRenting(filas())
    expect(d.descripcion).toBe('RENAULT Clio / 2023 / 5P / b')
    expect(d.matricula).toBe('7803NHK')
    expect(d.bastidor).toBe('VF1RJA00675694666')
    // El rótulo del kilometraje viene partido entre dos columnas de la página 2.
    expect(d.kmContratados).toBe(40000)
  })

  it('avisa de que el tipo de IVA no viene en la ficha', () => {
    const d = leerRenting(filas())
    expect(d.avisos.some((a) => a.includes('IVA'))).toBe(true)
  })

  it('no inventa nada si la ficha no trae los datos', () => {
    const d = leerRenting([['Mis contratos'], ['Otra cosa']])
    expect(d.cuotaBase).toBeUndefined()
    expect(d.nCuotas).toBeUndefined()
    expect(d.avisos.length).toBeGreaterThan(0)
  })
})
