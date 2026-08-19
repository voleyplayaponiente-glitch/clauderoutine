import { formatearDinero, parsearImporte } from '@norte/dominio'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Aviso, Boton, Campo, Cifra, Esqueleto, EstadoVacio, Etiqueta, Tarjeta } from '../componentes/ui.js'
import { api, ErrorDeApi, type Cartera, type EspacioResumen, type PosicionCartera } from '../lib/api.js'

/**
 * Inversiones.
 *
 * Norte **no llama a ninguna API de cotizaciones**: los precios los pone el
 * usuario, y por eso cada uno se enseña con la fecha en que se valoró. Un
 * número sin fecha en una pantalla de inversiones parece actual aunque tenga
 * medio año, y esa es la clase de detalle que hace que alguien tome una
 * decisión con datos viejos creyendo que son de hoy.
 */

const CLASES: { valor: string; texto: string }[] = [
  { valor: 'renta_variable', texto: 'Renta variable' },
  { valor: 'renta_fija', texto: 'Renta fija' },
  { valor: 'monetario', texto: 'Monetario' },
  { valor: 'inmobiliario', texto: 'Inmobiliario' },
  { valor: 'materias_primas', texto: 'Materias primas' },
  { valor: 'cripto', texto: 'Cripto' },
  { valor: 'otros', texto: 'Otros' },
]
const NOMBRE_CLASE: Record<string, string> = Object.fromEntries(CLASES.map((c) => [c.valor, c.texto]))

