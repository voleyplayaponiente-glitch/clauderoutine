import { describe, it, expect } from 'vitest'
import { crearZip, crc32, nombreFicheroSeguro } from './zip'

const FECHA = new Date(Date.UTC(2026, 7, 8, 12, 0, 0))
const bytes = (s: string) => new TextEncoder().encode(s)
const leerU32 = (z: Uint8Array, i: number) => new DataView(z.buffer, z.byteOffset).getUint32(i, true)

describe('CRC-32', () => {
  it('coincide con el valor conocido de «123456789»', () => {
    // Vector de prueba estándar del CRC-32 (0xCBF43926).
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926)
  })

  it('el de una entrada vacía es cero', () => {
    expect(crc32(new Uint8Array(0))).toBe(0)
  })
})

describe('zip', () => {
  it('empieza por la firma PK y termina por el registro final', () => {
    const z = crearZip([{ nombre: 'a.txt', datos: bytes('hola') }], FECHA)
    expect(leerU32(z, 0)).toBe(0x04034b50)
    expect(leerU32(z, z.length - 22)).toBe(0x06054b50)
  })

  it('guarda el contenido tal cual, sin comprimir', () => {
    const z = crearZip([{ nombre: 'a.txt', datos: bytes('hola') }], FECHA)
    expect(new TextDecoder().decode(z)).toContain('hola')
  })

  it('cuenta bien las entradas', () => {
    const z = crearZip(
      [
        { nombre: 'resumen.csv', datos: bytes('a;b') },
        { nombre: 'facturas/f1.pdf', datos: bytes('%PDF-1') },
        { nombre: 'facturas/f2.pdf', datos: bytes('%PDF-2') },
      ],
      FECHA,
    )
    const fin = z.length - 22
    expect(new DataView(z.buffer, z.byteOffset).getUint16(fin + 8, true)).toBe(3)
  })

  it('no deja dos entradas con el mismo nombre', () => {
    const z = crearZip(
      [
        { nombre: 'f.pdf', datos: bytes('1') },
        { nombre: 'f.pdf', datos: bytes('2') },
      ],
      FECHA,
    )
    const texto = new TextDecoder().decode(z)
    expect(texto).toContain('f (2).pdf')
  })

  it('admite un zip vacío sin romperse', () => {
    const z = crearZip([], FECHA)
    expect(z.length).toBe(22)
    expect(leerU32(z, 0)).toBe(0x06054b50)
  })
})

describe('nombres de fichero', () => {
  it('quita los caracteres que ningún sistema admite', () => {
    // Un nº de factura como «518/26» crearía una subcarpeta sin querer.
    expect(nombreFicheroSeguro('518/26 FRA: "stand"')).toBe('518-26 FRA- -stand-')
  })

  it('nunca devuelve vacío', () => {
    expect(nombreFicheroSeguro('')).toBe('sin-nombre')
  })
})
