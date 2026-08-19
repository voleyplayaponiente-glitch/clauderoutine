import type { FechaISO } from './fechas.js'

/**
 * El estado de las copias de seguridad.
 *
 * Una copia que falla en silencio es peor que no tener copias: da la
 * tranquilidad sin dar el respaldo. Por eso el juicio sobre si las copias van
 * bien vive aquí, con sus pruebas, y la app lo enseña en la pantalla de inicio
 * en vez de dejarlo en un registro que nadie mira.
 */

/** Lo que el servicio de copias escribe en `estado.json` tras cada intento. */
export interface EstadoCopias {
  /** ISO en UTC del último volcado correcto. */
  ultima: string | null
  fichero: string | null
  bytes: number
  copias: number
  ok: boolean
  mensaje: string | null
}

export type SaludCopias = 'al_dia' | 'atrasada' | 'fallida' | 'sin_servicio'

export interface JuicioCopias {
  salud: SaludCopias
  titulo: string
  detalle: string
}

/** Margen antes de dar una copia por atrasada. La copia es diaria; con 48 h se
 *  tolera que el Umbrel haya estado apagado una noche sin dar un susto. */
const HORAS_TOLERADAS = 48

export function juzgarCopias(
  datos: { estado: EstadoCopias | null; servicioVivo: boolean },
  ahora: Date,
): JuicioCopias {
  const { estado, servicioVivo } = datos

  if (!servicioVivo) {
    return {
      salud: 'sin_servicio',
      titulo: 'Las copias no se están haciendo',
      detalle:
        'El servicio de copias no da señales de vida. Revisa el contenedor «copias» ' +
        'en tu Umbrel: mientras esté parado, tus datos no se están respaldando.',
    }
  }

  if (!estado || estado.ultima === null) {
    return {
      salud: 'atrasada',
      titulo: 'Todavía no hay ninguna copia',
      detalle:
        'El servicio está en marcha pero aún no ha completado la primera copia. ' +
        'Si acabas de instalar Norte, dale unos minutos.',
    }
  }

  if (!estado.ok) {
    return {
      salud: 'fallida',
      titulo: 'La última copia ha fallado',
      detalle: estado.mensaje ?? 'El servicio de copias no ha dicho por qué.',
    }
  }

  const horas = (ahora.getTime() - new Date(estado.ultima).getTime()) / 3_600_000
  if (!Number.isFinite(horas)) {
    return {
      salud: 'fallida',
      titulo: 'No entiendo la fecha de la última copia',
      detalle: 'El fichero de estado del servicio de copias está corrupto.',
    }
  }
  if (horas > HORAS_TOLERADAS) {
    return {
      salud: 'atrasada',
      titulo: `La última copia es de hace ${Math.floor(horas / 24)} días`,
      detalle:
        'Debería haber una al día. Comprueba que el contenedor «copias» sigue en marcha ' +
        'y que queda sitio en el disco.',
    }
  }

  return {
    salud: 'al_dia',
    titulo: 'Copias al día',
    detalle: `${estado.copias} copia${estado.copias === 1 ? '' : 's'} guardada${
      estado.copias === 1 ? '' : 's'
    } en tu servidor.`,
  }
}

/**
 * Agrupa los ficheros de una copia. Cada copia son dos: el volcado de la base
 * de datos y, si había, un `.tar.gz` con los documentos subidos. Se enseñan
 * juntos porque para restaurar hacen falta los dos.
 */
export interface FicheroCopia {
  fichero: string
  bytes: number
}

export interface Copia {
  sello: string
  fecha: FechaISO
  bytes: number
  conDocumentos: boolean
}

const PATRON = /^norte-(\d{4}-\d{2}-\d{2})-(\d{4})(-documentos\.tar\.gz|\.dump)$/

export function agruparCopias(ficheros: FicheroCopia[]): Copia[] {
  const porSello = new Map<string, Copia>()
  for (const { fichero, bytes } of ficheros) {
    const partes = fichero.match(PATRON)
    if (!partes) continue
    const sello = `${partes[1]}-${partes[2]}`
    const copia = porSello.get(sello) ?? {
      sello,
      fecha: partes[1] as FechaISO,
      bytes: 0,
      conDocumentos: false,
    }
    copia.bytes += bytes
    if (partes[3] !== '.dump') copia.conDocumentos = true
    porSello.set(sello, copia)
  }
  return [...porSello.values()].sort((a, b) => b.sello.localeCompare(a.sello))
}
