/**
 * ¿De qué pantalla es este documento?
 *
 * Nace de un tropiezo real del usuario: intentó subir el **acuerdo de
 * aplazamiento de Hacienda** por la importación de extractos de Bancos, que no
 * lo reconoce, y lo único que obtuvo fue un «no se pudo leer el fichero». El
 * lector funcionaba perfectamente —lo hacía la pantalla de Deudas—, pero nadie
 * se lo dijo.
 *
 * Es el mismo error que ya se cometió con la póliza de crédito: cuando un
 * documento cae en el sitio equivocado, **la app tiene que decir a dónde va**,
 * no limitarse a fallar. Un «no se pudo leer» ante un fichero perfectamente
 * legible es una mentira por omisión.
 */
import { esAplazamiento } from './aplazamiento-aeat'
import { esFichaRenting } from './renting-archivo'
import { esFichaPoliza } from './poliza-archivo'
import { esModelo200 } from './modelo200'
import { aplanar } from './prestamo-archivo'

export type TipoDocumento = 'APLAZAMIENTO' | 'RENTING' | 'POLIZA' | 'PRESTAMO' | 'MODELO_200' | 'DESCONOCIDO'

export interface DocumentoReconocido {
  tipo: TipoDocumento
  /** Ruta de la pantalla que sí sabe leerlo. */
  ruta?: string
  /** Explicación para la persona, no para el registro de errores. */
  mensaje?: string
}

/** Señales de un cuadro de amortización, para no confundirlo con un extracto. */
function pareceCuadroPrestamo(filas: unknown[][]): boolean {
  const texto = aplanar(filas.map((f) => f.map((c) => String(c ?? '')).join(' ')).join(' \n '))
  const señales = [
    'cuadro de amortizacion',
    'capital pendiente',
    'capital amortizado',
    'proximas cuotas',
    'amortizaciones y movimientos',
    'importe pendiente de amortizacion',
    'tipo de interes nominal',
  ]
  return señales.filter((s) => texto.includes(s)).length >= 2
}

/**
 * Reconoce documentos que pertenecen a OTRA pantalla. Devuelve `DESCONOCIDO`
 * cuando no hay señales suficientes: **no se adivina**, porque mandar a alguien
 * a la pantalla equivocada es peor que no decir nada.
 */
export function reconocerDocumento(filas: unknown[][]): DocumentoReconocido {
  if (esAplazamiento(filas).es) {
    const { organismo } = esAplazamiento(filas)
    const quien = organismo === 'SEGURIDAD_SOCIAL' ? 'la Seguridad Social' : 'Hacienda'
    return {
      tipo: 'APLAZAMIENTO',
      ruta: '/deudas',
      mensaje:
        `Esto es un acuerdo de aplazamiento de ${quien}, y sí se puede leer: va en **Deudas**, con el botón ` +
        '«Subir fichero del banco o de Hacienda». Allí se registran los plazos tal y como vienen en el acuerdo.',
    }
  }
  if (esFichaRenting(filas)) {
    return {
      tipo: 'RENTING',
      ruta: '/deudas',
      mensaje: 'Esto es un contrato de renting: va en **Deudas**, con el botón «Subir fichero del banco o de Hacienda».',
    }
  }
  if (esFichaPoliza(filas)) {
    return {
      tipo: 'POLIZA',
      ruta: '/deudas',
      mensaje: 'Esto es la ficha de una póliza de crédito: va en **Deudas**, con el botón «Subir fichero del banco o de Hacienda».',
    }
  }
  if (esModelo200(filas)) {
    return {
      tipo: 'MODELO_200',
      ruta: '/configuracion',
      mensaje:
        'Esto es el Modelo 200 (Impuesto sobre Sociedades): va en **Configuración → Ejercicio anterior**. ' +
        'De ahí salen el balance, la cuenta de resultados y la liquidación del año pasado.',
    }
  }
  if (pareceCuadroPrestamo(filas)) {
    return {
      tipo: 'PRESTAMO',
      ruta: '/deudas',
      mensaje: 'Esto es el cuadro de amortización de un préstamo: va en **Deudas**, con el botón «Subir fichero del banco o de Hacienda».',
    }
  }
  return { tipo: 'DESCONOCIDO' }
}
