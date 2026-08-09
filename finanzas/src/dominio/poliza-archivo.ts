/**
 * Lectura de la ficha de una **póliza de crédito** («Cta.créd. bonif. - Datos
 * generales» de CaixaBankNow). Misma mecánica que el renting: rótulos y
 * valores, no un cuadro de cuotas.
 *
 * OJO: la ficha de la póliza imprime rótulo y valor **en la misma fila**
 * (`Capital límite actual: 28.000,00  Saldo disponible: 11.216,86`), mientras
 * que la del renting pone una fila de rótulos y otra de valores. `leerFicha`
 * distingue las dos formas.
 */
import { enteroFicha, fechaFicha, importeFicha, leerFicha, porcentajeFicha, valorFicha } from './ficha-banco'
import { aplanar, ENTIDADES } from './prestamo-archivo'

export interface DatosPoliza {
  numeroContrato?: string
  cuentaRelacionada?: string
  entidad?: string
  limiteConcedido?: number
  limiteActual?: number
  dispuesto?: number
  saldoContable?: number
  saldoDisponible?: number
  importeExcedido?: number
  tipoInteresDispuesto?: number
  comisionDisponibilidad?: number
  comisionExcedido?: number
  periodicidadLiquidacion?: 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'
  fechaConstitucion?: string
  fechaVencimiento?: string
  fechaUltimaLiquidacion?: string
  fechaProximaLiquidacion?: string
  encontrados: string[]
  avisos: string[]
}

const PERIODICIDADES: Record<string, 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'> = {
  mensual: 'MENSUAL',
  trimestral: 'TRIMESTRAL',
  semestral: 'SEMESTRAL',
  anual: 'ANUAL',
}

/** ¿Estas filas son la ficha de una póliza / cuenta de crédito? */
export function esFichaPoliza(filas: unknown[][]): boolean {
  const texto = aplanar(filas.map((f) => f.map((c) => String(c ?? '')).join(' ')).join(' \n '))
  const señales = [
    'cuenta de credito',
    'capital limite actual',
    'saldo del capital dispuesto',
    'comision de disponibilidad',
    'importe excedido',
    'cta.cred',
  ]
  return señales.filter((s) => texto.includes(s)).length >= 2
}

export function leerPoliza(filas: unknown[][]): DatosPoliza {
  const ficha = leerFicha(filas)
  const datos: DatosPoliza = { encontrados: [], avisos: [] }
  const marca = <K extends keyof DatosPoliza>(campo: K, valor: DatosPoliza[K]) => {
    if (valor === undefined || valor === '' || (typeof valor === 'number' && Number.isNaN(valor))) return
    datos[campo] = valor
    datos.encontrados.push(String(campo))
  }

  marca('numeroContrato', valorFicha(ficha, 'Número de contrato'))
  marca('cuentaRelacionada', valorFicha(ficha, 'Cuenta relacionada', 'Cuenta vinculada'))

  // La entidad se propone por el código del contrato y, si no, por la cuenta.
  const codigo = /^\s*(\d{4})\b/.exec(datos.numeroContrato ?? '') ?? /^\s*(\d{4})\b/.exec(datos.cuentaRelacionada ?? '')
  if (codigo && ENTIDADES[codigo[1]]) marca('entidad', ENTIDADES[codigo[1]])

  marca('limiteConcedido', importeFicha(ficha, 'Capital concedido'))
  marca('limiteActual', importeFicha(ficha, 'Capital límite actual'))
  marca('dispuesto', importeFicha(ficha, 'Saldo del capital dispuesto', 'Capital dispuesto'))
  marca('saldoContable', importeFicha(ficha, 'Saldo contable'))
  marca('saldoDisponible', importeFicha(ficha, 'Saldo disponible'))
  marca('importeExcedido', importeFicha(ficha, 'Importe excedido'))

  marca('tipoInteresDispuesto', porcentajeFicha(ficha, 'Interés vigente', 'Tipo de interés'))
  marca('comisionDisponibilidad', porcentajeFicha(ficha, 'Comisión de disponibilidad'))
  marca('comisionExcedido', porcentajeFicha(ficha, 'Comisión de máximo excedido'))

  marca('fechaConstitucion', fechaFicha(ficha, 'Fecha de constitución'))
  marca('fechaVencimiento', fechaFicha(ficha, 'Fecha cancelación prevista', 'Fecha de vencimiento'))
  marca('fechaUltimaLiquidacion', fechaFicha(ficha, 'Fecha última liquidación'))
  marca('fechaProximaLiquidacion', fechaFicha(ficha, 'Fecha próxima liquidación'))

  const periodo = aplanar(valorFicha(ficha, 'Periodicidad de las liquidaciones', 'Periodicidad') ?? '').trim()
  marca('periodicidadLiquidacion', PERIODICIDADES[periodo])

  // Comprobación con los propios datos del banco: el disponible que imprime
  // tiene que salir del límite menos el saldo contable. Si no cuadra, se dice;
  // no se corrige por nuestra cuenta.
  const limite = datos.limiteActual ?? datos.limiteConcedido
  if (limite !== undefined && datos.saldoContable !== undefined && datos.saldoDisponible !== undefined) {
    const calculado = Math.round((limite - datos.saldoContable) * 100) / 100
    if (Math.abs(calculado - datos.saldoDisponible) > 0.02) {
      datos.avisos.push(
        `El disponible que imprime el banco (${datos.saldoDisponible}) no cuadra con límite − saldo contable (${calculado}). Revisa los importes.`,
      )
    }
  }

  if (datos.dispuesto === undefined) datos.avisos.push('No se ha leído el capital dispuesto: escríbelo a mano.')
  if (datos.tipoInteresDispuesto === undefined) datos.avisos.push('No se ha leído el tipo de interés del dispuesto.')
  if (datos.comisionDisponibilidad === undefined) {
    datos.avisos.push('No se ha leído la comisión de disponibilidad: sin ella el coste de la póliza sale corto.')
  }
  // Un dato que aparece a veces y conviene no perder de vista.
  const plazo = enteroFicha(ficha, 'Plazo')
  if (plazo !== undefined) datos.avisos.push(`La ficha indica un plazo de ${plazo}: compruébalo con el vencimiento.`)

  return datos
}
