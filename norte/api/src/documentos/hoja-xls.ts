import type { Celda } from '@norte/dominio'
import type { Hoja } from './hoja-xlsx.js'

/**
 * `.xls` de los de antes (BIFF8 dentro de un contenedor OLE2).
 *
 * No es nostalgia: el extracto real que descarga uno de los bancos de casa es
 * exactamente esto, un fichero compuesto de Microsoft escrito por un Excel de
 * Mac. Si el lector solo entendiera `.xlsx`, la primera descarga del usuario
 * fallaría, que es justo el escenario que este proyecto quiere evitar.
 *
 * Se implementa el subconjunto que usa una exportación bancaria: nombres de
 * hoja, tabla de cadenas y celdas de texto y de número. Ni gráficos, ni
 * fórmulas complejas, ni estilos.
 */

const FIRMA_OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

export function esXlsAntiguo(datos: Buffer): boolean {
  return datos.length > 8 && datos.subarray(0, 8).equals(FIRMA_OLE)
}

// ───────────────────────────────────────────────── Contenedor OLE2 (CFB)

interface Ole {
  leerFlujo(nombre: string): Buffer | null
}

function abrirOle(datos: Buffer): Ole {
  if (!esXlsAntiguo(datos)) throw new Error('No es un fichero compuesto de Microsoft.')

  // La potencia del tamaño de sector va de 7 a 12 según la especificación
  // (128 a 4096 bytes). Un valor fuera de rango no es un Excel raro, es un
  // fichero roto o preparado: `1 << 16` daría sectores de 64 KB y las cuentas
  // de más abajo se dispararían.
  const potenciaSector = datos.readUInt16LE(30)
  const potenciaMini = datos.readUInt16LE(32)
  if (potenciaSector < 7 || potenciaSector > 12 || potenciaMini < 2 || potenciaMini > 12) {
    throw new Error('El fichero no es un .xls válido (tamaño de sector imposible).')
  }
  const tamSector = 1 << potenciaSector
  const tamMini = 1 << potenciaMini
  const sectoresFat = datos.readUInt32LE(44)
  const primerDirectorio = datos.readUInt32LE(48)
  const corteMini = datos.readUInt32LE(56)
  const primerMiniFat = datos.readUInt32LE(60)
  const sectoresMiniFat = datos.readUInt32LE(64)
  const primerDifat = datos.readUInt32LE(68)
  const sectoresDifat = datos.readUInt32LE(72)

  const desplazamiento = (sector: number) => (sector + 1) * tamSector

  // DIFAT: los 109 primeros sectores de FAT vienen en la cabecera; el resto se
  // encadena en sectores propios.
  const sectoresDeFat: number[] = []
  for (let i = 0; i < 109 && sectoresDeFat.length < sectoresFat; i++) {
    const sector = datos.readUInt32LE(76 + i * 4)
    if (sector === 0xffffffff) break
    sectoresDeFat.push(sector)
  }
  let siguienteDifat = primerDifat
  for (let i = 0; i < sectoresDifat && siguienteDifat !== 0xffffffff; i++) {
    const base = desplazamiento(siguienteDifat)
    const cuantos = tamSector / 4 - 1
    for (let j = 0; j < cuantos; j++) {
      const sector = datos.readUInt32LE(base + j * 4)
      if (sector !== 0xffffffff) sectoresDeFat.push(sector)
    }
    siguienteDifat = datos.readUInt32LE(base + cuantos * 4)
  }

  const fat: number[] = []
  for (const sector of sectoresDeFat) {
    const base = desplazamiento(sector)
    for (let i = 0; i < tamSector / 4; i++) fat.push(datos.readUInt32LE(base + i * 4))
  }

  // Más sectores de los que caben en el fichero es, siempre, una cadena que se
  // repite: cada sector distinto ocupa sitio real en el fichero. El «+ 16» es
  // holgura para cabeceras. Con el tope antiguo (un millón a secas), un
  // fichero de 15 MB podía apuntar un millón de veces al mismo sector y pedir
  // 60 GB al juntarlos.
  const maxSectores = Math.ceil(datos.length / tamSector) + 16

  function cadena(primero: number, fatUsada: number[]): number[] {
    const sectores: number[] = []
    let actual = primero
    // El tope evita que un fichero corrupto (o malicioso) meta el lector en un
    // bucle infinito con una cadena que se muerde la cola.
    while (actual !== 0xfffffffe && actual !== 0xffffffff && sectores.length < maxSectores) {
      sectores.push(actual)
      const siguiente = fatUsada[actual]
      if (siguiente === undefined) break
      actual = siguiente
    }
    return sectores
  }

  function juntar(sectores: number[]): Buffer {
    // Cinturón además de los tirantes de `maxSectores`: juntar jamás puede
    // producir más bytes de los que tiene el propio fichero por cuatro.
    if (sectores.length * tamSector > datos.length * 4) {
      throw new Error('El fichero no es un .xls válido (las cadenas de sectores no cuadran con su tamaño).')
    }
    const trozos = sectores.map((s) => datos.subarray(desplazamiento(s), desplazamiento(s) + tamSector))
    return Buffer.concat(trozos)
  }

  const miniFat: number[] = []
  if (sectoresMiniFat > 0) {
    const bytes = juntar(cadena(primerMiniFat, fat))
    for (let i = 0; i + 4 <= bytes.length; i += 4) miniFat.push(bytes.readUInt32LE(i))
  }

  const directorio = juntar(cadena(primerDirectorio, fat))
  interface Entrada {
    nombre: string
    tipo: number
    inicio: number
    tamano: number
  }
  const entradas: Entrada[] = []
  for (let i = 0; i + 128 <= directorio.length; i += 128) {
    const largoNombre = directorio.readUInt16LE(i + 64)
    if (largoNombre === 0) continue
    const nombre = directorio.toString('utf16le', i, i + Math.max(0, largoNombre - 2))
    entradas.push({
      nombre,
      tipo: directorio.readUInt8(i + 66),
      inicio: directorio.readUInt32LE(i + 116),
      tamano: directorio.readUInt32LE(i + 120),
    })
  }

  // El «mini stream» vive dentro del flujo de la entrada raíz.
  const raiz = entradas.find((e) => e.tipo === 5)
  const miniContenedor = raiz ? juntar(cadena(raiz.inicio, fat)) : Buffer.alloc(0)

  return {
    leerFlujo(nombre: string): Buffer | null {
      const entrada = entradas.find((e) => e.tipo === 2 && e.nombre === nombre)
      if (!entrada) return null
      if (entrada.tamano >= corteMini) {
        return juntar(cadena(entrada.inicio, fat)).subarray(0, entrada.tamano)
      }
      const trozos = cadena(entrada.inicio, miniFat).map((s) =>
        miniContenedor.subarray(s * tamMini, (s + 1) * tamMini),
      )
      return Buffer.concat(trozos).subarray(0, entrada.tamano)
    },
  }
}

