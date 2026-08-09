/**
 * Qué datáfono cobra en cada tienda.
 *
 * Una tienda puede tener más de un terminal (uno fijo y otro de repuesto, o
 * dos bancos distintos). El que se aplica por defecto es el marcado como
 * **principal**; si no hay ninguno marcado, el primero activo de esa tienda.
 * Si no hay ninguno, no se inventa: el cobro se queda sin datáfono y la app lo
 * enseña para que se elija a mano.
 */
import type { Datafono, ID } from './tipos'

export function datafonosDe(datafonos: Datafono[], centroCosteId: ID | undefined): Datafono[] {
  if (!centroCosteId) return []
  return datafonos.filter((d) => d.activo && d.centroCosteId === centroCosteId)
}

/** El que cobra por defecto en esa tienda. */
export function datafonoPrincipal(datafonos: Datafono[], centroCosteId: ID | undefined): Datafono | undefined {
  const suyos = datafonosDe(datafonos, centroCosteId)
  return suyos.find((d) => d.principal) ?? suyos[0]
}

/**
 * Marca uno como principal y quita la marca a los demás **de su misma tienda**:
 * dos principales en un mismo sitio harían que «el principal» no significara
 * nada. Los de otras tiendas no se tocan.
 */
export function marcarPrincipal(datafonos: Datafono[], id: ID): Datafono[] {
  const elegido = datafonos.find((d) => d.id === id)
  if (!elegido) return datafonos
  return datafonos.map((d) => {
    if (d.id === id) return { ...d, principal: true }
    if (d.centroCosteId && d.centroCosteId === elegido.centroCosteId) return { ...d, principal: false }
    return d
  })
}

/** Tiendas que cobran con tarjeta pero no tienen ningún datáfono activo. */
export function tiendasSinDatafono(
  datafonos: Datafono[],
  puntos: { id: ID; nombre: string; tipoPuntoVenta?: string }[],
): { id: ID; nombre: string }[] {
  return puntos
    .filter((p) => p.tipoPuntoVenta !== 'WEB' && datafonosDe(datafonos, p.id).length === 0)
    .map((p) => ({ id: p.id, nombre: p.nombre }))
}
