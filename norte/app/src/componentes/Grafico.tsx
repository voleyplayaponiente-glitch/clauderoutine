import { formatearDinero } from '@norte/dominio'
import { useEffect, useRef, useState } from 'react'

/**
 * Un gráfico de área de una sola serie.
 *
 * Se usa para las dos cosas que se miran en el cuadro: la evolución del
 * patrimonio y la proyección del saldo. Las dos son «una magnitud a lo largo
 * del tiempo» con **una sola serie**, así que van con un solo color y sin
 * leyenda — una caja de leyenda con un único cuadrito repite el título y ocupa
 * sitio.
 *
 * Especificaciones que no se negocian, y que vienen de la guía de visualización:
 *  · Línea de **2px**, punta y unión redondeadas.
 *  · Relleno del área al **10 %** de opacidad: un lavado, nunca un bloque.
 *  · Rejilla de **1px sólida** y recesiva; nunca discontinua.
 *  · Punto final de **radio 4 con anillo de 2px del color del fondo**, para que
 *    se lea aunque caiga encima de la línea.
 *  · **El texto nunca lleva el color del dato.** El color va en la marca; las
 *    cifras y las etiquetas usan los tonos de texto.
 *  · Etiquetas directas **selectivas**: el último punto y el extremo. Un número
 *    en cada punto es ruido y no lo lee nadie.
 *
 * Lleva capa de interacción (cruz + globo) porque un gráfico en HTML es
 * interactivo por definición, y lo mismo con el teclado. Y debajo, la tabla:
 * el globo **añade**, nunca es la única forma de llegar al dato.
 *
 * El globo **solo aparece al apuntar o al enfocar**. Dejarlo fijo sobre el
 * último punto parecía un globo atascado y además sobresalía del panel: el
 * valor del final va como etiqueta directa, que es su sitio.
 */

export interface PuntoGrafico {
  /** Lo que se enseña en el eje y en el globo. */
  etiqueta: string
  valor: number
}