// ───────────────────────────────────────────────── Registros BIFF

interface Registro {
  tipo: number
  datos: Buffer
}

function troceaRegistros(flujo: Buffer): Registro[] {
  const registros: Registro[] = []
  let i = 0
  while (i + 4 <= flujo.length) {
    const tipo = flujo.readUInt16LE(i)
    const largo = flujo.readUInt16LE(i + 2)
    if (i + 4 + largo > flujo.length) break
    registros.push({ tipo, datos: flujo.subarray(i + 4, i + 4 + largo) })
    i += 4 + largo
  }
  return registros
}

const BOF = 0x0809
const EOF_REG = 0x000a
const BOUNDSHEET = 0x0085
const SST = 0x00fc
const CONTINUE = 0x003c
const LABELSST = 0x00fd
const LABEL = 0x0204
const RK = 0x027e
const MULRK = 0x00bd
const NUMBER = 0x0203
const FORMULA = 0x0006
const STRING = 0x0207
const RSTRING = 0x00d6

/**
 * Lector de la tabla de cadenas.
 *
 * La parte incómoda del formato: una cadena puede quedar partida entre el
 * registro SST y los CONTINUE que le siguen, y **al reanudar cambia el ancho
 * de carácter** (el primer byte del CONTINUE vuelve a declarar si lo que queda
 * es de uno o de dos bytes). Sin esto, un fichero con muchas cadenas empieza a
 * devolver texto en chino a partir de cierta fila.
 */
