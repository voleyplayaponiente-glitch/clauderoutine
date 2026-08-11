/**
 * Almacén de copias de seguridad en el servidor (Umbrel).
 *
 * Es la respuesta a una pérdida real: los datos de la app viven en el IndexedDB
 * del navegador y, el día que el navegador limpia el sitio, **no hay de dónde
 * sacarlos**. Aquí se guardan fuera del navegador, en un disco que es tuyo.
 *
 * Cada copia es el mismo JSON que descarga «Copia manual», con su checksum, así
 * que se puede restaurar desde la app o a mano. Se guarda una por día y empresa,
 * con retención configurable.
 *
 * Sin dependencias: solo `node:fs`.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Nombre de carpeta o de fichero admitido.
 *
 * **Esto es lo que impide un salto de directorio.** El id de empresa y la fecha
 * llegan de fuera y acaban formando una ruta: sin filtrarlos, un `../..` dejaría
 * escribir en cualquier sitio del servidor. Solo letras, cifras, guion y punto,
 * y nunca dos puntos seguidos.
 */
const SEGURO = /^[A-Za-z0-9._-]{1,80}$/

export function nombreSeguro(valor) {
  const v = String(valor ?? '')
  return SEGURO.test(v) && !v.includes('..') ? v : undefined
}

/** Fecha de hoy en AAAA-MM-DD, que es como se nombra cada copia. */
function hoy() {
  return new Date().toISOString().slice(0, 10)
}

export class AlmacenCopias {
  /**
   * @param {string} raiz carpeta donde se guardan las copias (un volumen).
   * @param {number} retencion cuántas copias se conservan por empresa.
   */
  constructor(raiz, retencion = 30) {
    this.raiz = raiz
    this.retencion = Math.max(1, retencion)
  }

  carpeta(empresaId) {
    return path.join(this.raiz, 'copias', empresaId)
  }

  /** Guarda la copia del día. Si ya había una de hoy, la sustituye. */
  async guardar(empresaId, backup) {
    const id = nombreSeguro(empresaId)
    if (!id) throw new Error('Identificador de empresa no admitido')

    const dir = this.carpeta(id)
    await fs.mkdir(dir, { recursive: true })
    const fecha = String(backup?.fecha ?? '').slice(0, 10) || hoy()
    const dia = nombreSeguro(fecha)
    if (!dia) throw new Error('Fecha no admitida')

    // Se escribe en un temporal y se renombra: si se corta a medias, la copia
    // anterior sigue entera. Nunca se deja un fichero a medio escribir.
    const destino = path.join(dir, `${dia}.json`)
    const temporal = `${destino}.tmp`
    const contenido = JSON.stringify(backup)
    await fs.writeFile(temporal, contenido, 'utf8')
    await fs.rename(temporal, destino)

    await this.podar(id)
    return { fecha: dia, bytes: Buffer.byteLength(contenido) }
  }

  /** Deja solo las `retencion` copias más recientes. */
  async podar(empresaId) {
    const dir = this.carpeta(empresaId)
    const ficheros = (await fs.readdir(dir).catch(() => []))
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
    for (const viejo of ficheros.slice(this.retencion)) {
      await fs.unlink(path.join(dir, viejo)).catch(() => {})
    }
  }

  /** Copias guardadas de una empresa, de la más reciente a la más antigua. */
  async listar(empresaId) {
    const id = nombreSeguro(empresaId)
    if (!id) throw new Error('Identificador de empresa no admitido')
    const dir = this.carpeta(id)
    const ficheros = (await fs.readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json'))
    const copias = []
    for (const f of ficheros) {
      const st = await fs.stat(path.join(dir, f)).catch(() => undefined)
      if (st) copias.push({ fecha: f.replace(/\.json$/, ''), bytes: st.size })
    }
    return copias.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }

  /**
   * Empresas con copias guardadas, **con su razón social**.
   *
   * El nombre se saca de la copia más reciente y no es un adorno: si el
   * navegador se limpia, la app arranca con un id de empresa NUEVO y las copias
   * están bajo el viejo. Sin el nombre, recuperar sería elegir a ciegas entre
   * identificadores.
   */
  async empresas() {
    const dir = path.join(this.raiz, 'copias')
    const ids = await fs.readdir(dir).catch(() => [])
    const salida = []
    for (const id of ids) {
      if (!nombreSeguro(id)) continue
      const copias = await this.listar(id)
      if (copias.length === 0) continue
      const ultima = await this.leer(id).catch(() => undefined)
      salida.push({
        empresaId: id,
        copias: copias.length,
        ultima: copias[0].fecha,
        razonSocial: ultima?.config?.empresa?.razonSocial ?? '',
        cif: ultima?.config?.empresa?.cif ?? '',
      })
    }
    return salida.sort((a, b) => b.ultima.localeCompare(a.ultima))
  }

  /** Lee una copia concreta, o la más reciente si no se indica la fecha. */
  async leer(empresaId, fecha) {
    const id = nombreSeguro(empresaId)
    if (!id) throw new Error('Identificador de empresa no admitido')
    let dia = fecha ? nombreSeguro(fecha) : undefined
    if (fecha && !dia) throw new Error('Fecha no admitida')
    if (!dia) {
      const copias = await this.listar(id)
      if (copias.length === 0) return undefined
      dia = copias[0].fecha
    }
    const texto = await fs.readFile(path.join(this.carpeta(id), `${dia}.json`), 'utf8').catch(() => undefined)
    return texto === undefined ? undefined : JSON.parse(texto)
  }
}
