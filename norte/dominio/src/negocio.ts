import { comprobarCentimos, repartir, type Centimos } from './dinero.js'

/**
 * El modo negocio: la cuenta corriente de cada socio.
 *
 * En una sociedad pequeña —dos o tres socios, que es lo que esta aplicación
 * atiende— la pregunta que se hace todo el mundo al cerrar el año es «¿cuánto
 * he metido, cuánto he sacado y cuánto me toca?». No es contabilidad oficial:
 * es el saldo con la sociedad, que es lo que evita discusiones.
 *
 *   saldo = aportado − retirado + beneficio asignado − beneficio ya cobrado
 *
 * Un saldo positivo significa que la sociedad le debe a ese socio; negativo,
 * que el socio le debe a la sociedad. **No se compensa solo**: se enseña, y
 * quien decida qué hacer con él es una persona.
 */

export type TipoMovimientoCapital = 'aportacion' | 'retirada' | 'reparto_beneficios'

export class ErrorNegocio extends Error {}

export interface Socio {
  usuarioId: string
  /** De 0 a 100. Entre todos tienen que sumar 100. */
  participacion: number
}

export interface MovimientoDeCapital {
  usuarioId: string
  tipo: TipoMovimientoCapital
  importe: Centimos
}

export interface CuentaDeSocio {
  usuarioId: string
  participacion: number
  aportado: Centimos
  retirado: Centimos
  /** Lo que le corresponde del resultado del periodo, por su participación. */
  beneficioAsignado: Centimos
  /** Lo que ya se le ha repartido en metálico. */
  beneficioCobrado: Centimos
  saldo: Centimos
}

const MARGEN_PARTICIPACION = 0.01

/**
 * Comprueba que las participaciones suman 100. Se hace aparte de calcular
 * porque la interfaz necesita avisar mientras se edita, antes de que haya
 * ningún número que enseñar.
 */
export function comprobarParticipaciones(socios: Socio[]): void {
  if (socios.length === 0) throw new ErrorNegocio('Un negocio necesita al menos un socio')
  if (socios.some((s) => !Number.isFinite(s.participacion) || s.participacion < 0)) {
    throw new ErrorNegocio('Una participación no puede ser negativa')
  }
  const suma = socios.reduce((total, s) => total + s.participacion, 0)
  if (Math.abs(suma - 100) > MARGEN_PARTICIPACION) {
    throw new ErrorNegocio(
      `Las participaciones suman ${suma.toLocaleString('es-ES')} %, y tienen que sumar 100 %`,
    )
  }
}

/**
 * `resultado` es el beneficio (o la pérdida, en negativo) del periodo. Una
 * pérdida se reparte igual que un beneficio: el socio que no quiere verla en su
 * saldo es justo el que más necesita verla.
 */
export function cuentasDeSocios(
  socios: Socio[],
  movimientos: MovimientoDeCapital[],
  resultado: Centimos,
): CuentaDeSocio[] {
  comprobarParticipaciones(socios)
  comprobarCentimos(resultado)

  const asignado = repartir(
    resultado,
    socios.map((s) => s.participacion),
  )

  return socios.map((socio, i) => {
    const suyos = movimientos.filter((m) => m.usuarioId === socio.usuarioId)
    const sumar = (tipo: TipoMovimientoCapital) =>
      suyos.filter((m) => m.tipo === tipo).reduce((total, m) => total + m.importe, 0)

    const aportado = sumar('aportacion')
    const retirado = sumar('retirada')
    const beneficioCobrado = sumar('reparto_beneficios')
    const beneficioAsignado = asignado[i]!

    return {
      usuarioId: socio.usuarioId,
      participacion: socio.participacion,
      aportado,
      retirado,
      beneficioAsignado,
      beneficioCobrado,
      saldo: aportado - retirado + beneficioAsignado - beneficioCobrado,
    }
  })
}
