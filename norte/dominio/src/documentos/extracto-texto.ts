import { parsearImporte, type Centimos } from '../dinero.js'
import type { FechaISO } from '../fechas.js'
import { type ApunteExtraido, type LecturaExtracto, ponerHuellas } from './apuntes.js'
import { leerFecha } from './fechas-texto.js'
import { buscarIban, enmascararSensibles } from './sensibles.js'

/**
 * Leer un extracto en PDF (ya convertido a texto) o en texto plano.
 *
 * El PDF no tiene tabla: tiene líneas. Y la línea de un movimiento largo se
 * parte en dos, con la continuación colgando de la línea siguiente, que además
 * empieza por «Fecha valor: …». Este es el extracto real que lo enseñó:
 *
 *     17/08/2026 Bizum De Marta Ruiz Concepto Cena Del Sábado En 35,00 EUR 25.074,47 EUR
 *     Fecha valor: 17/08/2026 El Puerto
 *
 * (El ejemplo está calcado de un extracto real, con los nombres cambiados.)
 * El concepto de verdad es «… Cena Del Sábado En El Puerto». Un lector que
 * tratase cada línea por su cuenta guardaría el apunte con el concepto cortado
 * a media palabra, que es de esas cosas que solo se notan meses después.
 */

/** Fecha al principio, texto en medio, uno o dos importes al final. */
const LINEA_APUNTE =
  /^(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s+(.*?)\s+(-?[\d.,]+)\s*(?:EUR|€|USD|\$)?(?:\s+(-?[\d.,]+)\s*(?:EUR|€|USD|\$)?)?\s*$/

/** «Fecha valor: 17/08/2026», que es ruido delante de la continuación. */
const PREFIJO_VALOR = /^(?:fecha\s+valor|f\.?\s*valor)\s*:?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})?\s*/i

/** Pies de página y cabeceras que se repiten y no son movimientos. */
const RUIDO =
  /^(p[áa]gina\s+\d|documento\s+impreso|fecha\s+de\s+generaci[óo]n|total(es)?\b|saldo\s+(inicial|final|anterior))/i

export function leerExtractoDeTexto(texto: string): LecturaExtracto {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l !== '')

  const avisos: string[] = []
  const sinHuella: Omit<ApunteExtraido, 'huella'>[] = []
  let ultimo: { apunte: Omit<ApunteExtraido, 'huella'>; bruto: string } | null = null

  function cerrar() {
    const abierto = ultimo
    ultimo = null
    if (!abierto) return
    const { texto: concepto, tarjetas } = enmascararSensibles(abierto.bruto.replace(/\s+/g, ' ').trim())
    abierto.apunte.concepto = concepto || 'Movimiento sin concepto'
    if (tarjetas[0]) abierto.apunte.tarjeta = tarjetas[0]
    sinHuella.push(abierto.apunte)
  }

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]!
    if (RUIDO.test(linea)) {
      cerrar()
      continue
    }

    const coincide = linea.match(LINEA_APUNTE)
    const fecha = coincide ? leerFecha(coincide[1]!) : null
    const importe = coincide ? parsearImporte(coincide[3]!) : null

    if (coincide && fecha && importe !== null) {
      cerrar()
      // Con dos números al final, el primero es el importe y el segundo el
      // saldo. Con uno solo, es el importe: dar por hecho que hay saldo
      // convertiría el importe en saldo y todo saldría a cero.
      const saldo = coincide[4] ? parsearImporte(coincide[4]) : null
      ultimo = {
        bruto: coincide[2] ?? '',
        apunte: {
          fecha,
          concepto: '',
          importe,
          ...(saldo !== null ? { saldo } : {}),
          divisa: /USD|\$/.test(linea) ? 'USD' : 'EUR',
          origen: i + 1,
        },
      }
      continue
    }

    if (ultimo) {
      const abierto = ultimo
      const prefijo = linea.match(PREFIJO_VALOR)
      let continuacion = linea
      if (prefijo) {
        continuacion = linea.slice(prefijo[0].length)
        const valor = prefijo[1] ? leerFecha(prefijo[1]) : null
        if (valor && valor !== abierto.apunte.fecha) abierto.apunte.fechaValor = valor
      }
      // Una línea que no aporta nada tras quitar el «Fecha valor:» no rompe el
      // apunte: el PDF la usa para alinear columnas.
      if (continuacion.trim() !== '') abierto.bruto += ` ${continuacion.trim()}`
    }
  }
  cerrar()

  if (sinHuella.length === 0) {
    avisos.push(
      'No he reconocido ningún movimiento en el texto del PDF. Si el PDF es una foto ' +
        'escaneada, no tiene texto que leer: pide a tu banco el Excel o el fichero Norma 43.',
    )
  }

  const apuntes = ponerHuellas(sinHuella)
  const fechas = apuntes.map((a) => a.fecha).sort()

  return {
    apuntes,
    cuenta: leerCabecera(lineas),
    ...(fechas.length > 0
      ? { desde: fechas[0] as FechaISO, hasta: fechas[fechas.length - 1] as FechaISO }
      : {}),
    avisos,
  }
}

function leerCabecera(lineas: string[]): LecturaExtracto['cuenta'] {
  const cuenta: LecturaExtracto['cuenta'] = {}
  const cabecera = lineas.slice(0, 15).join('\n')

  const iban = buscarIban(cabecera)
  if (iban) cuenta.ibanUltimos4 = iban.slice(-4)

  const titular = cabecera.match(/titular(?:es)?\s*:\s*(.+)/i)
  if (titular) cuenta.titular = titular[1]!.trim()

  const saldo = cabecera.match(/saldo\s*:?\s*(-?[\d.,]+)\s*(EUR|€)/i)
  if (saldo) {
    const valor = parsearImporte(saldo[1]!)
    if (valor !== null) cuenta.saldoFinal = valor as Centimos
  }
  return cuenta
}