export function Inversiones({ espacio }: { espacio: EspacioResumen }) {
  const puedeEditar = espacio.rol !== 'lector'
  const cartera = useQuery({ queryKey: ['cartera', espacio.id], queryFn: () => api.cartera(espacio.id) })

  if (cartera.isLoading) return <Esqueleto className="mx-auto mt-8 h-64 max-w-5xl" />
  if (cartera.error instanceof ErrorDeApi) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-8">
        <Aviso tono="error" titulo="No se ha podido cargar">{cartera.error.message}</Aviso>
      </div>
    )
  }
  const datos = cartera.data!

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">Inversiones</h1>
        <p className="text-texto-2">{espacio.nombre}</p>
      </header>

      {datos.cuentas.length === 0 ? (
        <EstadoVacio
          titulo="Sin cartera todavía"
          texto="Crea una cuenta de inversión, añade lo que tienes dentro y Norte calcula el coste medio, la plusvalía y tu rentabilidad real."
          accion={puedeEditar ? <NuevaCuenta espacio={espacio} /> : undefined}
        />
      ) : (
        <>
          <Resumen cartera={datos} />
          <Reparto espacio={espacio} cartera={datos} puedeEditar={puedeEditar} />
          {datos.cuentas.map((cuenta) => (
            <Tarjeta
              key={cuenta.id}
              titulo={cuenta.nombre}
              accion={<span className="cifra text-sm text-texto-3">{formatearDinero(cuenta.valor)}</span>}
            >
              {cuenta.posiciones.length === 0 ? (
                <p className="text-sm text-texto-2">Esta cuenta todavía no tiene posiciones.</p>
              ) : (
                <div className="flex flex-col divide-y divide-linea">
                  {cuenta.posiciones.map((posicion) => (
                    <FilaPosicion
                      key={posicion.id}
                      espacio={espacio}
                      posicion={posicion}
                      puedeEditar={puedeEditar}
                    />
                  ))}
                </div>
              )}
              {puedeEditar && <NuevaPosicion espacio={espacio} cuentaId={cuenta.id} />}
            </Tarjeta>
          ))}
          {puedeEditar && <NuevaCuenta espacio={espacio} />}
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────── Resumen

function Resumen({ cartera }: { cartera: Cartera }) {
  const { total, tir } = cartera
  return (
    <Tarjeta>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-texto-3">Valor de la cartera</p>
          <p className="cifra-heroe text-4xl font-semibold">{formatearDinero(total.valor)}</p>
          <p className="mt-1 text-sm text-texto-2">
            Coste {formatearDinero(total.coste, { sinDecimales: true })} ·{' '}
            <span className={total.plusvaliaLatente >= 0 ? 'text-positivo' : 'text-negativo'}>
              {formatearDinero(total.plusvaliaLatente, { conSigno: true, sinDecimales: true })} sin
              vender
            </span>
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-texto-3">TIR anual</dt>
            <dd className="cifra text-lg">
              {tir === null ? (
                <span className="text-texto-3">—</span>
              ) : (
                `${tir.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-texto-3">Dividendos</dt>
            <dd className="cifra text-lg">{formatearDinero(total.dividendos, { sinDecimales: true })}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-texto-3">Ya realizado</dt>
            <dd className="cifra text-lg">
              {formatearDinero(total.plusvaliaRealizada, { conSigno: true, sinDecimales: true })}
            </dd>
          </div>
        </dl>
      </div>

      {/* Las dos rentabilidades responden preguntas distintas, y decir cuál es
          cuál importa tanto como el número. */}
      <p className="mt-4 border-t border-linea pt-4 text-sm leading-relaxed text-texto-2">
        La <strong>TIR</strong> mide cómo te ha ido <em>a ti</em>: tiene en cuenta cuándo metiste
        cada euro.{' '}
        {tir === null && 'Todavía no se puede calcular: hace falta que la cartera esté valorada. '}
        Para comparar con un índice hace falta la rentabilidad ponderada por tiempo, y esa necesita
        valoraciones periódicas de la cartera que Norte aún no guarda. Prefiero decírtelo a darte un
        número que parece comparable y no lo es.
      </p>
    </Tarjeta>
  )
}

// ──────────────────────────────────────────────────── Reparto y objetivos

function Reparto({
  espacio,
  cartera,
  puedeEditar,
}: {
  espacio: EspacioResumen
  cartera: Cartera
  puedeEditar: boolean
}) {
  const clientes = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [objetivos, setObjetivos] = useState<Record<string, string>>(() =>
    Object.fromEntries(cartera.desvios.map((d) => [d.clase, String(d.objetivo)])),
  )

  const guardar = useMutation({
    mutationFn: () =>
      api.guardarObjetivos(
        espacio.id,
        Object.entries(objetivos)
          .map(([clase, valor]) => ({ clase, objetivo: Number(valor.replace(',', '.')) || 0, umbral: 5 }))
          .filter((o) => o.objetivo > 0),
      ),
    onSuccess: () => {
      setEditando(false)
      clientes.invalidateQueries({ queryKey: ['cartera', espacio.id] })
    },
  })

  const fuera = cartera.desvios.filter((d) => d.fueraDeRango)

  return (
    <Tarjeta
      titulo="Reparto de la cartera"
      accion={
        puedeEditar ? (
          <Boton variante="fantasma" tamano="pequeno" onClick={() => setEditando(!editando)}>
            {editando ? 'Cerrar' : 'Asignación objetivo'}
          </Boton>
        ) : undefined
      }
    >
      {cartera.reparto.partes.length === 0 ? (
        <p className="text-sm text-texto-2">
          Cuando pongas precio a tus posiciones aparecerá aquí cómo está repartida la cartera.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {cartera.reparto.partes.map((parte) => (
            <div key={parte.clase}>
              <div className="flex justify-between text-sm">
                <span>{NOMBRE_CLASE[parte.clase] ?? parte.clase}</span>
                <span className="cifra text-texto-2">
                  {parte.porcentaje.toLocaleString('es-ES', { maximumFractionDigits: 1 })} % ·{' '}
                  {formatearDinero(parte.valor, { sinDecimales: true })}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-sup-3">
                <div className="h-full rounded-full bg-marca" style={{ width: `${parte.porcentaje}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {fuera.length > 0 && (
        <div className="mt-4">
          <Aviso tono="atencion" titulo="La cartera se ha desviado del objetivo">
            <ul className="flex flex-col gap-1">
              {fuera.map((desvio) => (
                <li key={desvio.clase}>
                  <strong>{NOMBRE_CLASE[desvio.clase] ?? desvio.clase}</strong>: estás en el{' '}
                  {desvio.actual.toLocaleString('es-ES', { maximumFractionDigits: 1 })} % contra un
                  objetivo del {desvio.objetivo} %.{' '}
                  {desvio.ajuste > 0
                    ? `Comprarías ${formatearDinero(desvio.ajuste, { sinDecimales: true })}`
                    : `Venderías ${formatearDinero(-desvio.ajuste, { sinDecimales: true })}`}{' '}
                  para volver.
                </li>
              ))}
            </ul>
          </Aviso>
          <p className="mt-2 text-xs leading-relaxed text-texto-3">
            El umbral son 5 puntos porcentuales, no un 5 % relativo: rebalancear por cualquier
            desvío pequeño solo genera comisiones e impuestos.
          </p>
        </div>
      )}

      {editando && (
        <div className="mt-4 border-t border-linea pt-4">
          <p className="mb-3 text-sm text-texto-2">
            Qué parte de la cartera quieres en cada clase. Deja en cero las que no uses.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {CLASES.map((clase) => (
              <Campo
                key={clase.valor}
                etiqueta={`${clase.texto} %`}
                value={objetivos[clase.valor] ?? ''}
                onChange={(e) => setObjetivos({ ...objetivos, [clase.valor]: e.target.value })}
              />
            ))}
          </div>
          <div className="mt-3">
            <Boton tamano="pequeno" cargando={guardar.isPending} onClick={() => guardar.mutate()}>
              Guardar objetivo
            </Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  )
}

// ──────────────────────────────────────────────────────────── Posiciones

function FilaPosicion({
  espacio,
  posicion,
  puedeEditar,
}: {
  espacio: EspacioResumen
  posicion: PosicionCartera
  puedeEditar: boolean
}) {
  const clientes = useQueryClient()
  const [precio, setPrecio] = useState(() => (posicion.ultimoPrecio ? String(posicion.ultimoPrecio / 100).replace('.', ',') : ''))
  const [abierto, setAbierto] = useState(false)

  const guardarPrecio = useMutation({
    mutationFn: () => {
      const valor = parsearImporte(precio)
      if (valor === null || valor < 0) throw new ErrorDeApi(0, 'datos_invalidos', 'Pon un precio válido.')
      return api.ponerPrecio(espacio.id, posicion.id, { ultimoPrecio: valor })
    },
    onSuccess: () => clientes.invalidateQueries({ queryKey: ['cartera', espacio.id] }),
  })

  const borrar = useMutation({
    mutationFn: () => api.borrarPosicion(espacio.id, posicion.id),
    onSuccess: () => clientes.invalidateQueries({ queryKey: ['cartera', espacio.id] }),
  })

  const viejo =
    posicion.fechaValoracion !== null &&
    Date.now() - new Date(posicion.fechaValoracion).getTime() > 60 * 86_400_000

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-40 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium">{posicion.nombre}</span>
            <Etiqueta>{NOMBRE_CLASE[posicion.clase] ?? posicion.clase}</Etiqueta>
            {posicion.isin && <span className="text-xs text-texto-3">{posicion.isin}</span>}
          </div>
          <p className="text-sm text-texto-3">
            {posicion.participaciones.toLocaleString('es-ES', { maximumFractionDigits: 4 })}{' '}
            participaciones · coste medio {formatearDinero(posicion.costeMedio)}
          </p>
        </div>

        <div className="w-32 text-right">
          {posicion.ultimoPrecio === null ? (
            <span className="text-sm text-texto-3">sin valorar</span>
          ) : (
            <>
              <Cifra centimos={posicion.valor} tamano="pequena" />
              <p
                className={`text-xs ${
                  posicion.plusvaliaLatente >= 0 ? 'text-positivo' : 'text-negativo'
                }`}
              >
                {formatearDinero(posicion.plusvaliaLatente, { conSigno: true, sinDecimales: true })}
                {posicion.rentabilidad !== null &&
                  ` (${posicion.rentabilidad.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %)`}
              </p>
            </>
          )}
        </div>

        {puedeEditar && (
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              onBlur={() => precio.trim() !== '' && guardarPrecio.mutate()}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              placeholder="precio"
              aria-label={`Precio de ${posicion.nombre}`}
              className="h-9 w-24 rounded-campo border border-linea bg-sup-2 px-2.5 text-right tabular-nums text-texto-1"
            />
            <Boton variante="fantasma" tamano="pequeno" onClick={() => setAbierto(!abierto)}>
              {abierto ? 'Cerrar' : 'Apuntar'}
            </Boton>
          </div>
        )}
      </div>

      {/* Un precio sin fecha parece de hoy aunque sea de hace medio año. */}
      {posicion.fechaValoracion && (
        <p className={`text-xs ${viejo ? 'text-aviso' : 'text-texto-3'}`}>
          Valorada el {new Date(posicion.fechaValoracion).toLocaleDateString('es-ES')}
          {viejo && ' — hace más de dos meses, quizá convenga actualizarlo'}
        </p>
      )}

      {abierto && (
        <NuevoMovimiento
          espacio={espacio}
          posicion={posicion}
          alBorrar={() => borrar.mutate()}
          borrando={borrar.isPending}
        />
      )}
    </div>
  )
}

function NuevoMovimiento({
  espacio,
  posicion,
  alBorrar,
  borrando,
}: {
  espacio: EspacioResumen
  posicion: PosicionCartera
  alBorrar: () => void
  borrando: boolean
}) {
  const clientes = useQueryClient()
  const [datos, setDatos] = useState({
    tipo: 'compra',
    fecha: new Date().toISOString().slice(0, 10),
    participaciones: '',
    importe: '',
    comision: '',
  })

  const apuntar = useMutation({
    mutationFn: () =>
      api.apuntarInversion(espacio.id, posicion.id, {
        tipo: datos.tipo,
        fecha: datos.fecha,
        participaciones: Number(datos.participaciones.replace(',', '.')) || 0,
        importe: parsearImporte(datos.importe) ?? 0,
        comision: parsearImporte(datos.comision) ?? 0,
      }),
    onSuccess: () => {
      setDatos({ ...datos, participaciones: '', importe: '', comision: '' })
      clientes.invalidateQueries({ queryKey: ['cartera', espacio.id] })
    },
  })

  return (
    <div className="rounded-campo bg-sup-2 p-3">
      <div className="grid gap-3 sm:grid-cols-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto-2">Qué</span>
          <select
            value={datos.tipo}
            onChange={(e) => setDatos({ ...datos, tipo: e.target.value })}
            className="h-11 rounded-campo border border-linea bg-sup-1 px-3 text-texto-1"
          >
            <option value="compra">Compra</option>
            <option value="venta">Venta</option>
            <option value="dividendo">Dividendo</option>
            <option value="comision">Comisión</option>
            <option value="split">Split</option>
          </select>
        </label>
        <Campo etiqueta="Fecha" type="date" value={datos.fecha} onChange={(e) => setDatos({ ...datos, fecha: e.target.value })} />
        <Campo
          etiqueta="Participaciones"
          value={datos.participaciones}
          onChange={(e) => setDatos({ ...datos, participaciones: e.target.value })}
          ayuda={datos.tipo === 'split' ? 'El factor: 2 en un 2x1' : undefined}
        />
        <Campo etiqueta="Importe" value={datos.importe} onChange={(e) => setDatos({ ...datos, importe: e.target.value })} />
        <Campo etiqueta="Comisión" value={datos.comision} onChange={(e) => setDatos({ ...datos, comision: e.target.value })} />
      </div>
      {apuntar.error instanceof ErrorDeApi && (
        <div className="mt-3">
          <Aviso tono="error" titulo="No se ha apuntado">{apuntar.error.message}</Aviso>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Boton tamano="pequeno" cargando={apuntar.isPending} onClick={() => apuntar.mutate()}>
          Apuntar
        </Boton>
        <Boton variante="fantasma" tamano="pequeno" cargando={borrando} onClick={alBorrar}>
          Borrar la posición
        </Boton>
        {posicion.movimientos.length > 0 && (
          <span className="text-sm text-texto-3">
            {posicion.movimientos.length} movimiento{posicion.movimientos.length === 1 ? '' : 's'}{' '}
            apuntado{posicion.movimientos.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Hacienda liquida acciones y fondos por FIFO. El coste medio es lo que
          enseña el bróker, pero no siempre es la plusvalía fiscal. */}
      {posicion.plusvaliaRealizada !== 0 && (
        <p className="mt-3 text-xs leading-relaxed text-texto-3">
          La plusvalía realizada está calculada con coste medio, que es lo que enseña tu bróker.
          Hacienda liquida acciones y fondos por FIFO, así que para la declaración la cifra puede
          no ser esta.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────── Altas

function NuevaCuenta({ espacio }: { espacio: EspacioResumen }) {
  const clientes = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [broker, setBroker] = useState('')

  const crear = useMutation({
    mutationFn: () => api.crearCuentaInversion(espacio.id, { nombre: nombre.trim(), broker: broker.trim() || null }),
    onSuccess: () => {
      setNombre('')
      setBroker('')
      clientes.invalidateQueries({ queryKey: ['cartera', espacio.id] })
    },
  })

  return (
    <Tarjeta titulo="Nueva cuenta de inversión">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-45 flex-1">
          <Campo etiqueta="Nombre" placeholder="Cartera indexada" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="min-w-40 flex-1">
          <Campo etiqueta="Bróker" placeholder="Indexa, MyInvestor…" value={broker} onChange={(e) => setBroker(e.target.value)} />
        </div>
        <Boton cargando={crear.isPending} disabled={!nombre.trim()} onClick={() => crear.mutate()}>
          Crear
        </Boton>
      </div>
    </Tarjeta>
  )
}

function NuevaPosicion({ espacio, cuentaId }: { espacio: EspacioResumen; cuentaId: string }) {
  const clientes = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [datos, setDatos] = useState({ nombre: '', isin: '', clase: 'renta_variable' })

  const crear = useMutation({
    mutationFn: () =>
      api.crearPosicion(espacio.id, cuentaId, {
        nombre: datos.nombre.trim(),
        isin: datos.isin.trim() || null,
        clase: datos.clase,
      }),
    onSuccess: () => {
      setAbierto(false)
      setDatos({ ...datos, nombre: '', isin: '' })
      clientes.invalidateQueries({ queryKey: ['cartera', espacio.id] })
    },
  })

  if (!abierto) {
    return (
      <div className="mt-4">
        <Boton variante="secundario" tamano="pequeno" onClick={() => setAbierto(true)}>
          Añadir posición
        </Boton>
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-linea pt-4">
      <div className="min-w-45 flex-1">
        <Campo etiqueta="Nombre" placeholder="MSCI World" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
      </div>
      <div className="w-40">
        <Campo etiqueta="ISIN" placeholder="IE00B4L5Y983" value={datos.isin} onChange={(e) => setDatos({ ...datos, isin: e.target.value })} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-texto-2">Clase</span>
        <select
          value={datos.clase}
          onChange={(e) => setDatos({ ...datos, clase: e.target.value })}
          className="h-11 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
        >
          {CLASES.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.texto}
            </option>
          ))}
        </select>
      </label>
      <Boton tamano="pequeno" cargando={crear.isPending} disabled={!datos.nombre.trim()} onClick={() => crear.mutate()}>
        Crear
      </Boton>
      <Boton variante="fantasma" tamano="pequeno" onClick={() => setAbierto(false)}>
        Cancelar
      </Boton>
    </div>
  )
}
