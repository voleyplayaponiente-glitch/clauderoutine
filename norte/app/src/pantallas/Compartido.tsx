import { formatearDinero, nombreDeTipoReparto, parsearImporte } from '@norte/dominio'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Aviso,
  Boton,
  Campo,
  Cifra,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Tarjeta,
} from '../componentes/ui.js'
import {
  api,
  ErrorDeApi,
  type CuentaCompartida,
  type EspacioResumen,
  type MiembroDelEspacio,
  type Negocio,
  type RepartoGuardado,
  type TipoReparto,
} from '../lib/api.js'

/**
 * Espacios compartidos.
 *
 * La pantalla gira alrededor de **una frase**: quién le tiene que pasar cuánto
 * a quién. Todo lo demás —los gastos, los saldos, las reglas— está para
 * justificar esa frase, no al revés. Una aplicación de gastos compartidos que
 * te obliga a interpretar una tabla ha fallado en lo único que le pedías.
 *
 * Y una regla de honestidad que se nota en tres sitios de este fichero: cuando
 * un gasto no se puede repartir —no tiene regla, o llega después del cierre—
 * **se dice y se enseña cuál es**. Tragárselo dejaría una cuenta que cuadra
 * pero que no es la verdad.
 */

const TIPOS: { valor: TipoReparto; texto: string; explica: string }[] = [
  { valor: 'mitades', texto: 'A partes iguales', explica: 'Cada uno paga lo mismo.' },
  {
    valor: 'proporcional_ingresos',
    texto: 'En proporción a los ingresos',
    explica: 'Quien más ingresa, más pone. Se calcula con los ingresos anotados de cada mes.',
  },
  { valor: 'porcentaje_manual', texto: 'Por porcentajes', explica: 'Los pones tú y suman 100 %.' },
  {
    valor: 'importe_fijo',
    texto: 'Con un importe fijo',
    explica: 'Alguien pone una cantidad fija y el resto se lo reparten los demás.',
  },
]

export function Compartido({ espacio }: { espacio: EspacioResumen }) {
  const puedeEditar = espacio.rol !== 'lector'
  const cuenta = useQuery({
    queryKey: ['cuenta-compartida', espacio.id],
    queryFn: () => api.cuentaCompartida(espacio.id),
  })
  const repartos = useQuery({
    queryKey: ['repartos', espacio.id],
    queryFn: () => api.repartos(espacio.id),
  })

  if (cuenta.isLoading || repartos.isLoading) {
    return <Esqueleto className="mx-auto mt-8 h-64 max-w-5xl" />
  }
  const error = cuenta.error ?? repartos.error
  if (error instanceof ErrorDeApi) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-8">
        <Aviso tono="error" titulo="No se ha podido cargar">
          {error.message}
        </Aviso>
      </div>
    )
  }

  const datos = cuenta.data!
  const miembros = repartos.data!.miembros
  const reglas = repartos.data!.repartos

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">Compartido</h1>
        <p className="text-texto-2">{espacio.nombre}</p>
      </header>

      {/* En un negocio, lo primero es la sociedad: quién ha puesto capital y a
          quién le toca qué. Los gastos compartidos existen igual, pero son lo
          accesorio. En un espacio de pareja no hay sociedad y manda la cuenta. */}
      {espacio.tipo === 'negocio' && <ModoNegocio espacio={espacio} miembros={miembros} />}

      {miembros.length < 2 ? (
        <EstadoVacio
          titulo="Todavía sois uno"
          texto="Invita a alguien desde la pantalla de inicio y aquí aparecerá quién le debe qué a quién."
        />
      ) : (
        <>
          <Cierre cuenta={datos} espacio={espacio} puedeEditar={puedeEditar} />
          <Saldos cuenta={datos} />
          {datos.sinReparto.length > 0 && <SinReparto cuenta={datos} hayReglas={reglas.length > 0} />}
          {datos.tardios.length > 0 && <Tardios cuenta={datos} />}
          <Gastos cuenta={datos} />
          {datos.ingresosUsados.length > 0 && <IngresosUsados cuenta={datos} />}
          <Reglas
            espacio={espacio}
            reglas={reglas}
            miembros={miembros}
            puedeEditar={puedeEditar}
          />
          <Historial espacio={espacio} puedeEditar={puedeEditar} />
        </>
      )}
    </div>
  )
}