export function GraficoArea({
  puntos,
  titulo,
  alto = 200,
  lineaCero = false,
  destacado,
}: {
  puntos: PuntoGrafico[]
  /** Describe la serie: al ser una sola, hace de leyenda. */
  titulo: string
  alto?: number
  /** Dibuja la línea del cero. Solo tiene sentido si la serie puede cruzarlo. */
  lineaCero?: boolean
  /**
   * Un punto que merece marca propia (el mínimo de la proyección). El `texto`
   * es opcional: solo se escribe si dice algo que no esté ya en la frase de
   * arriba o en la etiqueta directa del final.
   */
  destacado?: { indice: number; texto?: string; alerta?: boolean }
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  // Arranca SIN medida a propósito. Con un ancho inicial (640) el `<svg>` sale
  // pintado a ese tamaño, y un SVG con `width` en píxeles **empuja** a su
  // contenedor: la rejilla del bento crecía hasta 680 px y desbordaba el móvil.
  // Midiendo primero, el ancho lo decide siempre la maquetación.
  const [ancho, setAncho] = useState<number | null>(null)
  const [cursor, setCursor] = useState<number | null>(null)

  // Medir en vez de escalar el SVG entero: con `viewBox` fijo el texto encoge
  // en el móvil hasta volverse ilegible.
  useEffect(() => {
    const nodo = contenedor.current
    if (!nodo) return
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setAncho(Math.max(200, entrada.contentRect.width))
    })
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [])

  if (puntos.length < 2) return null
  if (ancho === null) {
    // Primer pintado: solo el hueco, para que el observador mida la columna.
    return <div ref={contenedor} className="w-full" style={{ height: alto }} />
  }

  const margen = { arriba: 16, derecha: 16, abajo: 22, izquierda: 8 }
  const anchoUtil = ancho - margen.izquierda - margen.derecha
  const altoUtil = alto - margen.arriba - margen.abajo

  const valores = puntos.map((p) => p.valor)
  const maximo = Math.max(...valores, lineaCero ? 0 : -Infinity)
  const minimo = Math.min(...valores, lineaCero ? 0 : Infinity)
  const rango = maximo - minimo || Math.abs(maximo) || 1
  const holgura = rango * 0.12

  const x = (i: number) => margen.izquierda + (i / (puntos.length - 1)) * anchoUtil
  const y = (valor: number) =>
    margen.arriba + altoUtil - ((valor - (minimo - holgura)) / (rango + holgura * 2)) * altoUtil

  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.valor).toFixed(2)}`).join(' ')
  const area = `${linea} L${x(puntos.length - 1).toFixed(2)},${(margen.arriba + altoUtil).toFixed(2)} L${x(0).toFixed(2)},${(margen.arriba + altoUtil).toFixed(2)} Z`

  const ultimo = puntos.length - 1
  const activo = cursor ?? ultimo
  const hayGlobo = cursor !== null
  const enAlerta = destacado?.alerta === true
  const colorMarca = 'var(--color-marca)'

  function mover(evento: React.PointerEvent<SVGSVGElement>) {
    const caja = evento.currentTarget.getBoundingClientRect()
    const relativa = evento.clientX - caja.left - margen.izquierda
    const indice = Math.round((relativa / anchoUtil) * (puntos.length - 1))
    setCursor(Math.max(0, Math.min(puntos.length - 1, indice)))
  }

  return (
    <div ref={contenedor} className="relative w-full overflow-hidden">
      <svg
        width={ancho}
        height={alto}
        role="img"
        aria-label={`${titulo}. De ${puntos[0]!.etiqueta} a ${puntos[ultimo]!.etiqueta}.`}
        tabIndex={0}
        onPointerMove={mover}
        onPointerLeave={() => setCursor(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setCursor(Math.max(0, activo - 1))
          if (e.key === 'ArrowRight') setCursor(Math.min(ultimo, activo + 1))
        }}
        className="touch-none outline-none focus-visible:ring-2 focus-visible:ring-marca/50"
      >
        {/* Rejilla: tres líneas sólidas de 1px, recesivas. */}
        {[0, 0.5, 1].map((parte) => (
          <line
            key={parte}
            x1={margen.izquierda}
            x2={ancho - margen.derecha}
            y1={margen.arriba + altoUtil * parte}
            y2={margen.arriba + altoUtil * parte}
            stroke="var(--color-linea)"
            strokeWidth={1}
          />
        ))}

        {lineaCero && minimo < 0 && (
          <line
            x1={margen.izquierda}
            x2={ancho - margen.derecha}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--color-texto-3)"
            strokeWidth={1}
          />
        )}

        <path d={area} fill={colorMarca} fillOpacity={0.1} />
        <path
          d={linea}
          fill="none"
          stroke={colorMarca}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Cruz: el lector apunta a una fecha, no a una línea de dos píxeles. */}
        {cursor !== null && (
          <line
            x1={x(cursor)}
            x2={x(cursor)}
            y1={margen.arriba}
            y2={margen.arriba + altoUtil}
            stroke="var(--color-texto-3)"
            strokeWidth={1}
          />
        )}

        {destacado && destacado.indice !== ultimo && (
          <circle
            cx={x(destacado.indice)}
            cy={y(puntos[destacado.indice]!.valor)}
            r={4}
            fill={enAlerta ? 'var(--color-grafico-alerta)' : colorMarca}
            stroke="var(--color-sup-1)"
            strokeWidth={2}
          />
        )}

        <circle
          cx={x(activo)}
          cy={y(puntos[activo]!.valor)}
          r={4}
          fill={colorMarca}
          stroke="var(--color-sup-1)"
          strokeWidth={2}
        />


        {/* Etiqueta directa del final: en una línea, el valor va al extremo.
            Selectiva a propósito — un número en cada punto no lo lee nadie. */}
        <text
          x={x(ultimo)}
          y={Math.max(12, y(puntos[ultimo]!.valor) - 10)}
          textAnchor="end"
          className="fill-[var(--color-texto-1)] text-[12px] font-medium"
        >
          {formatearDinero(puntos[ultimo]!.valor, { sinDecimales: true })}
        </text>

        <text
          x={margen.izquierda}
          y={alto - 4}
          className="fill-[var(--color-texto-3)] text-[11px]"
        >
          {puntos[0]!.etiqueta}
        </text>
        <text
          x={ancho - margen.derecha}
          y={alto - 4}
          textAnchor="end"
          className="fill-[var(--color-texto-3)] text-[11px]"
        >
          {puntos[ultimo]!.etiqueta}
        </text>
      </svg>

      {/* El globo, solo mientras se apunta o se navega con el teclado. El valor
          manda y la fecha acompaña: quien mira ya sabe la serie y quiere el
          número. */}
      {hayGlobo && (
        <div
          className="pointer-events-none absolute w-28 -translate-x-1/2 rounded-campo bg-sup-1 px-2.5 py-1.5 text-center shadow-ambiental ring-1 ring-linea"
          style={{
            left: Math.min(Math.max(x(activo), 56), ancho - 56),
            top: Math.max(0, y(puntos[activo]!.valor) - 52),
          }}
        >
          <p className="cifra text-sm font-medium leading-tight">
            {formatearDinero(puntos[activo]!.valor, { sinDecimales: true })}
          </p>
          <p className="text-xs leading-tight text-texto-3">{puntos[activo]!.etiqueta}</p>
        </div>
      )}

      {destacado?.texto && (
        <p className={`mt-1 text-sm ${enAlerta ? 'text-negativo' : 'text-texto-2'}`}>{destacado.texto}</p>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-texto-3">Ver los datos</summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{titulo}</caption>
            <tbody>
              {puntos.map((punto, i) => (
                <tr key={`${punto.etiqueta}-${i}`} className="border-b border-linea">
                  <th scope="row" className="py-1 text-left font-normal text-texto-2">
                    {punto.etiqueta}
                  </th>
                  <td className="py-1 text-right tabular-nums">{formatearDinero(punto.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
