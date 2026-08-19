import { comprobarCentimos, type Centimos } from './dinero.js'
import { aISO, deISO, sumarDias, type FechaISO } from './fechas.js'

/**
 * El cuadro: patrimonio neto y proyección de saldo.
 *
 * El patrimonio neto es **la única cifra que resume una situación financiera
 * entera**. El saldo de la cuenta corriente sube cuando pides un préstamo, y eso
 * no es haber mejorado: activos menos pasivos sí lo dice.
 */

export interface ComponentePatrimonio {
  nombre: string
  clase: 'liquido' | 'inversion' | 'bien' | 'deuda' | 'tarjeta'
  /** Céntimos, siempre en positivo. El signo lo pone la clase. */
  valor: Centimos
}

export interface Patrimonio {
  activos: Centimos
  pasivos: Centimos
  neto: Centimos
  componentes: (ComponentePatrimonio & { esPasivo: boolean })[]
}

const PASIVOS: ComponentePatrimonio['clase'][] = ['deuda', 'tarjeta']

export function patrimonioNeto(componentes: ComponentePatrimonio[]): Patrimonio {
  let activos = 0
  let pasivos = 0
  for (const componente of componentes) {
    if (PASIVOS.includes(componente.clase)) pasivos += componente.valor
    else activos += componente.valor
  }
  return {
    activos: comprobarCentimos(activos),
    pasivos: comprobarCentimos(pasivos),
    neto: comprobarCentimos(activos - pasivos),
    componentes: componentes.map((c) => ({ ...c, esPasivo: PASIVOS.includes(c.clase) })),
  }
}

export interface Variacion {
  absoluta: Centimos
  /** `null` cuando no hay base con la que comparar: dividir por cero daría
   *  infinito, y un «+∞ %» en una pantalla de patrimonio es ridículo. */
  porcentaje: number | null
}

export function variacion(actual: Centimos, anterior: Centimos): Variacion {
  return {
    absoluta: comprobarCentimos(actual - anterior),
    porcentaje: anterior === 0 ? null : ((actual - anterior) / Math.abs(anterior)) * 100,
  }
}

// ──────────────────────────────────────────────────── Proyección de saldo

export interface ApunteFuturo {
  fecha: FechaISO
  /** Negativo lo que sale. */
  importe: Centimos
  concepto: string
}

export interface DiaProyectado {
  fecha: FechaISO
  saldo: Centimos
  /** Lo que se mueve ese día, para poder explicar un escalón. */
  movimiento: Centimos
}

export interface Proyeccion {
  dias: DiaProyectado[]
  /** El día de saldo más bajo. Es **la** cifra de esta proyección: no importa
   *  acabar el mes con 800 € si el día 12 te quedas en −40. */
  minimo: DiaProyectado
  saldoFinal: Centimos
  primerDiaEnNegativo: FechaISO | null
}

/**
 * Proyecta el saldo día a día a partir de lo que ya está comprometido.
 *
 * Solo entra lo previsto: recibos domiciliados, cuotas, nóminas. **No se
 * extrapola el gasto variable.** Inventarse «los martes gastas 14 €» produce
 * una línea preciosa que no se cumple nunca, y una proyección en la que no se
 * puede confiar es peor que ninguna.
 */
export function proyectarSaldo(entrada: {
  saldoInicial: Centimos
  desde: FechaISO
  dias: number
  apuntes: ApunteFuturo[]
}): Proyeccion {
  comprobarCentimos(entrada.saldoInicial)
  const total = Math.max(1, Math.min(entrada.dias, 400))

  const porDia = new Map<FechaISO, Centimos>()
  for (const apunte of entrada.apuntes) {
    porDia.set(apunte.fecha, (porDia.get(apunte.fecha) ?? 0) + apunte.importe)
  }

  const inicio = deISO(entrada.desde)
  const dias: DiaProyectado[] = []
  let saldo = entrada.saldoInicial
  let minimo: DiaProyectado | null = null
  let primerDiaEnNegativo: FechaISO | null = null

  for (let i = 0; i < total; i++) {
    const fecha = aISO(sumarDias(inicio, i))
    const movimiento = porDia.get(fecha) ?? 0
    saldo += movimiento
    const dia: DiaProyectado = { fecha, saldo: comprobarCentimos(saldo), movimiento }
    dias.push(dia)
    if (!minimo || dia.saldo < minimo.saldo) minimo = dia
    if (primerDiaEnNegativo === null && dia.saldo < 0) primerDiaEnNegativo = fecha
  }

  return {
    dias,
    minimo: minimo!,
    saldoFinal: dias[dias.length - 1]!.saldo,
    primerDiaEnNegativo,
  }
}

// ──────────────────────────────────────────────────────── Serie histórica

export interface PuntoHistorico {
  mes: FechaISO
  neto: Centimos
}

/**
 * Prepara la serie del gráfico y dice si hay bastante para dibujarla.
 *
 * Con un solo punto no hay evolución que enseñar: una línea de un punto es una
 * mentira gráfica, porque el ojo la lee como «plano». Mejor decir cuántas fotos
 * faltan.
 */
export function serieDePatrimonio(fotos: PuntoHistorico[]): {
  puntos: PuntoHistorico[]
  hayBastante: boolean
  variacionPeriodo: Variacion | null
} {
  const puntos = [...fotos].sort((a, b) => a.mes.localeCompare(b.mes))
  if (puntos.length < 2) return { puntos, hayBastante: false, variacionPeriodo: null }
  return {
    puntos,
    hayBastante: true,
    variacionPeriodo: variacion(puntos[puntos.length - 1]!.neto, puntos[0]!.neto),
  }
}
