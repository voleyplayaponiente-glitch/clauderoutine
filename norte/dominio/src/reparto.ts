import { comprobarCentimos, repartir, type Centimos } from './dinero.js'

/**
 * Cómo se parte un gasto compartido entre los miembros de un espacio.
 *
 * El reparto es una **regla**, no un cálculo hecho: se guarda una vez y se
 * aplica a muchos gastos de importes distintos. Por eso cada tipo tiene que
 * saber responder a «¿y si el gasto es de 12,35 €?» sin dejar céntimos por el
 * camino ni inventarse un participante.
 *
 * Los cuatro tipos, y qué significa cada uno exactamente:
 *
 *  · `mitades` — a partes iguales entre todos. Con tres personas y 10 €, uno
 *    paga 3,34 € y los otros 3,33 €: el céntimo suelto se le da a alguien, no
 *    se pierde ni se duplica.
 *  · `proporcional_ingresos` — cada uno pone en proporción a lo que ingresa.
 *    Es el reparto que la gente quiere de verdad cuando los sueldos son muy
 *    distintos, y el que ninguna app de dividir cuentas hace bien.
 *  · `porcentaje_manual` — los porcentajes los pone el usuario y **tienen que
 *    sumar 100**.
 *  · `importe_fijo` — quien tenga importe fijo pone eso, y **el resto se parte
 *    a partes iguales entre los demás**. Sirve para «yo pongo 400 € al mes de
 *    la casa y lo que pase de ahí lo pones tú», que es un acuerdo real y muy
 *    común. Si nadie queda para el resto, o si los fijos ya se pasan del
 *    importe, la regla no vale para ese gasto y se dice, no se estira.
 */

export type TipoReparto = 'mitades' | 'proporcional_ingresos' | 'porcentaje_manual' | 'importe_fijo'

export const TIPOS_REPARTO: readonly TipoReparto[] = [
  'mitades',
  'proporcional_ingresos',
  'porcentaje_manual',
  'importe_fijo',
] as const

export class ErrorReparto extends Error {}

export interface ParteDeReparto {
  usuarioId: string
  /** Solo en `porcentaje_manual`. De 0 a 100. */
  porcentaje?: number
  /** Solo en `importe_fijo`, en céntimos. `null`/ausente = «este no tiene fijo». */
  importeFijo?: number | null
  /**
   * Solo en `proporcional_ingresos`, en céntimos del periodo. No se guarda en
   * la regla: lo calcula quien la aplica, con los ingresos reales del periodo.
   */
  ingreso?: number
}

export interface Reparto {
  tipo: TipoReparto
  partes: ParteDeReparto[]
}

/**
 * Lo que le toca poner a una persona. Se llama así, y no `Cuota` a secas,
 * porque `Cuota` ya es la mensualidad de un préstamo en `amortizacion.ts`.
 */
export interface CuotaDeReparto {
  usuarioId: string
  importe: Centimos
}

/** Margen al comprobar que los porcentajes suman 100: son decimales. */
const MARGEN_PORCENTAJE = 0.01

export function nombreDeTipoReparto(tipo: TipoReparto): string {
  return {
    mitades: 'a partes iguales',
    proporcional_ingresos: 'en proporción a los ingresos',
    porcentaje_manual: 'por porcentajes',
    importe_fijo: 'con un importe fijo',
  }[tipo]
}

/**
 * Parte `importe` según la regla. Devuelve una cuota por participante, en el
 * mismo orden que las partes, y **la suma de las cuotas es exactamente
 * `importe`** en todos los casos.
 */
export function calcularReparto(importe: Centimos, reparto: Reparto): CuotaDeReparto[] {
  comprobarCentimos(importe)
  const partes = reparto.partes
  if (partes.length === 0) throw new ErrorReparto('Un reparto necesita al menos un participante')

  const ids = new Set(partes.map((parte) => parte.usuarioId))
  if (ids.size !== partes.length) {
    throw new ErrorReparto('Hay un participante repetido en el reparto')
  }

  switch (reparto.tipo) {
    case 'mitades':
      return conPesos(importe, partes, partes.map(() => 1))

    case 'porcentaje_manual': {
      const porcentajes = partes.map((parte) => parte.porcentaje ?? 0)
      if (porcentajes.some((p) => !Number.isFinite(p) || p < 0)) {
        throw new ErrorReparto('Un porcentaje no puede ser negativo')
      }
      const suma = porcentajes.reduce((a, b) => a + b, 0)
      if (Math.abs(suma - 100) > MARGEN_PORCENTAJE) {
        throw new ErrorReparto(
          `Los porcentajes suman ${suma.toLocaleString('es-ES')} %, y tienen que sumar 100 %`,
        )
      }
      return conPesos(importe, partes, porcentajes)
    }

    case 'proporcional_ingresos': {
      const ingresos = partes.map((parte) => parte.ingreso ?? 0)
      if (ingresos.some((i) => !Number.isFinite(i) || i < 0)) {
        throw new ErrorReparto('Un ingreso no puede ser negativo')
      }
      if (ingresos.reduce((a, b) => a + b, 0) <= 0) {
        // Repartir «en proporción a los ingresos» sin ingresos anotados daría
        // una división por cero. Callarlo y partir a medias sería cambiarle el
        // acuerdo a alguien sin avisarle.
        throw new ErrorReparto(
          'No hay ingresos anotados en el periodo, así que no se puede repartir en proporción a ellos. ' +
            'Anota los ingresos o usa otro tipo de reparto.',
        )
      }
      return conPesos(importe, partes, ingresos)
    }

    case 'importe_fijo': {
      const fijos = partes.map((parte) => parte.importeFijo ?? null)
      for (const fijo of fijos) if (fijo !== null) comprobarCentimos(fijo)

      const conFijo = fijos.reduce<number>((suma, fijo) => suma + (fijo ?? 0), 0)
      const sinFijo = partes.filter((_, i) => fijos[i] === null)

      if (sinFijo.length === 0) {
        if (conFijo !== importe) {
          throw new ErrorReparto(
            'Todos los participantes tienen importe fijo y no cuadran con el gasto. ' +
              'Deja a alguien sin importe fijo para que asuma la diferencia.',
          )
        }
        return partes.map((parte, i) => ({ usuarioId: parte.usuarioId, importe: fijos[i]! }))
      }

      // El signo importa: en un gasto (positivo) los fijos no pueden pasarse
      // del total, porque entonces el resto tendría que *cobrar*.
      const resto = importe - conFijo
      if (importe >= 0 ? resto < 0 : resto > 0) {
        throw new ErrorReparto(
          'Los importes fijos ya se pasan del gasto. Esta regla no vale para este importe.',
        )
      }

      const trozos = repartir(resto, sinFijo.map(() => 1))
      let siguiente = 0
      return partes.map((parte, i) => ({
        usuarioId: parte.usuarioId,
        importe: fijos[i] !== null ? fijos[i]! : trozos[siguiente++]!,
      }))
    }
  }
}

function conPesos(importe: Centimos, partes: ParteDeReparto[], pesos: number[]): CuotaDeReparto[] {
  const trozos = repartir(importe, pesos)
  return partes.map((parte, i) => ({ usuarioId: parte.usuarioId, importe: trozos[i]! }))
}
