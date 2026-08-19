import { formatearDinero, parsearImporte } from '@norte/dominio'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Aviso, BarraSobre, Boton, Cifra, Esqueleto, Etiqueta, Tarjeta } from '../componentes/ui.js'
import { api, ErrorDeApi, type EspacioResumen, type EstadoPresupuesto, type Sobre } from '../lib/api.js'

/**
 * Presupuesto por sobres.
 *
 * La pantalla gira alrededor de **una sola cifra**: lo que queda sin repartir.
 * Mientras no sea cero hay dinero sin un trabajo asignado, y ese es el método
 * entero. Todo lo demás —las barras, el ritmo, el arrastre— está al servicio de
 * llevar ese número a cero y mantenerlo ahí.
 *
 * Cada barra lleva la marca del día del mes. «Llevas gastado el 60 % de la
 * compra» no dice nada; dicho el día 10 es una alarma y el día 28 es una buena
 * noticia.
 */

function mesDeHoy(): string {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}

function nombreDelMes(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number)
  const texto = new Date(anio!, (numero ?? 1) - 1, 1).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  })
  // Solo la primera letra: `capitalize` de CSS convierte «agosto de 2026» en
  // «Agosto De 2026», que no es español.
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function moverMes(mes: string, pasos: number): string {
  const [anio, numero] = mes.split('-').map(Number)
  const fecha = new Date(anio!, (numero ?? 1) - 1 + pasos, 1)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

export function Presupuesto({ espacio }: { espacio: EspacioResumen }) {
  const [mes, setMes] = useState(mesDeHoy)
  const puedeEditar = espacio.rol !== 'lector'

  const estado = useQuery({
    queryKey: ['presupuesto', espacio.id, mes],
    queryFn: () => api.presupuesto(espacio.id, mes),
  })

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">Presupuesto</h1>
          <p className="text-texto-2">{espacio.nombre}</p>
        </div>
        <div className="flex items-center gap-1">
          <Boton variante="fantasma" tamano="pequeno" onClick={() => setMes(moverMes(mes, -1))}>
            ‹
          </Boton>
          <span className="min-w-40 text-center text-sm font-medium">
            {nombreDelMes(mes)}
          </span>
          <Boton variante="fantasma" tamano="pequeno" onClick={() => setMes(moverMes(mes, 1))}>
            ›
          </Boton>
          {mes !== mesDeHoy() && (
            <Boton variante="secundario" tamano="pequeno" onClick={() => setMes(mesDeHoy())}>
              Hoy
            </Boton>
          )}
        </div>
      </header>

      {estado.isLoading && <Esqueleto className="h-64 w-full" />}
      {estado.error instanceof ErrorDeApi && (
        <Aviso tono="error" titulo="No se ha podido cargar">{estado.error.message}</Aviso>
      )}

      {estado.data && (
        <>
          <Cabecera espacio={espacio} mes={mes} estado={estado.data} puedeEditar={puedeEditar} />
          <Sobres espacio={espacio} mes={mes} estado={estado.data} puedeEditar={puedeEditar} />
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────── Cabecera

function Cabecera({
  espacio,
  mes,
  estado,
  puedeEditar,
}: {
  espacio: EspacioResumen
  mes: string
  estado: EstadoPresupuesto
  puedeEditar: boolean
}) {
  const clientes = useQueryClient()
  const { resumen, ingresos } = estado
  const [cerrado, setCerrado] = useState<{ siguiente: string; arrastrados: number } | null>(null)

  const cerrar = useMutation({
    mutationFn: () => api.cerrarMes(espacio.id, mes),
    onSuccess: (datos) => {
      setCerrado(datos)
      clientes.invalidateQueries({ queryKey: ['presupuesto', espacio.id] })
    },
  })

  const tono =
    resumen.sinAsignar === 0 ? 'text-positivo' : resumen.sinAsignar < 0 ? 'text-negativo' : 'text-texto-1'

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-texto-3">Sin asignar</p>
          <p className={`cifra-heroe text-4xl font-semibold ${tono}`}>
            {formatearDinero(resumen.sinAsignar)}
          </p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-texto-2">
            {resumen.sinAsignar === 0
              ? 'Todo el dinero de este mes tiene un trabajo asignado. Eso es el método funcionando.'
              : resumen.sinAsignar > 0
                ? 'Es lo que te queda por repartir entre los sobres.'
                : 'Has repartido más de lo que esperas ingresar. Quita de algún sobre hasta que llegue a cero.'}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
          <Dato nombre="Ingresos" valor={ingresos.total} />
          <Dato nombre="Asignado" valor={resumen.asignado} />
          <Dato nombre="Gastado" valor={resumen.gastado} />
          <Dato nombre="Disponible" valor={resumen.disponible} />
        </dl>
      </div>

      {ingresos.total === 0 && (
        <div className="mt-4">
          <Aviso tono="atencion" titulo="No veo ingresos este mes">
            Solo cuento lo que está clasificado en una categoría de <strong>ingreso</strong>. Lo
            hago así a propósito: un traspaso entre dos cuentas tuyas también entra como apunte
            positivo, y sumarlo daría un presupuesto con dinero que no existe. Clasifica tu nómina
            o créala como recurrente y esta cifra se llenará sola.
          </Aviso>
        </div>
      )}

      {estado.sinClasificar.gastado > 0 && (
        <p className="mt-3 text-sm text-texto-3">
          Hay <Cifra centimos={estado.sinClasificar.gastado} tamano="pequena" /> de gasto sin
          clasificar, que no entra en ningún sobre.
        </p>
      )}

      {(resumen.sobresPasados > 0 || resumen.sobresEnRiesgo > 0) && (
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          {resumen.sobresPasados > 0 && (
            <Etiqueta>
              {resumen.sobresPasados} sobre{resumen.sobresPasados === 1 ? '' : 's'} pasado
              {resumen.sobresPasados === 1 ? '' : 's'}
            </Etiqueta>
          )}
          {resumen.sobresEnRiesgo > 0 && (
            <Etiqueta>
              {resumen.sobresEnRiesgo} no llega{resumen.sobresEnRiesgo === 1 ? '' : 'n'} a fin de mes
            </Etiqueta>
          )}
        </p>
      )}

      {puedeEditar && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-linea pt-4">
          <Boton variante="secundario" tamano="pequeno" cargando={cerrar.isPending} onClick={() => cerrar.mutate()}>
            {estado.cerrado ? 'Volver a cerrar el mes' : 'Cerrar el mes'}
          </Boton>
          <span className="text-sm text-texto-3">
            Pasa al mes siguiente lo que sobra —y lo que falta— de los sobres que arrastran.
          </span>
        </div>
      )}

      {cerrado && (
        <div className="mt-3">
          <Aviso titulo="Mes cerrado">
            {cerrado.arrastrados === 0
              ? 'No había ningún sobre con arrastre activado, así que no se ha llevado nada.'
              : `Se han arrastrado ${cerrado.arrastrados} sobre${cerrado.arrastrados === 1 ? '' : 's'} a ${nombreDelMes(cerrado.siguiente)}.`}
          </Aviso>
        </div>
      )}
      {cerrar.error instanceof ErrorDeApi && (
        <div className="mt-3">
          <Aviso tono="error" titulo="No se ha cerrado">{cerrar.error.message}</Aviso>
        </div>
      )}
    </Tarjeta>
  )
}

function Dato({ nombre, valor }: { nombre: string; valor: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-texto-3">{nombre}</dt>
      <dd className="cifra">{formatearDinero(valor, { sinDecimales: true })}</dd>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────── Sobres

/** Un sobre «en uso»: tiene asignación, gasto, previsto o arrastre. */
function enUso(sobre: Sobre): boolean {
  return (
    sobre.asignado !== 0 || sobre.gastado !== 0 || sobre.previsto !== 0 || sobre.arrastrado !== 0
  )
}

function Sobres({
  espacio,
  mes,
  estado,
  puedeEditar,
}: {
  espacio: EspacioResumen
  mes: string
  estado: EstadoPresupuesto
  puedeEditar: boolean
}) {
  const clientes = useQueryClient()
  const [propuesta, setPropuesta] = useState<Map<string, number> | null>(null)
  const [verTodas, setVerTodas] = useState(false)

  const pedirPropuesta = useMutation({
    mutationFn: () => api.propuestaPresupuesto(espacio.id, mes),
    onSuccess: (datos) => {
      setPropuesta(
        new Map(datos.propuestas.filter((p) => p.propuesto > 0).map((p) => [p.categoriaId, p.propuesto])),
      )
      // Una propuesta que no se ve no sirve de nada: si toca categorías que
      // estaban ocultas por no usarse, se abre la lista entera.
      setVerTodas(true)
    },
  })

  const aplicar = useMutation({
    mutationFn: () =>
      api.asignarSobres(
        espacio.id,
        mes,
        [...(propuesta ?? new Map())].map(([categoriaId, asignado]) => ({ categoriaId, asignado })),
      ),
    onSuccess: () => {
      setPropuesta(null)
      clientes.invalidateQueries({ queryKey: ['presupuesto', espacio.id, mes] })
    },
  })

  /**
   * Los sobres se agrupan por su categoría padre, y **el padre también es un
   * sobre**: en el juego de categorías por defecto hay gasto y asignación
   * directamente en «Ocio» o en «Vivienda», no solo en sus hijas. La primera
   * versión solo pintaba las hojas, y la pantalla llegó a decir «1 sobre
   * pasado» sin que se pudiera ver cuál.
   */
  const grupos = useMemo(() => {
    const padres = estado.sobres.filter((s) => s.padreId === null)
    const conocidos = new Set(padres.map((p) => p.categoriaId))
    const hijasDe = new Map<string, Sobre[]>()
    const huerfanas: Sobre[] = []

    for (const sobre of estado.sobres) {
      if (sobre.padreId === null) continue
      if (!conocidos.has(sobre.padreId)) {
        huerfanas.push(sobre)
        continue
      }
      hijasDe.set(sobre.padreId, [...(hijasDe.get(sobre.padreId) ?? []), sobre])
    }

    const lista = padres.map((padre) => {
      const hijas = hijasDe.get(padre.categoriaId) ?? []
      // El padre se enseña como fila propia cuando tiene algo suyo, o cuando no
      // tiene hijas y por tanto ES el sobre.
      const filas = hijas.length === 0 || enUso(padre) ? [padre, ...hijas] : hijas
      return { titulo: padre.categoria, clave: padre.categoriaId, filas }
    })
    if (huerfanas.length > 0) lista.push({ titulo: 'Otras', clave: 'otras', filas: huerfanas })
    return lista
  }, [estado.sobres])

  // Con cuarenta categorías a cero, la pantalla es una hoja de cálculo. Se
  // enseñan las que están en uso y las demás quedan a un clic. En un espacio
  // recién creado no hay ninguna en uso, así que se enseñan todas.
  const hayAlgunoEnUso = estado.sobres.some(enUso)
  const mostrarTodas = verTodas || !hayAlgunoEnUso
  const visibles = grupos
    .map((grupo) => ({
      ...grupo,
      filas: mostrarTodas ? grupo.filas : grupo.filas.filter(enUso),
    }))
    .filter((grupo) => grupo.filas.length > 0)
  const ocultas = estado.sobres.length - visibles.reduce((total, g) => total + g.filas.length, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {puedeEditar && (
          <Boton
            variante="secundario"
            tamano="pequeno"
            cargando={pedirPropuesta.isPending}
            onClick={() => pedirPropuesta.mutate()}
          >
            Proponer con mi gasto real
          </Boton>
        )}
        {propuesta && puedeEditar && (
          <>
            <span className="text-sm text-texto-2">
              {propuesta.size} sobre{propuesta.size === 1 ? '' : 's'} con propuesta. Los fijos van
              por el último mes; los demás, por la mediana de los últimos seis.
            </span>
            <Boton tamano="pequeno" cargando={aplicar.isPending} onClick={() => aplicar.mutate()}>
              Aplicar
            </Boton>
            <Boton variante="fantasma" tamano="pequeno" onClick={() => setPropuesta(null)}>
              Descartar
            </Boton>
          </>
        )}
        {hayAlgunoEnUso && (
          <Boton variante="fantasma" tamano="pequeno" onClick={() => setVerTodas(!verTodas)}>
            {mostrarTodas ? 'Ver solo los que uso' : `Ver las ${ocultas} categorías restantes`}
          </Boton>
        )}
      </div>

      {aplicar.error instanceof ErrorDeApi && (
        <Aviso tono="error" titulo="No se ha podido aplicar">{aplicar.error.message}</Aviso>
      )}

      {visibles.map((grupo) => {
        const asignado = grupo.filas.reduce((t, s) => t + s.presupuesto, 0)
        const gastado = grupo.filas.reduce((t, s) => t + s.gastado, 0)
        return (
          <Tarjeta
            key={grupo.clave}
            titulo={grupo.titulo}
            accion={
              grupo.filas.length > 1 && (asignado > 0 || gastado > 0) ? (
                <span className="cifra text-sm text-texto-3">
                  {formatearDinero(gastado, { sinDecimales: true })} de{' '}
                  {formatearDinero(asignado, { sinDecimales: true })}
                </span>
              ) : undefined
            }
          >
            <div className="flex flex-col divide-y divide-linea">
              {grupo.filas.map((sobre) => (
                <FilaSobre
                  key={sobre.categoriaId}
                  espacio={espacio}
                  mes={mes}
                  sobre={sobre}
                  porcentajeDelMes={estado.calendario.porcentajeTranscurrido}
                  propuesto={propuesta?.get(sobre.categoriaId)}
                  puedeEditar={puedeEditar}
                />
              ))}
            </div>
          </Tarjeta>
        )
      })}
    </div>
  )
}

const RITMO: Record<Sobre['ritmo'], { texto: string; clase: string } | null> = {
  holgado: null,
  justo: { texto: 'vas adelantado', clase: 'text-aviso' },
  pasado: { texto: 'te has pasado', clase: 'text-negativo' },
  sin_asignar: null,
}

function FilaSobre({
  espacio,
  mes,
  sobre,
  porcentajeDelMes,
  propuesto,
  puedeEditar,
}: {
  espacio: EspacioResumen
  mes: string
  sobre: Sobre
  porcentajeDelMes: number
  propuesto?: number
  puedeEditar: boolean
}) {
  const clientes = useQueryClient()
  const [texto, setTexto] = useState(() => euros(sobre.asignado))

  // Si el sobre cambia por fuera (una propuesta aplicada, otro dispositivo), el
  // campo tiene que seguirlo en vez de quedarse con lo que se tecleó antes.
  useEffect(() => setTexto(euros(sobre.asignado)), [sobre.asignado])

  const guardar = useMutation({
    mutationFn: (datos: { asignado: number; rollover?: boolean }) =>
      api.asignarSobre(espacio.id, mes, sobre.categoriaId, datos),
    onSuccess: () => clientes.invalidateQueries({ queryKey: ['presupuesto', espacio.id, mes] }),
  })

  function confirmar() {
    const valor = texto.trim() === '' ? 0 : parsearImporte(texto)
    if (valor === null || valor < 0) {
      setTexto(euros(sobre.asignado))
      return
    }
    if (valor !== sobre.asignado) guardar.mutate({ asignado: valor })
  }

  const ritmo = RITMO[sobre.ritmo]
  const vacio = sobre.presupuesto === 0 && sobre.gastado === 0

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-40 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium">{sobre.categoria}</span>
          {sobre.tipo === 'fijo' && <span className="text-xs text-texto-3">fijo</span>}
          {sobre.arrastrado !== 0 && (
            <span className="text-xs text-texto-3">
              {sobre.arrastrado > 0 ? '+' : ''}
              {formatearDinero(sobre.arrastrado, { sinDecimales: true })} del mes pasado
            </span>
          )}
          {ritmo && <span className={`text-xs ${ritmo.clase}`}>{ritmo.texto}</span>}
          {/* Lo previsto se nombra siempre que lo haya: un sobre «con 750 €
              disponibles» y el alquiler a punto de salir no está disponible. */}
          {sobre.previsto > 0 && (
            <span className="text-xs text-texto-3">
              {formatearDinero(sobre.previsto, { sinDecimales: true })} previstos, quedarían{' '}
              {formatearDinero(sobre.disponibleTrasPrevisto, { sinDecimales: true })}
            </span>
          )}
        </div>
        {!vacio && (
          <div className="mt-1.5 max-w-sm">
            <BarraSobre
              gastado={sobre.gastado}
              asignado={sobre.presupuesto}
              porcentajeDelMes={porcentajeDelMes}
            />
          </div>
        )}
      </div>

      <div className="w-28 text-right">
        {sobre.presupuesto > 0 && (
          <>
            <Cifra centimos={sobre.disponible} tamano="pequena" colorear />
            <p className="text-xs text-texto-3">
              {sobre.porDia !== null
                ? `${formatearDinero(sobre.porDia, { sinDecimales: true })}/día`
                : 'disponible'}
            </p>
          </>
        )}
      </div>

      {puedeEditar && (
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`asignado-${sobre.categoriaId}`}>
            Asignado a {sobre.categoria}
          </label>
          <input
            id={`asignado-${sobre.categoriaId}`}
            inputMode="decimal"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="0"
            className={`h-9 w-24 rounded-campo border bg-sup-2 px-2.5 text-right tabular-nums text-texto-1 ${
              propuesto !== undefined ? 'border-marca' : 'border-linea'
            }`}
          />
          <button
            type="button"
            aria-pressed={sobre.rollover}
            title={
              sobre.rollover
                ? 'Lo que sobre (o falte) pasa al mes siguiente'
                : 'Este sobre empieza de cero cada mes'
            }
            onClick={() => guardar.mutate({ asignado: sobre.asignado, rollover: !sobre.rollover })}
            className={`h-9 rounded-campo px-2 text-xs ${
              sobre.rollover ? 'bg-marca-tenue text-marca' : 'bg-sup-3 text-texto-3'
            }`}
          >
            arrastra
          </button>
        </div>
      )}

      {propuesto !== undefined && propuesto !== sobre.asignado && (
        <p className="w-full text-xs text-marca">
          Propuesta: {formatearDinero(propuesto, { sinDecimales: true })}
        </p>
      )}
    </div>
  )
}

function euros(centimos: number): string {
  return centimos === 0 ? '' : String(centimos / 100).replace('.', ',')
}
