import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { abrirZip, ErrorZipDesmedido } from '../src/documentos/zip.js'
import { leerXls } from '../src/documentos/hoja-xls.js'

/**
 * Estos ficheros no los produce ningún banco. Los produce alguien que quiere
 * agotar la memoria del servidor con un fichero pequeño, y el lector procesa
 * ficheros que llegan de fuera. Cada test construye el ataque a mano y
 * comprueba que el lector lo corta en vez de intentar servirlo.
 */

/** Un ZIP de una sola entrada con `contenido` comprimido en `deflate`. */
function zipDeUnaEntrada(nombre: string, contenido: Buffer): Buffer {
  const comprimido = deflateRawSync(contenido)
  const nombreBuf = Buffer.from(nombre, 'utf8')

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(8, 8) // método deflate
  local.writeUInt32LE(comprimido.length, 18)
  local.writeUInt32LE(contenido.length, 22)
  local.writeUInt16LE(nombreBuf.length, 26)

  const inicioLocal = 0
  const cabeceraLocal = Buffer.concat([local, nombreBuf, comprimido])

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(8, 10)
  central.writeUInt32LE(comprimido.length, 20)
  central.writeUInt32LE(contenido.length, 24)
  central.writeUInt16LE(nombreBuf.length, 28)
  central.writeUInt32LE(inicioLocal, 42)
  const cabeceraCentral = Buffer.concat([central, nombreBuf])

  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(1, 10)
  fin.writeUInt16LE(1, 8)
  fin.writeUInt32LE(cabeceraCentral.length, 12)
  fin.writeUInt32LE(cabeceraLocal.length, 16)

  return Buffer.concat([cabeceraLocal, cabeceraCentral, fin])
}

describe('bomba de descompresión ZIP', () => {
  it('un fichero que se expande a cientos de MB se corta, no se sirve', () => {
    // 200 MB de ceros comprimen a unos pocos KB. Sin tope, esto pediría 200 MB
    // de RAM por cada lectura del documento.
    const enorme = Buffer.alloc(200 * 1024 * 1024)
    const bomba = zipDeUnaEntrada('sheet1.xml', enorme)
    expect(bomba.length).toBeLessThan(300_000) // el fichero-ataque es pequeño
    expect(() => abrirZip(bomba)).toThrow(ErrorZipDesmedido)
  })

  it('un .xlsx normal se sigue leyendo', () => {
    const contenido = Buffer.from('<xml>un extracto de verdad</xml>', 'utf8')
    const zip = zipDeUnaEntrada('sheet1.xml', contenido)
    const ficheros = abrirZip(zip)
    expect(ficheros.get('sheet1.xml')?.toString('utf8')).toContain('extracto')
  })
})

describe('.xls (OLE2) preparado', () => {
  it('una cabecera con tamaño de sector imposible se rechaza, no revienta', () => {
    const falso = Buffer.alloc(512)
    // Firma OLE2 correcta…
    Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(falso, 0)
    // …pero potencia de sector 16 (65 KB), fuera del rango 7–12.
    falso.writeUInt16LE(16, 30)
    falso.writeUInt16LE(6, 32)
    expect(() => leerXls(falso)).toThrow(/tamaño de sector/i)
  })
})