function leerSst(bloques: Buffer[]): string[] {
  let bloque = 0
  let pos = 0

  function quedan(): number {
    return (bloques[bloque]?.length ?? 0) - pos
  }
  function siguienteBloque(): boolean {
    if (bloque + 1 >= bloques.length) return false
    bloque++
    pos = 0
    return true
  }
  function leer(n: number): Buffer {
    const trozos: Buffer[] = []
    let faltan = n
    while (faltan > 0) {
      if (quedan() === 0 && !siguienteBloque()) break
      const coger = Math.min(faltan, quedan())
      trozos.push(bloques[bloque]!.subarray(pos, pos + coger))
      pos += coger
      faltan -= coger
    }
    return Buffer.concat(trozos)
  }

  const cabecera = leer(8)
  if (cabecera.length < 8) return []
  const unicas = cabecera.readUInt32LE(4)

  const cadenas: string[] = []
  for (let i = 0; i < unicas; i++) {
    if (quedan() === 0 && !siguienteBloque()) break
    const cch = leer(2)
    if (cch.length < 2) break
    let restantes = cch.readUInt16LE(0)
    const banderas = leer(1)[0] ?? 0
    let anchoDoble = (banderas & 0x01) !== 0
    const rico = (banderas & 0x08) !== 0
    const extendido = (banderas & 0x04) !== 0
    const runs = rico ? leer(2).readUInt16LE(0) : 0
    const extra = extendido ? leer(4).readUInt32LE(0) : 0

    const trozos: string[] = []
    while (restantes > 0) {
      if (quedan() === 0 && !siguienteBloque()) break
      // Al cruzar a un CONTINUE, el primer byte vuelve a decir el ancho.
      if (pos === 0 && bloque > 0) {
        anchoDoble = ((leer(1)[0] ?? 0) & 0x01) !== 0
      }
      const cabenAqui = Math.min(restantes, Math.floor(quedan() / (anchoDoble ? 2 : 1)))
      if (cabenAqui === 0) {
        if (!siguienteBloque()) break
        continue
      }
      const bytes = leer(cabenAqui * (anchoDoble ? 2 : 1))
      trozos.push(anchoDoble ? bytes.toString('utf16le') : bytes.toString('latin1'))
      restantes -= cabenAqui
    }
    if (runs > 0) leer(runs * 4)
    if (extra > 0) leer(extra)
    cadenas.push(trozos.join(''))
  }
  return cadenas
}

/** Cadena Unicode corta, tal como aparece en BOUNDSHEET y LABEL. */
function cadenaCorta(datos: Buffer, offset: number, bytesLargo: 1 | 2): string {
  const largo = bytesLargo === 1 ? datos.readUInt8(offset) : datos.readUInt16LE(offset)
  const banderas = datos.readUInt8(offset + bytesLargo)
  const inicio = offset + bytesLargo + 1
  return (banderas & 0x01) !== 0
    ? datos.toString('utf16le', inicio, inicio + largo * 2)
    : datos.toString('latin1', inicio, inicio + largo)
}

/** Un RK es un double comprimido en 30 bits. */
function valorRk(rk: number): number {
  const entero = (rk & 0x02) !== 0
  const porCien = (rk & 0x01) !== 0
  let valor: number
  if (entero) {
    valor = rk >> 2
  } else {
    const buf = Buffer.alloc(8)
    buf.writeInt32LE(rk & 0xfffffffc, 4)
    valor = buf.readDoubleLE(0)
  }
  return porCien ? valor / 100 : valor
}