/** La frase. Es lo primero y lo más grande de la pantalla. */
function Cierre({
  cuenta,
  espacio,
  puedeEditar,
}: {
  cuenta: CuentaCompartida
  espacio: EspacioResumen
  puedeEditar: boolean
}) {
  const clienteConsultas = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const cerrar = useMutation({
    mutationFn: () => api.cerrarPeriodo(espacio.id),
    onSuccess: () => {
      setError(null)
      clienteConsultas.invalidateQueries({ queryKey: ['cuenta-compartida', espacio.id] })
      clienteConsultas.invalidateQueries({ queryKey: ['liquidaciones', espacio.id] })
    },
    onError: (fallo) => setError(fallo instanceof ErrorDeApi ? fallo.message : 'No se ha podido cerrar.'),
  })

  return (
    <Tarjeta>
      {cuenta.pagos.length === 0 ? (
        <div>
          <p className="text-2xl font-semibold tracking-[-0.02em]">Estáis en paz.</p>
          <p className="mt-1 text-sm text-texto-2">
            {cuenta.total === 0
              ? 'Todavía no hay gastos compartidos en este periodo.'
              : `${formatearDinero(cuenta.total)} repartidos y ningún saldo pendiente.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            {cuenta.pagos.map((pago) => (
              <p
                key={`${pago.deUsuarioId}-${pago.aUsuarioId}`}
                className="text-2xl font-semibold tracking-[-0.02em]"
              >
                {pago.deNombre} le pasa{' '}
                <span className="cifra-heroe">
                  {formatearDinero(pago.importe)}
                </span>{' '}
                a {pago.aNombre}
              </p>
            ))}
            <p className="mt-2 text-sm text-texto-2">
              {cuenta.pagos.length === 1
                ? 'Con una sola transferencia queda todo saldado.'
                : `Con ${cuenta.pagos.length} transferencias queda todo saldado: es el mínimo posible.`}{' '}
              {formatearDinero(cuenta.total)} repartidos
              {cuenta.desde ? ` desde el ${dia(cuenta.desde)}` : ''}.
            </p>
          </div>
          {puedeEditar && (
            <div className="flex flex-wrap items-center gap-3">
              <Boton onClick={() => cerrar.mutate()} cargando={cerrar.isPending}>
                Cerrar el periodo
              </Boton>
              <span className="text-xs text-texto-3">
                Congela estas cifras. Los gastos siguen donde están; lo que se guarda es el acuerdo.
              </span>
            </div>
          )}
          {error && <Aviso tono="error">{error}</Aviso>}
        </div>
      )}
    </Tarjeta>
  )
}

function Saldos({ cuenta }: { cuenta: CuentaCompartida }) {
  if (cuenta.saldos.every((saldo) => saldo.pagado === 0 && saldo.debido === 0)) return null

  return (
    <Tarjeta titulo="Quién ha puesto qué">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-linea text-left text-xs uppercase tracking-wide text-texto-3">
            <th scope="col" className="pb-2 font-medium">Persona</th>
            <th scope="col" className="pb-2 text-right font-medium">Ha puesto</th>
            <th scope="col" className="pb-2 text-right font-medium">Le tocaba</th>
            <th scope="col" className="pb-2 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {cuenta.saldos.map((saldo) => (
            <tr key={saldo.usuarioId} className="border-b border-linea/60 last:border-0">
              <th scope="row" className="py-2 text-left font-normal">{saldo.nombre}</th>
              <td className="py-2 text-right"><Cifra centimos={saldo.pagado} /></td>
              <td className="py-2 text-right text-texto-2"><Cifra centimos={saldo.debido} /></td>
              <td className="py-2 text-right font-medium">
                <Cifra centimos={saldo.saldo} colorear conSigno />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Tarjeta>
  )
}

function SinReparto({ cuenta, hayReglas }: { cuenta: CuentaCompartida; hayReglas: boolean }) {
  return (
    <Aviso tono="atencion" titulo={`${cuenta.sinReparto.length} gasto${cuenta.sinReparto.length === 1 ? '' : 's'} sin regla de reparto`}>
      <p>
        {hayReglas
          ? 'Hay más de una regla y estos gastos no tienen ninguna asignada, así que no entran en la cuenta. Elige la regla de cada uno en Movimientos.'
          : 'Todavía no hay ninguna regla de reparto, así que no se puede saber a quién le toca qué. Crea una abajo.'}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {cuenta.sinReparto.map((gasto) => (
          <li key={gasto.id} className="flex justify-between gap-3">
            <span className="truncate">{dia(gasto.fecha)} · {gasto.concepto}</span>
            <Cifra centimos={gasto.importe} />
          </li>
        ))}
      </ul>
    </Aviso>
  )
}

function Tardios({ cuenta }: { cuenta: CuentaCompartida }) {
  return (
    <Aviso tono="atencion" titulo="Gastos anteriores al último cierre">
      <p>
        Tienen fecha de un periodo ya saldado, así que no entran en esta cuenta. Si de verdad hay
        que cobrarlos, lo honesto es apuntarlos como un gasto nuevo con la fecha de hoy.
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {cuenta.tardios.map((gasto) => (
          <li key={gasto.id} className="flex justify-between gap-3">
            <span className="truncate">{dia(gasto.fecha)} · {gasto.concepto}</span>
            <Cifra centimos={gasto.importe} />
          </li>
        ))}
      </ul>
    </Aviso>
  )
}

function Gastos({ cuenta }: { cuenta: CuentaCompartida }) {
  if (cuenta.gastos.length === 0) return null

  return (
    <Tarjeta titulo={`Los ${cuenta.gastos.length} gastos de este periodo`}>
      <ul className="flex flex-col divide-y divide-linea/60">
        {cuenta.gastos.map((gasto) => (
          <li key={gasto.id} className="flex items-center gap-3 py-2">
            <span className="w-16 shrink-0 text-sm text-texto-3">{dia(gasto.fecha)}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{gasto.concepto}</span>
            <span className="shrink-0 text-sm text-texto-2">{gasto.pagadoPorNombre}</span>
            <span className="shrink-0 text-sm"><Cifra centimos={gasto.importe} /></span>
          </li>
        ))}
      </ul>
      {/* Sin nombre de cuenta a propósito: compartir un gasto no obliga a
          enseñar de qué cuenta salió. */}
      <p className="mt-3 text-xs text-texto-3">
        Un gasto entra aquí cuando está marcado como compartido en Movimientos.
      </p>
    </Tarjeta>
  )
}

/**
 * De dónde salen las proporciones. Repartir «según los ingresos» sin decir con
 * qué ingresos se ha repartido es pedir que alguien se fíe de una cifra que no
 * puede comprobar — y el que sale perdiendo nunca se fía.
 */
function IngresosUsados({ cuenta }: { cuenta: CuentaCompartida }) {
  return (
    <Tarjeta titulo="Con qué ingresos se ha repartido">
      <ul className="flex flex-col divide-y divide-linea/60">
        {cuenta.ingresosUsados.map((mes) => (
          <li key={mes.mes} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
            <span className="w-28 shrink-0 text-sm text-texto-3">{nombreDeMes(mes.mes)}</span>
            {mes.personas.map((persona) => (
              <span key={persona.usuarioId} className="text-sm">
                {persona.nombre}{' '}
                <span className={persona.ingreso === 0 ? 'text-negativo' : 'text-texto-2'}>
                  {formatearDinero(persona.ingreso)}
                </span>
              </span>
            ))}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-texto-3">
        Son los ingresos <strong>anotados en Norte</strong> ese mes, en las cuentas de cada uno.
        Un sueldo que no pasa por aquí no cuenta: si alguna cifra sale a cero, apunta el ingreso o
        cambia la regla a porcentajes.
      </p>
    </Tarjeta>
  )
}

function Reglas({
  espacio,
  reglas,
  miembros,
  puedeEditar,
}: {
  espacio: EspacioResumen
  reglas: RepartoGuardado[]
  miembros: MiembroDelEspacio[]
  puedeEditar: boolean
}) {
  const clienteConsultas = useQueryClient()
  const [abierto, setAbierto] = useState(false)

  const borrar = useMutation({
    mutationFn: (id: string) => api.borrarReparto(espacio.id, id),
    onSuccess: () => {
      clienteConsultas.invalidateQueries({ queryKey: ['repartos', espacio.id] })
      clienteConsultas.invalidateQueries({ queryKey: ['cuenta-compartida', espacio.id] })
    },
  })

  return (
    <Tarjeta
      titulo="Reglas de reparto"
      accion={
        puedeEditar ? (
          <Boton variante="secundario" tamano="pequeno" onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Cancelar' : 'Nueva regla'}
          </Boton>
        ) : undefined
      }
    >
      {reglas.length === 0 && !abierto && (
        <p className="text-sm text-texto-2">
          Sin reglas, un gasto compartido no sabe a quién repartirse. Con una sola, se aplica a todo.
        </p>
      )}

      {reglas.length > 0 && (
        <ul className="flex flex-col divide-y divide-linea/60">
          {reglas.map((regla) => (
            <li key={regla.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{regla.nombre}</p>
                <p className="text-sm text-texto-2">
                  {nombreDeTipoReparto(regla.tipo)} ·{' '}
                  {regla.partes
                    .map((parte) => {
                      const quien = miembros.find((m) => m.usuarioId === parte.usuarioId)?.nombre ?? '—'
                      if (regla.tipo === 'porcentaje_manual') {
                        return `${quien} ${parte.porcentaje.toLocaleString('es-ES')} %`
                      }
                      if (regla.tipo === 'importe_fijo' && parte.importeFijo > 0) {
                        return `${quien} ${formatearDinero(parte.importeFijo)}`
                      }
                      return quien
                    })
                    .join(' · ')}
                </p>
              </div>
              {puedeEditar && (
                <Boton
                  variante="fantasma"
                  tamano="pequeno"
                  cargando={borrar.isPending}
                  onClick={() => borrar.mutate(regla.id)}
                >
                  Quitar
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <NuevaRegla
          espacio={espacio}
          miembros={miembros}
          alGuardar={() => setAbierto(false)}
        />
      )}
    </Tarjeta>
  )
}

function NuevaRegla({
  espacio,
  miembros,
  alGuardar,
}: {
  espacio: EspacioResumen
  miembros: MiembroDelEspacio[]
  alGuardar: () => void
}) {
  const clienteConsultas = useQueryClient()
  const [nombre, setNombre] = useState('Gastos comunes')
  const [tipo, setTipo] = useState<TipoReparto>('mitades')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const crear = useMutation({
    mutationFn: () =>
      api.crearReparto(espacio.id, {
        nombre,
        tipo,
        partes: miembros.map((miembro) => ({
          usuarioId: miembro.usuarioId,
          porcentaje:
            tipo === 'porcentaje_manual'
              ? Number((valores[miembro.usuarioId] ?? '0').replace(',', '.')) || 0
              : undefined,
          importeFijo:
            tipo === 'importe_fijo'
              ? (parsearImporte(valores[miembro.usuarioId] ?? '') ?? null)
              : undefined,
        })),
      }),
    onSuccess: () => {
      clienteConsultas.invalidateQueries({ queryKey: ['repartos', espacio.id] })
      clienteConsultas.invalidateQueries({ queryKey: ['cuenta-compartida', espacio.id] })
      alGuardar()
    },
    onError: (fallo) =>
      setError(fallo instanceof ErrorDeApi ? fallo.message : 'No se ha podido crear la regla.'),
  })

  const explicacion = TIPOS.find((t) => t.valor === tipo)!.explica

  return (
    <form
      className="mt-4 flex flex-col gap-3 border-t border-linea pt-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        setError(null)
        crear.mutate()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Cómo se reparte</span>
          <select
            className="rounded-campo border border-linea bg-sup-1 px-3 py-2 text-sm"
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value as TipoReparto)}
          >
            {TIPOS.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.texto}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-sm text-texto-2">{explicacion}</p>

      {(tipo === 'porcentaje_manual' || tipo === 'importe_fijo') && (
        <div className="grid gap-3 sm:grid-cols-2">
          {miembros.map((miembro) => (
            <Campo
              key={miembro.usuarioId}
              etiqueta={`${miembro.nombre} ${tipo === 'porcentaje_manual' ? '(%)' : '(€, vacío = el resto)'}`}
              value={valores[miembro.usuarioId] ?? ''}
              onChange={(e) =>
                setValores((previos) => ({ ...previos, [miembro.usuarioId]: e.target.value }))
              }
            />
          ))}
        </div>
      )}

      {error && <Aviso tono="error">{error}</Aviso>}

      <div>
        <Boton type="submit" cargando={crear.isPending}>
          Guardar la regla
        </Boton>
      </div>
    </form>
  )
}

function Historial({ espacio, puedeEditar }: { espacio: EspacioResumen; puedeEditar: boolean }) {
  const clienteConsultas = useQueryClient()
  const historial = useQuery({
    queryKey: ['liquidaciones', espacio.id],
    queryFn: () => api.liquidaciones(espacio.id),
  })

  const saldar = useMutation({
    mutationFn: (id: string) => api.saldarLiquidacion(espacio.id, id),
    onSuccess: () => {
      clienteConsultas.invalidateQueries({ queryKey: ['liquidaciones', espacio.id] })
      clienteConsultas.invalidateQueries({ queryKey: ['cuenta-compartida', espacio.id] })
    },
  })

  if (historial.isLoading) return <Esqueleto className="h-32 w-full" />
  const cierres = historial.data?.liquidaciones ?? []
  if (cierres.length === 0) return null

  return (
    <Tarjeta titulo="Cierres anteriores">
      <ul className="flex flex-col divide-y divide-linea/60">
        {cierres.map((cierre) => (
          <li key={cierre.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1 basis-56">
              <p className="font-medium">
                {dia(cierre.desde)} – {dia(cierre.hasta)}{' '}
                <Etiqueta tono={cierre.estado === 'saldada' ? 'neutro' : 'marca'}>
                  {cierre.estado === 'saldada' ? 'saldado' : 'pendiente'}
                </Etiqueta>
              </p>
              <p className="text-sm text-texto-2">
                {cierre.pagos
                  .map((pago) => `${pago.deNombre} → ${pago.aNombre} ${formatearDinero(pago.importe)}`)
                  .join(' · ')}
              </p>
            </div>
            {puedeEditar && cierre.estado === 'pendiente' && (
              <Boton
                variante="secundario"
                tamano="pequeno"
                cargando={saldar.isPending}
                onClick={() => saldar.mutate(cierre.id)}
              >
                Marcar como pagado
              </Boton>
            )}
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}

// ─────────────────────────────────────────────── Negocio

function ModoNegocio({
  espacio,
  miembros,
}: {
  espacio: EspacioResumen
  miembros: MiembroDelEspacio[]
}) {
  const negocio = useQuery({
    queryKey: ['negocio', espacio.id],
    queryFn: () => api.negocio(espacio.id),
  })

  if (negocio.isLoading) return <Esqueleto className="h-48 w-full" />
  if (!negocio.data) return null
  const datos = negocio.data

  return (
    <>
      <Tarjeta titulo="La sociedad">
        <div className="mb-4">
          <p className="text-sm text-texto-3">Resultado del ejercicio en curso</p>
          <Cifra centimos={datos.resultado} tamano="heroe" colorear />
        </div>

        {datos.aviso ? (
          <Aviso tono="atencion" titulo="Las participaciones no cuadran">
            {datos.aviso}
          </Aviso>
        ) : (
          <CuentasDeSocios datos={datos} />
        )}
      </Tarjeta>

      {espacio.rol === 'propietario' && <Participaciones espacio={espacio} miembros={miembros} />}
      {espacio.rol !== 'lector' && <NuevoCapital espacio={espacio} miembros={miembros} />}
    </>
  )
}

function CuentasDeSocios({ datos }: { datos: Negocio }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-linea text-left text-xs uppercase tracking-wide text-texto-3">
            <th scope="col" className="pb-2 font-medium">Socio</th>
            <th scope="col" className="pb-2 text-right font-medium">Participación</th>
            <th scope="col" className="pb-2 text-right font-medium">Aportado</th>
            <th scope="col" className="pb-2 text-right font-medium">Retirado</th>
            <th scope="col" className="pb-2 text-right font-medium">Le toca</th>
            <th scope="col" className="pb-2 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {datos.socios.map((socio) => (
            <tr key={socio.usuarioId} className="border-b border-linea/60 last:border-0">
              <th scope="row" className="py-2 text-left font-normal">{socio.nombre}</th>
              <td className="py-2 text-right text-texto-2">
                {socio.participacion.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %
              </td>
              <td className="py-2 text-right"><Cifra centimos={socio.aportado} /></td>
              <td className="py-2 text-right"><Cifra centimos={socio.retirado} /></td>
              <td className="py-2 text-right">
                <Cifra centimos={socio.beneficioAsignado - socio.beneficioCobrado} colorear />
              </td>
              <td className="py-2 text-right font-medium">
                <Cifra centimos={socio.saldo} colorear conSigno />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-relaxed text-texto-3">
        El saldo es lo que la sociedad le debe a cada socio: aportado − retirado + lo que le toca
        del resultado − lo que ya ha cobrado. <strong>No es contabilidad oficial</strong>, es el
        acuerdo entre vosotros.
      </p>
    </div>
  )
}

function Participaciones({
  espacio,
  miembros,
}: {
  espacio: EspacioResumen
  miembros: MiembroDelEspacio[]
}) {
  const clienteConsultas = useQueryClient()
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(miembros.map((m) => [m.usuarioId, String(m.participacion)])),
  )
  const [error, setError] = useState<string | null>(null)

  const guardar = useMutation({
    mutationFn: () =>
      api.guardarParticipaciones(
        espacio.id,
        miembros.map((miembro) => ({
          usuarioId: miembro.usuarioId,
          participacion: Number((valores[miembro.usuarioId] ?? '0').replace(',', '.')) || 0,
        })),
      ),
    onSuccess: () => {
      setError(null)
      clienteConsultas.invalidateQueries({ queryKey: ['negocio', espacio.id] })
      clienteConsultas.invalidateQueries({ queryKey: ['repartos', espacio.id] })
    },
    onError: (fallo) =>
      setError(fallo instanceof ErrorDeApi ? fallo.message : 'No se han podido guardar.'),
  })

  const suma = miembros.reduce(
    (total, miembro) => total + (Number((valores[miembro.usuarioId] ?? '0').replace(',', '.')) || 0),
    0,
  )

  return (
    <Tarjeta titulo="Participaciones">
      <form
        className="flex flex-col gap-3"
        onSubmit={(evento) => {
          evento.preventDefault()
          guardar.mutate()
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {miembros.map((miembro) => (
            <Campo
              key={miembro.usuarioId}
              etiqueta={`${miembro.nombre} (%)`}
              value={valores[miembro.usuarioId] ?? ''}
              onChange={(e) =>
                setValores((previos) => ({ ...previos, [miembro.usuarioId]: e.target.value }))
              }
            />
          ))}
        </div>
        <p className={`text-sm ${Math.abs(suma - 100) > 0.01 ? 'text-negativo' : 'text-texto-2'}`}>
          Suman {suma.toLocaleString('es-ES', { maximumFractionDigits: 2 })} % de 100 %.
        </p>
        {error && <Aviso tono="error">{error}</Aviso>}
        <div>
          <Boton type="submit" cargando={guardar.isPending} disabled={Math.abs(suma - 100) > 0.01}>
            Guardar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  )
}

function NuevoCapital({
  espacio,
  miembros,
}: {
  espacio: EspacioResumen
  miembros: MiembroDelEspacio[]
}) {
  const clienteConsultas = useQueryClient()
  const [datos, setDatos] = useState({
    usuarioId: miembros[0]?.usuarioId ?? '',
    tipo: 'aportacion' as 'aportacion' | 'retirada' | 'reparto_beneficios',
    importe: '',
    fecha: new Date().toISOString().slice(0, 10),
  })
  const [error, setError] = useState<string | null>(null)

  const apuntar = useMutation({
    mutationFn: () => {
      const importe = parsearImporte(datos.importe)
      if (importe === null || importe <= 0) throw new Error('Pon un importe.')
      return api.apuntarCapital(espacio.id, { ...datos, importe })
    },
    onSuccess: () => {
      setError(null)
      setDatos((previos) => ({ ...previos, importe: '' }))
      clienteConsultas.invalidateQueries({ queryKey: ['negocio', espacio.id] })
    },
    onError: (fallo) => setError(fallo instanceof Error ? fallo.message : 'No se ha podido apuntar.'),
  })

  return (
    <Tarjeta titulo="Apuntar movimiento de capital">
      <form
        className="flex flex-col gap-3"
        onSubmit={(evento) => {
          evento.preventDefault()
          apuntar.mutate()
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Socio</span>
            <select
              className="rounded-campo border border-linea bg-sup-1 px-3 py-2 text-sm"
              value={datos.usuarioId}
              onChange={(evento) => setDatos({ ...datos, usuarioId: evento.target.value })}
            >
              {miembros.map((miembro) => (
                <option key={miembro.usuarioId} value={miembro.usuarioId}>
                  {miembro.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tipo</span>
            <select
              className="rounded-campo border border-linea bg-sup-1 px-3 py-2 text-sm"
              value={datos.tipo}
              onChange={(evento) =>
                setDatos({ ...datos, tipo: evento.target.value as typeof datos.tipo })
              }
            >
              <option value="aportacion">Aportación</option>
              <option value="retirada">Retirada</option>
              <option value="reparto_beneficios">Reparto de beneficios</option>
            </select>
          </label>
          <Campo
            etiqueta="Importe"
            value={datos.importe}
            onChange={(e) => setDatos({ ...datos, importe: e.target.value })}
            placeholder="1.500"
          />
          <Campo
            etiqueta="Fecha"
            type="date"
            value={datos.fecha}
            onChange={(e) => setDatos({ ...datos, fecha: e.target.value })}
          />
        </div>
        {error && <Aviso tono="error">{error}</Aviso>}
        <div>
          <Boton type="submit" cargando={apuntar.isPending}>
            Apuntar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  )
}

function nombreDeMes(mes: string): string {
  const nombre = new Date(`${mes}-01T00:00:00`).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  })
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

function dia(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
