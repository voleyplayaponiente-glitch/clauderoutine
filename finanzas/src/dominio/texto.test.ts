import { describe, it, expect } from 'vitest'
import { decodificarTextoBancario } from './texto'

/** Codifica un texto en Windows-1252 (solo el rango de un byte, que es el que usan los bancos). */
function aWindows1252(texto: string): ArrayBuffer {
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i) & 0xff
  return bytes.buffer
}

function aUtf8(texto: string): ArrayBuffer {
  const b = new TextEncoder().encode(texto)
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}

describe('decodificación de extractos bancarios', () => {
  it('lee correctamente un fichero UTF-8', () => {
    expect(decodificarTextoBancario(aUtf8('Aportación de capital ñ'))).toBe('Aportación de capital ñ')
  })

  it('recupera los acentos de un fichero Windows-1252', () => {
    const buf = aWindows1252('Aportación de capital SUA BEAUTY')
    expect(decodificarTextoBancario(buf)).toBe('Aportación de capital SUA BEAUTY')
  })

  it('no deja caracteres de reemplazo donde antes salían', () => {
    const texto = decodificarTextoBancario(aWindows1252('Préstamo señor Muñoz'))
    expect(texto).not.toContain('�')
    expect(texto).toBe('Préstamo señor Muñoz')
  })

  it('respeta el BOM de UTF-8 y no lo deja en el texto', () => {
    const conBom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('TRIBUTO')])
    expect(decodificarTextoBancario(conBom.buffer)).toBe('TRIBUTO')
  })

  it('el texto ASCII puro no cambia', () => {
    const ascii = '22    0418260115260115120012000000000121000000000001'
    expect(decodificarTextoBancario(aUtf8(ascii))).toBe(ascii)
  })
})