export function leerXls(datos: Buffer): Hoja[] {
  const ole = abrirOle(datos)
  const flujo = ole.leerFlujo('Workbook') ?? ole.leerFlujo('Book')
  if (!flujo) throw new Error('El .xls no contiene un libro de Excel legible.')

  const registros = troceaRegistros(flujo)

  // Los BOUNDSHEET del bloque global dicen el nombre de cada hoja y en qué
  // byte del flujo empieza su subflujo.
  const hojas: { nombre: string; inicio: number }[] = []
  const cadenas: string[] = []
  for (let i = 0; i < registros.length; i++) {
    const registro = registros[i]!
    // El bloque global termina en su propio EOF; a partir de ahí empiezan los
    // subflujos de las hojas y ya no hay nada global que leer.
    if (registro.tipo === EOF_REG) break
    if (registro.tipo === BOUNDSHEET && registro.datos.length >= 8) {
      hojas.push({ nombre: cadenaCorta(registro.datos, 6, 1), inicio: registro.datos.readUInt32LE(0) })
    }
    if (registro.tipo === SST) {
      const bloques = [registro.datos]
      for (let j = i + 1; j < registros.length && registros[j]!.tipo === CONTINUE; j++) {
        bloques.push(registros[j]!.datos)
      }
      cadenas.push(...leerSst(bloques))
    }
  }

  // Reconstruir la posición en bytes de cada registro para poder saltar al
  // subflujo de cada hoja.
  const posiciones: number[] = []
  let cursor = 0
  for (const registro of registros) {
    posiciones.push(cursor)
    cursor += 4 + registro.datos.length
  }

  const resultado: Hoja[] = []
  for (const hoja of hojas) {
    const desde = posiciones.findIndex((p) => p === hoja.inicio)
    if (desde === -1) continue
    resultado.push({ nombre: hoja.nombre, filas: leerSubflujo(registros, desde, cadenas) })
  }
  if (resultado.length === 0) {
    // Sin BOUNDSHEET utilizables se lee todo de corrido: peor, pero mejor que
    // devolver nada.
    resultado.push({ nombre: 'Hoja 1', filas: leerSubflujo(registros, 0, cadenas) })
  }
  return resultado
}

function leerSubflujo(registros: Registro[], desde: number, cadenas: string[]): Celda[][] {
  const filas: Celda[][] = []
  const poner = (fila: number, columna: number, valor: Celda) => {
    const destino = (filas[fila] ??= [])
    destino[columna] = valor
  }

  let esperandoCadena: { fila: number; columna: number } | null = null

  for (let i = desde + 1; i < registros.length; i++) {
    const { tipo, datos } = registros[i]!
    if (tipo === BOF && i > desde) break
    if (tipo === EOF_REG) break
    if (datos.length < 4) continue
    const fila = datos.readUInt16LE(0)
    const columna = datos.readUInt16LE(2)

    switch (tipo) {
      case LABELSST:
        poner(fila, columna, cadenas[datos.readUInt32LE(6)] ?? '')
        break
      case LABEL:
      case RSTRING:
        poner(fila, columna, cadenaCorta(datos, 6, 2))
        break
      case RK:
        poner(fila, columna, valorRk(datos.readInt32LE(6)))
        break
      case MULRK: {
        // Una tira de RK consecutivos en la misma fila; la última palabra es la
        // columna final, no un valor.
        const ultima = datos.readUInt16LE(datos.length - 2)
        for (let c = columna, o = 4; c <= ultima && o + 6 <= datos.length; c++, o += 6) {
          poner(fila, c, valorRk(datos.readInt32LE(o + 2)))
        }
        break
      }
      case NUMBER:
        poner(fila, columna, datos.readDoubleLE(6))
        break
      case FORMULA: {
        // Si los dos últimos bytes del resultado son 0xFFFF, el valor no es un
        // número: viene en el registro STRING siguiente.
        if (datos.length >= 14 && datos.readUInt16LE(12) === 0xffff) {
          esperandoCadena = { fila, columna }
        } else if (datos.length >= 14) {
          poner(fila, columna, datos.readDoubleLE(6))
        }
        break
      }
      case STRING: {
        if (esperandoCadena && datos.length >= 3) {
          poner(esperandoCadena.fila, esperandoCadena.columna, cadenaCorta(datos, 0, 2))
          esperandoCadena = null
        }
        break
      }
      default:
        break
    }
  }

  const ancho = filas.reduce((max, f) => Math.max(max, f?.length ?? 0), 0)
  for (let f = 0; f < filas.length; f++) {
    const destino = (filas[f] ??= [])
    for (let c = 0; c < ancho; c++) destino[c] ??= null
  }
  return filas
}
