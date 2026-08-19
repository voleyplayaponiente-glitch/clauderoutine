import { comprobarCentimos, type Centimos } from './dinero.js'
import { calcularReparto, type Reparto } from './reparto.js'

/**
 * Quién le debe cuánto a quién, y con cuántas transferencias se arregla.
 *
 * Un gasto compartido tiene dos caras que casi todas las aplicaciones mezclan:
 * **quién lo pagó** (el dueño de la cuenta de la que salió el dinero) y **a
 * quién le tocaba pagarlo** (lo que dice el reparto). La diferencia entre las
 * dos es la deuda. Todo lo de aquí sale de esa resta.
 */

export interface GastoCompartido {
  id: string
  fecha: string
  concepto: string
  /** En céntimos y **en positivo**: lo que costó. */
  importe: Centimos
  /** Dueño de la cuenta de la que salió el dinero. */
  pagadoPor: string
  reparto: Reparto
}

export interface Saldo {
  usuarioId: string
  /** Lo que ha puesto de su bolsillo. */
  pagado: Centimos
  /** Lo que le tocaba poner según los repartos. */
  debido: Centimos
  /** `pagado - debido`. Positivo: le deben. Negativo: debe. */
  saldo: Centimos
}

export interface Pago {
  deUsuarioId: string
  aUsuarioId: string
  importe: Centimos
}

/**
 * La cuenta del periodo: quién ha puesto qué y cómo se salda. Se llama
 * `CuentaCompartida` y no `Cuenta` porque en esta aplicación una cuenta es una
 * cuenta bancaria, y confundir las dos sería caro.
 */
export interface CuentaCompartida {
  saldos: Saldo[]
  pagos: Pago[]
  /** Total repartido en el periodo, para poder enseñarlo sin volver a sumar. */
  total: Centimos
}

/**
 * Reparte cada gasto y suma. Los participantes son los miembros que aparecen
 * en `miembros`; un pagador que ya no es miembro sigue contando —su dinero
 * existió— pero no se le asignan cuotas nuevas.
 */
export function calcularSaldos(gastos: GastoCompartido[], miembros: string[]): CuentaCompartida {
  const pagado = new Map<string, number>()
  const debido = new Map<string, number>()
  for (const usuarioId of miembros) {
    pagado.set(usuarioId, 0)
    debido.set(usuarioId, 0)
  }

  let total = 0
  for (const gasto of gastos) {
    comprobarCentimos(gasto.importe)
    total += gasto.importe
    pagado.set(gasto.pagadoPor, (pagado.get(gasto.pagadoPor) ?? 0) + gasto.importe)
    for (const cuota of calcularReparto(gasto.importe, gasto.reparto)) {
      debido.set(cuota.usuarioId, (debido.get(cuota.usuarioId) ?? 0) + cuota.importe)
    }
  }

  const usuarios = [...new Set([...miembros, ...pagado.keys(), ...debido.keys()])]
  const saldos = usuarios.map((usuarioId) => {
    const puesto = pagado.get(usuarioId) ?? 0
    const tocaba = debido.get(usuarioId) ?? 0
    return { usuarioId, pagado: puesto, debido: tocaba, saldo: puesto - tocaba }
  })

  return { saldos, pagos: liquidar(saldos), total }
}

/**
 * Convierte los saldos en transferencias concretas, **con el menor número de
 * transferencias posible**. Nadie quiere hacer seis bizums.
 *
 * La parte que casi nadie implementa: si un subgrupo suma cero por su cuenta
 * (A debe 50 a B, y B debe 50 a C… no; A debe 50, B cobra 50), se puede cerrar
 * dentro del subgrupo y ahorrar una transferencia. Buscar la mejor partición
 * en subgrupos que sumen cero es un problema exponencial, así que se hace
 * exacto mientras el grupo sea pequeño —que es el caso real: una pareja, un
 * piso compartido, tres socios— y se cae a la versión codiciosa por encima de
 * `MAXIMO_EXACTO`, que sigue dando como mucho n-1 transferencias.
 *
 * El resultado es determinista: con los mismos saldos salen los mismos pagos,
 * en el mismo orden. Una liquidación que baila cada vez que se recarga no se
 * puede enseñar a nadie.
 */
export function liquidar(saldos: { usuarioId: string; saldo: Centimos }[]): Pago[] {
  const vivos = saldos
    .filter((s) => s.saldo !== 0)
    .sort((a, b) => b.saldo - a.saldo || a.usuarioId.localeCompare(b.usuarioId))

  const descuadre = vivos.reduce((suma, s) => suma + s.saldo, 0)
  if (descuadre !== 0) {
    // No debería pasar nunca: los repartos suman siempre el total. Si pasa, es
    // un error de programación y prefiero enterarme aquí que emitir pagos que
    // no cuadran.
    throw new Error(`Los saldos no suman cero (sobran ${descuadre} céntimos)`)
  }
  if (vivos.length === 0) return []

  return particionar(vivos).flatMap(codicioso)
}

/** Por encima de esto, la búsqueda exacta deja de ser gratis. */
const MAXIMO_EXACTO = 12

