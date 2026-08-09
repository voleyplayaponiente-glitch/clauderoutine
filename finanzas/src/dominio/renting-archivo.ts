/**
 * Lectura de la ficha de un contrato de **renting** descargada de la banca
 * digital (probado con «Mis contratos» de CaixaBankNow).
 *
 * No es un cuadro de cuotas: es una ficha de rótulos y valores, así que se lee
 * con `leerFicha`. Lo que sale de aquí es una **propuesta**: la pantalla la
 * enseña, la persona la confirma y la corrige.
 */
import { enteroFicha, fechaFicha, importeFicha, leerFicha, porcentajeFicha, valorFicha } from './ficha-banco'
import { aplanar, ENTIDADES } from './prestamo-archivo'

export interface DatosRenting {
  numeroContrato?: string
  cuentaVinculada?: string
  arrendador?: string
  descripcion?: string
  matricula?: string
  bastidor?: string
  version?: string
  cuotaBase?: number
  /** «IVA» en la modalidad impositiva; el tipo no viene en la ficha. */
  llevaIva?: boolean
  periodicidad?: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL'
  nCuotas?: number
  cuotasFacturadas?: number
  fechaInicio?: string
  fechaFin?: string
  fianza?: number
  kmContratados?: number
  estado?: string
  /** Campos que se han podido leer de verdad (los demás quedan a mano). */
  encontrados: string[]
  avisos: string[]
}

const PERIODICIDADES: Record<string, 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL'> = {
  mensual: 'MENSUAL',
  trimestral: 'TRIMESTRAL',
  anual: 'ANUAL',
}

/**
 * ¿Estas filas son la ficha de un renting? Se pide más de una señal para no
 * confundirla con la de un préstamo o una póliza.
 */
export function esFichaRenting(filas: unknown[][]): boolean {
  const texto = aplanar(filas.map((f) => f.map((c) => String(c ?? '')).join(' ')).join(' \n '))
  const señales = ['cuotas contratadas', 'datos del vehiculo', 'matricula', 'numero de bastidor', 'km totales contratados']
  return señales.filter((s) => texto.includes(s)).length >= 2
}

/** Kilómetros contratados: «40.000» → 40000. */
function kilometros(v: string | undefined): number | undefined {
  if (!v) return undefined
  const m = /^\d{1,3}(\.\d{3})*$|^\d+$/.exec(v.trim())
  return m ? Number(v.replace(/\./g, '')) : undefined
}

export function leerRenting(filas: unknown[][]): DatosRenting {
  const ficha = leerFicha(filas)
  const datos: DatosRenting = { encontrados: [], avisos: [] }
  const marca = <K extends keyof DatosRenting>(campo: K, valor: DatosRenting[K]) => {
    if (valor === undefined || valor === '' || (typeof valor === 'number' && Number.isNaN(valor))) return
    datos[campo] = valor
    datos.encontrados.push(String(campo))
  }

  marca('numeroContrato', valorFicha(ficha, 'Número de contrato'))
  marca('cuentaVinculada', valorFicha(ficha, 'Cuenta vinculada', 'Cuenta relacionada'))
  marca('estado', valorFicha(ficha, 'Estado'))

  // La entidad se propone por el IBAN de la cuenta vinculada: el número de
  // contrato del renting no empieza por código de banco.
  const cuenta = datos.cuentaVinculada ?? ''
  const codigo = /^\s*(\d{4})\b/.exec(cuenta)
  if (codigo && ENTIDADES[codigo[1]]) marca('arrendador', ENTIDADES[codigo[1]])

  marca('fechaInicio', fechaFicha(ficha, 'Fecha de contratación', 'Fecha de constitución'))
  marca('fechaFin', fechaFicha(ficha, 'Fecha de vencimiento'))
  marca('cuotaBase', importeFicha(ficha, 'Importe de la cuota periódica', 'Importe de la cuota'))
  marca('fianza', importeFicha(ficha, 'Fianza'))
  marca('nCuotas', enteroFicha(ficha, 'Cuotas contratadas'))
  marca('cuotasFacturadas', enteroFicha(ficha, 'Cuotas facturadas'))
  marca('kmContratados', kilometros(valorFicha(ficha, 'Km totales contratados')))

  const periodo = aplanar(valorFicha(ficha, 'Periodicidad de las cuotas', 'Periodicidad') ?? '').trim()
  marca('periodicidad', PERIODICIDADES[periodo])

  const modalidad = aplanar(valorFicha(ficha, 'Modalidad impositiva') ?? '')
  if (modalidad) marca('llevaIva', modalidad.includes('iva'))

  marca('matricula', valorFicha(ficha, 'Matrícula'))
  marca('bastidor', valorFicha(ficha, 'Número de bastidor'))
  marca('version', valorFicha(ficha, 'Versión'))

  const marcaVehiculo = valorFicha(ficha, 'Marca')
  const modelo = valorFicha(ficha, 'Modelo')
  marca('descripcion', [marcaVehiculo, modelo].filter(Boolean).join(' ') || undefined)

  // Avisos: se dice lo que falta, no se rellena por nuestra cuenta.
  if (datos.cuotaBase === undefined) datos.avisos.push('No se ha leído el importe de la cuota: escríbelo a mano.')
  if (datos.nCuotas === undefined) datos.avisos.push('No se ha leído el número de cuotas contratadas.')
  if (datos.llevaIva) {
    datos.avisos.push('La ficha dice que la cuota lleva IVA, pero no el tipo: se propone el general y se puede cambiar.')
  }
  if (datos.fechaInicio && datos.fechaFin && datos.nCuotas && datos.periodicidad === 'MENSUAL') {
    const meses = mesesEntre(datos.fechaInicio, datos.fechaFin)
    if (Math.abs(meses - datos.nCuotas) > 1) {
      datos.avisos.push(
        `Entre contratación y vencimiento hay ${meses} meses y el contrato dice ${datos.nCuotas} cuotas. Revísalo antes de guardar.`,
      )
    }
  }
  // Rótulo presente pero ilegible: mejor decirlo que dejar un 0 silencioso.
  if (porcentajeFicha(ficha, 'Interés') !== undefined) {
    datos.avisos.push('La ficha trae un tipo de interés: comprueba que es un renting y no un leasing.')
  }

  return datos
}

function mesesEntre(a: string, b: string): number {
  const [aa, am] = a.split('-').map(Number)
  const [ba, bm] = b.split('-').map(Number)
  return (ba - aa) * 12 + (bm - am)
}
