import type { Centimos } from '../dinero.js'
import type { FechaISO } from '../fechas.js'
import { type ApunteExtraido, type LecturaExtracto, ponerHuellas } from './apuntes.js'
import { enmascararSensibles } from './sensibles.js'

/**
 * Cuaderno 43 de la AEB («Norma 43»), el fichero que cualquier banco español
 * entrega desde la banca electrónica con el nombre `.q43`, `.n43` o `.c43`.
 *
 * Es el formato bueno: campos de longitud fija, importes ya en céntimos y
 * signo explícito. No hay que adivinar nada, así que cuando existe es siempre
 * preferible al PDF o al Excel — y por eso la app lo dice en la pantalla de
 * subida.
 *
 * Registros que se leen:
 *   11  cabecera de cuenta (entidad, oficina, cuenta, fechas, saldo inicial)
 *   22  movimiento
 *   23  concepto complementario del movimiento anterior (hasta cinco)
 *   33  fin de cuenta
 *   88  fin de fichero
 *
 * Las posiciones van en base 1, como el propio cuaderno, y se restan aquí para
 * que se puedan comparar con la especificación sin traducir mentalmente.
 */

function campo(linea: string, desde: number, hasta: number): string {
  return linea.slice(desde - 1, hasta).trim()
}

/** `aammdd` → fecha. El cuaderno solo da dos cifras de año. */
function fechaN43(crudo: string): FechaISO | null {
  if (!/^\d{6}$/.test(crudo)) return null
  const anio = Number(crudo.slice(0, 2))
  const mes = Number(crudo.slice(2, 4))
  const dia = Number(crudo.slice(4, 6))
  const completo = anio < 70 ? 2000 + anio : 1900 + anio
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const fecha = new Date(completo, mes - 1, dia)
  if (fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null
  return `${completo}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Importe de 14 dígitos con los dos últimos como decimales, y el signo en el
 *  campo de al lado: 1 = debe (sale), 2 = haber (entra). */
function importeN43(signo: string, digitos: string): Centimos | null {
  if (!/^\d{1,14}$/.test(digitos)) return null
  const centimos = Number(digitos)
  if (!Number.isSafeInteger(centimos)) return null
  return signo === '1' ? -centimos : centimos
}

/** ¿Esto huele a Cuaderno 43? Se mira sin llegar a leerlo entero. */
export function pareceNorma43(texto: string): boolean {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lineas.length < 2) return false
  const cabecera = lineas.find((l) => l.startsWith('11'))
  const movimiento = lineas.find((l) => l.startsWith('22'))
  return Boolean(cabecera && movimiento && cabecera.length >= 70)
}

export function leerNorma43(texto: string): LecturaExtracto {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
  const avisos: string[] = []
  const sinHuella: Omit<ApunteExtraido, 'huella'>[] = []
  const cuenta: LecturaExtracto['cuenta'] = {}
  let desde: FechaISO | undefined
  let hasta: FechaISO | undefined
  let divisaCuenta = 'EUR'
  let abierto: { indice: number; conceptos: string[] } | null = null
  let desconocidos = 0

  function cerrar() {
    const actual = abierto
    abierto = null
    if (!actual) return
    const apunte = sinHuella[actual.indice]!
    const bruto = [apunte.concepto, ...actual.conceptos]
      .map((t) => t.trim())
      .filter((t) => t !== '')
      .join(' · ')
    const { texto: concepto, tarjetas } = enmascararSensibles(bruto)
    apunte.concepto = concepto || 'Movimiento sin concepto'
    if (tarjetas[0]) apunte.tarjeta = tarjetas[0]
  }

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]!
    const tipo = linea.slice(0, 2)

    if (tipo === '11') {
      cerrar()
      // El IBAN no viene montado: el fichero da entidad, oficina y número de
      // cuenta por separado. De todo eso solo se guardan los cuatro últimos.
      const numero = campo(linea, 11, 20)
      if (/^\d{10}$/.test(numero)) cuenta.ibanUltimos4 = numero.slice(-4)
      const inicio = fechaN43(campo(linea, 21, 26))
      const fin = fechaN43(campo(linea, 27, 32))
      if (inicio) desde = inicio
      if (fin) hasta = fin
      const divisa = campo(linea, 48, 50)
      // 978 es el euro en la ISO 4217 numérica, que es lo que usa el cuaderno.
      if (divisa === '978') divisaCuenta = 'EUR'
      else if (divisa === '840') divisaCuenta = 'USD'
      const titular = campo(linea, 52, 77)
      if (titular) cuenta.titular = titular
      continue
    }

    if (tipo === '22') {
      cerrar()
      // Posiciones del registro 22 según el cuaderno: 3-6 libre, 7-10 oficina
      // de origen, 11-16 fecha de operación, 17-22 fecha valor, 23-24 concepto
      // común, 25-27 concepto propio, 28 debe/haber, 29-42 importe.
      const fecha = fechaN43(campo(linea, 11, 16))
      const fechaValor = fechaN43(campo(linea, 17, 22))
      const importe = importeN43(campo(linea, 28, 28), campo(linea, 29, 42))
      if (!fecha || importe === null) {
        desconocidos++
        continue
      }
      const referencia = [campo(linea, 53, 64), campo(linea, 65, 80)].filter((r) => r !== '').join(' ')
      sinHuella.push({
        fecha,
        ...(fechaValor && fechaValor !== fecha ? { fechaValor } : {}),
        concepto: referencia,
        importe,
        divisa: divisaCuenta,
        origen: i + 1,
      })
      abierto = { indice: sinHuella.length - 1, conceptos: [] }
      continue
    }

    if (tipo === '23') {
      if (!abierto) {
        desconocidos++
        continue
      }
      abierto.conceptos.push(campo(linea, 5, 42), campo(linea, 43, 80))
      continue
    }

    if (tipo === '33') {
      cerrar()
      // Fin de cuenta: trae el saldo final, que sirve para cuadrar lo importado
      // contra lo que dice el banco.
      const saldo = importeN43(campo(linea, 59, 59), campo(linea, 60, 73))
      if (saldo !== null) cuenta.saldoFinal = saldo
      continue
    }

    if (tipo === '88') {
      cerrar()
      continue
    }

    desconocidos++
  }
  cerrar()

  if (desconocidos > 0) {
    avisos.push(`He ignorado ${desconocidos} línea${desconocidos === 1 ? '' : 's'} que no eran movimientos.`)
  }
  if (sinHuella.length === 0) {
    avisos.push('El fichero tiene forma de Norma 43 pero no trae ningún registro de movimiento (tipo 22).')
  }

  return {
    apuntes: ponerHuellas(sinHuella),
    cuenta: { ...cuenta, divisa: divisaCuenta },
    ...(desde ? { desde } : {}),
    ...(hasta ? { hasta } : {}),
    avisos,
  }
}