type Participante = { usuarioId: string; saldo: Centimos }

/**
 * Parte el grupo en el **mayor número posible** de subgrupos que sumen cero.
 * Cada subgrupo de tamaño k se cierra con k-1 transferencias, así que a más
 * subgrupos, menos transferencias en total.
 */
function particionar(vivos: Participante[]): Participante[][] {
  if (vivos.length > MAXIMO_EXACTO) return [vivos]

  const n = vivos.length
  const sumas = new Int32Array(1 << n)
  for (let mascara = 1; mascara < 1 << n; mascara++) {
    const ultimo = 31 - Math.clz32(mascara & -mascara)
    sumas[mascara] = sumas[mascara & (mascara - 1)]! + vivos[ultimo]!.saldo
  }

  // `mejor[m]` = cuántos subgrupos que suman cero caben, como mucho, en `m`.
  const mejor = new Int32Array(1 << n)
  // `corte[m]` = el submáscara elegida, para poder reconstruir la partición.
  const corte = new Int32Array(1 << n)
  for (let mascara = 1; mascara < 1 << n; mascara++) {
    const bitBajo = mascara & -mascara
    let tope = -1
    // Se recorren los submáscaras que contienen el bit más bajo: así cada
    // partición se cuenta una sola vez.
    for (let sub = mascara; sub > 0; sub = (sub - 1) & mascara) {
      if ((sub & bitBajo) === 0) continue
      const candidato = mejor[mascara ^ sub]! + (sumas[sub] === 0 ? 1 : 0)
      if (candidato > tope) {
        tope = candidato
        corte[mascara] = sub
      }
    }
    mejor[mascara] = tope
  }

  const grupos: Participante[][] = []
  for (let mascara = (1 << n) - 1; mascara !== 0; ) {
    const sub = corte[mascara]!
    const grupo: Participante[] = []
    for (let i = 0; i < n; i++) if (sub & (1 << i)) grupo.push(vivos[i]!)
    grupos.push(grupo)
    mascara ^= sub
  }
  return grupos
}

/** Dentro de un grupo que suma cero: el que más debe le paga al que más cobra. */
function codicioso(grupo: Participante[]): Pago[] {
  const acreedores = grupo.filter((p) => p.saldo > 0).map((p) => ({ ...p }))
  const deudores = grupo.filter((p) => p.saldo < 0).map((p) => ({ ...p }))
  acreedores.sort((a, b) => b.saldo - a.saldo || a.usuarioId.localeCompare(b.usuarioId))
  deudores.sort((a, b) => a.saldo - b.saldo || a.usuarioId.localeCompare(b.usuarioId))

  const pagos: Pago[] = []
  let i = 0
  let j = 0
  while (i < deudores.length && j < acreedores.length) {
    const importe = Math.min(-deudores[i]!.saldo, acreedores[j]!.saldo)
    if (importe > 0) {
      pagos.push({
        deUsuarioId: deudores[i]!.usuarioId,
        aUsuarioId: acreedores[j]!.usuarioId,
        importe,
      })
    }
    deudores[i]!.saldo += importe
    acreedores[j]!.saldo -= importe
    if (deudores[i]!.saldo === 0) i++
    if (acreedores[j]!.saldo === 0) j++
  }
  return pagos
}

/**
 * Reparte los gastos entre los tres cajones que hay después de un cierre.
 *
 * La distinción importa y no es obvia: **un gasto con fecha anterior al cierre
 * no es lo mismo que un gasto que llegó tarde**. Los que ya estaban ahí cuando
 * se cerró se pagaron en ese cierre y no hay nada que decir de ellos; los que
 * se apuntaron *después* del cierre pero con fecha de antes se han quedado
 * fuera de la cuenta sin que nadie lo haya decidido, y de esos sí hay que
 * avisar.
 *
 * Sin esta separación la pantalla enseñaba los cinco gastos recién liquidados
 * bajo un aviso de «no entran en esta cuenta»: era verdad y sonaba a problema,
 * cuando lo que había pasado es que se acababan de pagar.
 */
export interface Cierre {
  /** Último día ya liquidado (el `hasta` de la liquidación). */
  hasta: string
  /** Cuándo se cerró, en ISO. Lo apuntado después de esto llegó tarde. */
  cerradoEn: string
}

export function clasificarPorPlazo<T extends { fecha: string; apuntadoEn: string }>(
  gastos: T[],
  cierre: Cierre | null,
): { enPlazo: T[]; yaLiquidados: T[]; tardios: T[] } {
  if (cierre === null) return { enPlazo: gastos, yaLiquidados: [], tardios: [] }

  const enPlazo: T[] = []
  const yaLiquidados: T[] = []
  const tardios: T[] = []

  for (const gasto of gastos) {
    if (gasto.fecha > cierre.hasta) enPlazo.push(gasto)
    else if (gasto.apuntadoEn > cierre.cerradoEn) tardios.push(gasto)
    else yaLiquidados.push(gasto)
  }
  return { enPlazo, yaLiquidados, tardios }
}
