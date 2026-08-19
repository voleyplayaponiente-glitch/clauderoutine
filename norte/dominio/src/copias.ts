import type { FechaISO } from './fechas.js'

/**
 * El estado de las copias de seguridad.
 *
 * Una copia que falla en silencio es peor que no tener copias: da la
 * tranquilidad sin dar el respaldo. Por eso el juicio sobre si las copias van
 * bien vive aquí, con sus pruebas, y la app lo enseña en la pantalla de inicio
 * en vez de dejarlo en un registro que nadie mira.
 */

/**
 * El disco externo, tal como lo ve el servicio de copias.
 *
 * `vistoAlgunaVez` es la pieza que hace útil todo esto: sin ella no se puede
 * distinguir «aquí nunca ha habido disco externo» de «el disco estaba y alguien
 * lo desenchufó hace tres semanas», y son dos situaciones muy distintas.
 */
export interface EstadoExterno {
  conectado: boolean
  ruta: string | null
  copias: number
  /** ISO en UTC de la última vez que se copió algo al disco. */
  ultima: string | null
  libresMb: number | null
  mensaje: string | null
  vistoAlgunaVez: boolean
}

/** Lo que el servicio de copias escribe en `estado.json` tras cada intento. */
export interface EstadoCopias {
  /** ISO en UTC del último volcado correcto. */
  ultima: string | null
  fichero: string | null
  bytes: number
  copias: number
  ok: boolean
  mensaje: string | null
  externo: EstadoExterno | null
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

export type SaludExterno = 'al_dia' | 'desconectado' | 'con_problema' | 'sin_configurar'

export interface JuicioExterno {
  salud: SaludExterno
  titulo: string
  detalle: string
}

/** A partir de aquí, un disco que estaba y ya no está deja de ser un despiste y
 *  empieza a ser un aviso: las copias vuelven a estar todas en la misma
 *  máquina. */
const DIAS_TOLERADOS_FUERA = 3

export function juzgarExterno(externo: EstadoExterno | null, ahora: Date): JuicioExterno {
  if (!externo || (!externo.conectado && !externo.vistoAlgunaVez)) {
    return {
      salud: 'sin_configurar',
      titulo: 'Sin copia fuera del servidor',
      detalle:
        'Las copias están solo en este Umbrel: protegen de un borrado o de una actualización ' +
        'que salga mal, no de que se estropee el disco. Conecta un disco y crea en él una ' +
        'carpeta llamada «norte-copias» para que Norte empiece a llevárselas.',
    }
  }

  if (externo.conectado && externo.mensaje) {
    return { salud: 'con_problema', titulo: 'Problema con el disco externo', detalle: externo.mensaje }
  }

  if (externo.conectado) {
    const sitio =
      externo.libresMb !== null ? ` Quedan ${Math.round(externo.libresMb / 1024)} GB libres.` : ''
    return {
      salud: 'al_dia',
      titulo: 'Copia en el disco externo',
      detalle: `${externo.copias} copia${externo.copias === 1 ? '' : 's'} en el disco.${sitio}`,
    }
  }

  const dias =
    externo.ultima === null
      ? null
      : Math.floor((ahora.getTime() - new Date(externo.ultima).getTime()) / 86_400_000)

  if (dias !== null && dias <= DIAS_TOLERADOS_FUERA) {
    return {
      salud: 'desconectado',
      titulo: 'El disco externo no está conectado',
      detalle:
        'Nada grave todavía: la última copia salió hace ' +
        `${dias === 0 ? 'menos de un día' : `${dias} día${dias === 1 ? '' : 's'}`}. ` +
        'Vuelve a conectarlo cuando puedas.',
    }
  }

  return {
    salud: 'desconectado',
    titulo: 'El disco externo lleva días sin aparecer',
    detalle:
      dias === null
        ? 'No hay constancia de que se haya copiado nada a él. Conéctalo y reinicia Norte.'
        : `La última copia que salió del Umbrel es de hace ${dias} días. Si acabas de conectarlo, ` +
          'reinicia Norte desde el Umbrel para que lo vea.',
  }
}
