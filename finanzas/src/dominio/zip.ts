/**
 * Escritor de ZIP mínimo, sin dependencias.
 *
 * Se usa para entregar a la gestoría, en un solo fichero, el resumen del mes
 * junto con los PDF de las facturas. Se escribe con el método **«almacenado»**
 * (sin comprimir) a propósito: un PDF ya viene comprimido, así que comprimirlo
 * otra vez no ahorra nada y obligaría a meter una librería de deflate — y la
 * app no carga código de terceros que no necesite (política de CSP).
 *
 * Formato: PKZIP clásico (APPNOTE 6.3.4), solo lo imprescindible —cabecera
 * local, directorio central y su registro final—, con los nombres en UTF-8
 * marcados con el bit 11 de banderas.
 */

export interface EntradaZip {
  /** Ruta dentro del zip. Se admiten subcarpetas con «/». */
  nombre: string
  datos: Uint8Array
}

/** Tabla de CRC-32 (polinomio 0xEDB88320), la que exige el formato. */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/**
 * Fecha y hora en el formato MS-DOS que usa el ZIP. Se pasa desde fuera para
 * que la función siga siendo pura y el resultado, reproducible.
 */
function fechaHoraDos(fecha: Date): { hora: number; dia: number } {
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2)
  const dia = ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate()
  return { hora, dia }
}

/** Nombres repetidos: se numeran, porque un zip con dos entradas iguales confunde. */
function nombresUnicos(entradas: EntradaZip[]): EntradaZip[] {
  const vistos = new Map<string, number>()
  return entradas.map((e) => {
    const n = vistos.get(e.nombre) ?? 0
    vistos.set(e.nombre, n + 1)
    if (n === 0) return e
    const punto = e.nombre.lastIndexOf('.')
    const base = punto > 0 ? e.nombre.slice(0, punto) : e.nombre
    const ext = punto > 0 ? e.nombre.slice(punto) : ''
    return { ...e, nombre: `${base} (${n + 1})${ext}` }
  })
}

/** Construye el ZIP completo en memoria. `fecha` sella todas las entradas. */
export function crearZip(entradas: EntradaZip[], fecha: Date): Uint8Array {
  const { hora, dia } = fechaHoraDos(fecha)
  const utf8 = new TextEncoder()
  const locales: Uint8Array[] = []
  const centrales: Uint8Array[] = []
  let desplazamiento = 0

  for (const e of nombresUnicos(entradas)) {
    const nombre = utf8.encode(e.nombre)
    const crc = crc32(e.datos)
    const tam = e.datos.length

    const local = new Uint8Array(30 + nombre.length)
    const vl = new DataView(local.buffer)
    vl.setUint32(0, 0x04034b50, true) // firma de cabecera local
    vl.setUint16(4, 20, true) // versión necesaria: 2.0
    vl.setUint16(6, 0x0800, true) // bit 11: el nombre va en UTF-8
    vl.setUint16(8, 0, true) // método 0 = almacenado
    vl.setUint16(10, hora, true)
    vl.setUint16(12, dia, true)
    vl.setUint32(14, crc, true)
    vl.setUint32(18, tam, true) // comprimido = original (almacenado)
    vl.setUint32(22, tam, true)
    vl.setUint16(26, nombre.length, true)
    vl.setUint16(28, 0, true) // sin campo «extra»
    local.set(nombre, 30)

    const central = new Uint8Array(46 + nombre.length)
    const vc = new DataView(central.buffer)
    vc.setUint32(0, 0x02014b50, true) // firma del directorio central
    vc.setUint16(4, 20, true)
    vc.setUint16(6, 20, true)
    vc.setUint16(8, 0x0800, true)
    vc.setUint16(10, 0, true)
    vc.setUint16(12, hora, true)
    vc.setUint16(14, dia, true)
    vc.setUint32(16, crc, true)
    vc.setUint32(20, tam, true)
    vc.setUint32(24, tam, true)
    vc.setUint16(28, nombre.length, true)
    vc.setUint32(42, desplazamiento, true) // dónde empieza su cabecera local
    central.set(nombre, 46)

    locales.push(local, e.datos)
    centrales.push(central)
    desplazamiento += local.length + tam
  }

  const tamCentral = centrales.reduce((s, c) => s + c.length, 0)
  const fin = new Uint8Array(22)
  const vf = new DataView(fin.buffer)
  vf.setUint32(0, 0x06054b50, true) // firma del registro final
  vf.setUint16(8, centrales.length, true)
  vf.setUint16(10, centrales.length, true)
  vf.setUint32(12, tamCentral, true)
  vf.setUint32(16, desplazamiento, true)

  const partes = [...locales, ...centrales, fin]
  const total = partes.reduce((s, p) => s + p.length, 0)
  const zip = new Uint8Array(total)
  let i = 0
  for (const p of partes) {
    zip.set(p, i)
    i += p.length
  }
  return zip
}

/** Quita de un nombre de fichero lo que ningún sistema operativo admite. */
export function nombreFicheroSeguro(s: string): string {
  return (s || 'sin-nombre')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}
