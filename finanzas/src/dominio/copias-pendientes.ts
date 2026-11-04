/**
 * Qué empresas tienen cambios que AÚN NO están en el servidor de copias.
 *
 * Nace de dos fallos reales de la subida automática, que vivía en un simple
 * temporizador de dos minutos:
 *  · **Si se cerraba la pestaña antes de que venciera, la copia no se hacía
 *    nunca.** Nada lo recordaba al volver a abrir la app. Así pudo pasar una
 *    semana entera sin copia con la subida automática encendida.
 *  · **El temporizador subía la empresa equivocada**: guardaba el id de la
 *    empresa del cambio pero leía los datos de la empresa ACTIVA en el momento
 *    de subir. Cambiar de sociedad dentro de esos dos minutos metía los datos de
 *    una en la carpeta de la otra.
 *
 * Ahora cada cambio deja una marca persistente por empresa («cambio»), y solo
 * una subida que EMPEZÓ después de ese cambio la borra. Lo que no se sube hoy se
 * sube al volver a abrir la app. Puro: sin IndexedDB ni red.
 */

export interface EstadoCopiaEmpresa {
  /** Último cambio de datos que todavía no consta subido. */
  cambio?: string
  /** Última subida que terminó bien. */
  subida?: string
  /** Motivo del último fallo, si el último intento falló. */
  error?: string
}

export type EstadoCopias = Record<string, EstadoCopiaEmpresa>

/** Anota que la empresa tiene cambios sin subir. Conserva el más antiguo: es el que mide el retraso. */
export function marcarCambio(e: EstadoCopias, empresaId: string, ahora: string): EstadoCopias {
  const actual = e[empresaId] ?? {}
  if (actual.cambio) return e
  return { ...e, [empresaId]: { ...actual, cambio: ahora } }
}

/**
 * Anota una subida correcta. `inicio` es cuándo se LEYERON los datos que se han
 * subido: si hubo un cambio después, la marca se queda y se volverá a subir.
 */
export function marcarSubida(e: EstadoCopias, empresaId: string, inicio: string, ahora: string, ultimoCambio?: string): EstadoCopias {
  const actual = e[empresaId] ?? {}
  // `>=`: un cambio en el mismo milisegundo de la lectura puede no ir dentro.
  const sigue = ultimoCambio !== undefined && ultimoCambio >= inicio
  return { ...e, [empresaId]: { subida: ahora, ...(sigue && actual.cambio ? { cambio: actual.cambio } : {}) } }
}

/** Anota un fallo. La marca de cambio se queda: se reintentará. */
export function marcarError(e: EstadoCopias, empresaId: string, motivo: string): EstadoCopias {
  return { ...e, [empresaId]: { ...(e[empresaId] ?? {}), error: motivo } }
}

/** Empresa sin nada que subir (vacía): se retira la marca para no avisar en falso. */
export function descartarCambio(e: EstadoCopias, empresaId: string): EstadoCopias {
  const actual = e[empresaId]
  if (!actual?.cambio) return e
  const { cambio: _c, ...resto } = actual
  return { ...e, [empresaId]: resto }
}

/** Empresas (de las que existen) con cambios pendientes de subir, la más atrasada primero. */
export function empresasPorSubir(e: EstadoCopias, empresas: string[]): string[] {
  return empresas
    .filter((id) => e[id]?.cambio)
    .sort((a, b) => (e[a].cambio as string).localeCompare(e[b].cambio as string))
}

/**
 * Empresas con datos guardados que NUNCA se han subido: se marcan como
 * pendientes. Cubre los datos que ya existían antes de esta versión, que no
 * tienen marca de ningún tipo.
 */
export function marcarNuncaSubidas(e: EstadoCopias, conDatos: string[], ahora: string): EstadoCopias {
  let r = e
  for (const id of conDatos) if (!r[id]?.subida && !r[id]?.cambio) r = marcarCambio(r, id, ahora)
  return r
}

export interface RetrasoCopias {
  /** Empresas con cambios sin subir desde hace más del margen. */
  empresas: string[]
  /** El cambio sin subir más antiguo. */
  desde: string
  /** Último motivo de fallo, si lo hay. */
  error?: string
}

/**
 * ¿Hay copias atrasadas de verdad? Un cambio de hace unos segundos no es un
 * problema (la subida va en camino); uno de hace más de `margenMin` minutos, o
 * cualquiera con un fallo anotado, sí.
 */
export function retrasoCopias(e: EstadoCopias, empresas: string[], ahora: string, margenMin = 60): RetrasoCopias | undefined {
  const limite = new Date(new Date(ahora).getTime() - margenMin * 60_000).toISOString()
  const atrasadas = empresas.filter((id) => {
    const x = e[id]
    return x?.cambio !== undefined && (x.cambio < limite || x.error !== undefined)
  })
  if (atrasadas.length === 0) return undefined
  const desde = atrasadas.map((id) => e[id].cambio as string).sort()[0]
  const error = atrasadas.map((id) => e[id].error).find((m) => m)
  return { empresas: atrasadas, desde, ...(error ? { error } : {}) }
}
