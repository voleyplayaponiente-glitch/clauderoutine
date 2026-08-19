import { formatearDinero, parsearImporte } from '@norte/dominio'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Aviso, Boton, Campo, Cifra, Esqueleto, EstadoVacio, Etiqueta, Tarjeta } from '../componentes/ui.js'
import {
  api,
  ErrorDeApi,
  type Deuda,
  type EspacioResumen,
  type OpcionAmortizacion,
  type Tarjeta as TarjetaCredito,
} from '../lib/api.js'

/**
 * Deudas y tarjetas.
 *
 * Dos preguntas mandan sobre el resto de la pantalla, y las dos se responden
 * con una cifra al lado de la otra:
 *
 *  · **¿Reduzco cuota o reduzco plazo?** Nunca se enseña una sin la otra, y la
 *    comisión se resta del ahorro. Un simulador que enseña «te ahorras 8.400 €»
 *    y esconde los 500 € de comisión está vendiendo, no informando.
 *  · **¿Qué me cuesta aplazar?** No «pagarás 4.627 €», sino «pagarás 1.627 € de
 *    más por las mismas compras», y cuánto tiempo.
 */

const TIPOS: { valor: string; texto: string }[] = [
  { valor: 'hipoteca', texto: 'Hipoteca' },
  { valor: 'prestamo_personal', texto: 'Préstamo personal' },
  { valor: 'auto', texto: 'Coche' },
  { valor: 'estudios', texto: 'Estudios' },
  { valor: 'familiar', texto: 'Familiar' },
  { valor: 'tarjeta_revolving', texto: 'Revolving' },
]

const NOMBRE_TIPO: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.valor, t.texto]))

export function Deudas({ espacio }: { espacio: EspacioResumen }) {
  const puedeEditar = espacio.rol !== 'lector'
  const deudas = useQuery({ queryKey: ['deudas', espacio.id], queryFn: () => api.deudas(espacio.id) })
  const tarjetas = useQuery({ queryKey: ['tarjetas', espacio.id], queryFn: () => api.tarjetas(espacio.id) })

  const total = (deudas.data?.deudas ?? []).reduce((suma, d) => suma + d.saldoPendiente, 0)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">Deudas y tarjetas</h1>
          <p className="text-texto-2">{espacio.nombre}</p>
        </div>
        {total > 0 && (
          <div className="text-right">
            <span className="text-xs uppercase tracking-[0.08em] text-texto-3">Pendiente</span>
            <p className="cifra-heroe text-2xl font-semibold">{formatearDinero(total)}</p>
          </div>
        )}
      </header>

      {deudas.isLoading ? (
        <Esqueleto className="h-40 w-full" />
      ) : deudas.data && deudas.data.deudas.length === 0 ? (
        <EstadoVacio
          titulo="Sin deudas registradas"
          texto="Añade una hipoteca o un préstamo y Norte calcula el cuadro entero, lo que te queda y cuánto ahorrarías amortizando antes de tiempo."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {deudas.data?.deudas.map((deuda) => (
            <FichaDeuda key={deuda.id} espacio={espacio} deuda={deuda} puedeEditar={puedeEditar} />
          ))}
        </div>
      )}

      {(deudas.data?.deudas.length ?? 0) > 1 && <Estrategias espacio={espacio} />}

      {puedeEditar && <NuevaDeuda espacio={espacio} />}

      <h2 className="mt-4 text-xl font-semibold tracking-[-0.01em]">Tarjetas</h2>
      {tarjetas.isLoading ? (
        <Esqueleto className="h-28 w-full" />
      ) : (
        (tarjetas.data?.tarjetas ?? []).map((tarjeta) => (
          <FichaTarjeta key={tarjeta.id} espacio={espacio} tarjeta={tarjeta} puedeEditar={puedeEditar} />
        ))
      )}
      <SimuladorAplazado espacio={espacio} />
      {puedeEditar && <NuevaTarjeta espacio={espacio} />}
    </div>
  )
}

// ───────────────────────────────────────────────────────────── Una deuda

function FichaDeuda({
  espacio,
  deuda,
  puedeEditar,
}: {
  espacio: EspacioResumen
  deuda: Deuda
  puedeEditar: boolean
}) {
  const clientes = useQueryClient()
  const [verCuadro, setVerCuadro] = useState(false)
  const [verSimulador, setVerSimulador] = useState(false)

  const borrar = useMutation({
    mutationFn: () => api.borrarDeuda(espacio.id, deuda.id),
    onSuccess: () => clientes.invalidateQueries({ queryKey: ['deudas', espacio.id] }),
  })

  const devuelto = deuda.principalOriginal - deuda.saldoPendiente
  const progreso = deuda.principalOriginal > 0 ? (devuelto / deuda.principalOriginal) * 100 : 0

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{deuda.nombre}</h3>
            <Etiqueta>{NOMBRE_TIPO[deuda.tipo] ?? deuda.tipo}</Etiqueta>
            {deuda.tipoVariable && <Etiqueta tono="marca">Variable</Etiqueta>}
          </div>
          <p className="text-sm text-texto-2">
            {deuda.entidad && `${deuda.entidad} · `}
            {deuda.tin.toLocaleString('es-ES', { maximumFractionDigits: 2 })} % TIN ·{' '}
            {deuda.taeEquivalente.toLocaleString('es-ES', { maximumFractionDigits: 2 })} % TAE
            equivalente
          </p>
        </div>
        <div className="text-right">
          <p className="cifra text-xl font-semibold">{formatearDinero(deuda.saldoPendiente)}</p>
          <p className="text-sm text-texto-3">
            de {formatearDinero(deuda.principalOriginal, { sinDecimales: true })}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-sup-3">
        <div className="h-full rounded-full bg-marca" style={{ width: `${Math.min(progreso, 100)}%` }} />
      </div>
      <p className="mt-1.5 text-sm text-texto-3">
        {deuda.cuotasPagadas} de {deuda.resumen.cuotas} cuotas · llevas devuelto{' '}
        {formatearDinero(devuelto, { sinDecimales: true })}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Dato nombre="Cuota" texto={formatearDinero(deuda.cuotaActual || deuda.cuota)} />
        <Dato
          nombre="Próximo pago"
          texto={deuda.proximoPago ? fecha(deuda.proximoPago.fecha) : 'Liquidada'}
        />
        <Dato nombre="Intereses totales" texto={formatearDinero(deuda.resumen.totalIntereses, { sinDecimales: true })} />
        <Dato
          nombre="Por cada euro"
          texto={`${deuda.resumen.porCadaEuro.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`}
        />
      </dl>

      {deuda.tipoVariable && (
        <p className="mt-3 text-xs leading-relaxed text-texto-3">
          El cuadro está calculado con el tipo de hoy. Al ser variable cambiará en cada revisión,
          así que tómalo como la foto de ahora y no como una promesa.
        </p>
      )}

      {deuda.amortizaciones.length > 0 && (
        <p className="mt-3 text-sm text-texto-2">
          {deuda.amortizaciones.length} amortización{deuda.amortizaciones.length === 1 ? '' : 'es'}{' '}
          anticipada{deuda.amortizaciones.length === 1 ? '' : 's'}, con{' '}
          {formatearDinero(
            deuda.amortizaciones.reduce((t, a) => t + a.interesAhorrado, 0),
            { sinDecimales: true },
          )}{' '}
          de interés ahorrado.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-linea pt-4">
        <Boton variante="secundario" tamano="pequeno" onClick={() => setVerSimulador(!verSimulador)}>
          {verSimulador ? 'Cerrar simulador' : 'Amortizar antes de tiempo'}
        </Boton>
        <Boton variante="fantasma" tamano="pequeno" onClick={() => setVerCuadro(!verCuadro)}>
          {verCuadro ? 'Ocultar cuadro' : 'Ver el cuadro'}
        </Boton>
        {puedeEditar && (
          <Boton variante="fantasma" tamano="pequeno" cargando={borrar.isPending} onClick={() => borrar.mutate()}>
            Borrar
          </Boton>
        )}
      </div>

      {verSimulador && <Simulador espacio={espacio} deuda={deuda} puedeEditar={puedeEditar} />}
      {verCuadro && <CuadroCompleto espacio={espacio} deuda={deuda} />}
    </Tarjeta>
  )
}

function Dato({ nombre, texto }: { nombre: string; texto: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-texto-3">{nombre}</dt>
      <dd className="cifra">{texto}</dd>
    </div>
  )
}

// ──────────────────────────────────────────── Simulador de amortización

function Simulador({
  espacio,
  deuda,
  puedeEditar,
}: {
  espacio: EspacioResumen
  deuda: Deuda
  puedeEditar: boolean
}) {
  const clientes = useQueryClient()
  const [importe, setImporte] = useState('5.000')
  const trasCuota = Math.max(deuda.cuotasPagadas, 0)

  const simular = useMutation({
    mutationFn: () => {
      const valor = parsearImporte(importe)
      if (valor === null || valor <= 0) throw new ErrorDeApi(0, 'datos_invalidos', 'Pon un importe válido.')
      return api.simularAmortizacion(espacio.id, deuda.id, { trasCuota, importe: valor })
    },
  })

  const aplicar = useMutation({
    mutationFn: (reducePlazo: boolean) => {
      const valor = parsearImporte(importe) ?? 0
      return api.amortizar(espacio.id, deuda.id, { trasCuota, importe: valor, reducePlazo })
    },
    onSuccess: () => clientes.invalidateQueries({ queryKey: ['deudas', espacio.id] }),
  })

  return (
    <div className="mt-4 flex flex-col gap-4 rounded-campo bg-sup-2 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Campo
            etiqueta="Cuánto amortizas"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            ayuda={`Tras la cuota ${trasCuota}`}
          />
        </div>
        <Boton tamano="pequeno" cargando={simular.isPending} onClick={() => simular.mutate()}>
          Calcular
        </Boton>
        {deuda.comisionAmortizacion > 0 && (
          <span className="text-sm text-texto-3">
            Tu contrato tiene un {deuda.comisionAmortizacion} % de comisión.
          </span>
        )}
      </div>

      {simular.error instanceof ErrorDeApi && (
        <Aviso tono="error" titulo="No se ha podido calcular">{simular.error.message}</Aviso>
      )}

      {simular.data && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Opcion
            titulo="Reducir plazo"
            explicacion="Mantienes la misma cuota y acabas antes."
            opcion={simular.data.reducirPlazo}
            destacada={simular.data.reducirPlazo.ahorroNeto >= simular.data.reducirCuota.ahorroNeto}
            accion={
              puedeEditar ? (
                <Boton tamano="pequeno" cargando={aplicar.isPending} onClick={() => aplicar.mutate(true)}>
                  Registrarla así
                </Boton>
              ) : null
            }
          />
          <Opcion
            titulo="Reducir cuota"
            explicacion="Pagas menos cada mes y acabas el mismo día."
            opcion={simular.data.reducirCuota}
            destacada={simular.data.reducirCuota.ahorroNeto > simular.data.reducirPlazo.ahorroNeto}
            accion={
              puedeEditar ? (
                <Boton
                  variante="secundario"
                  tamano="pequeno"
                  cargando={aplicar.isPending}
                  onClick={() => aplicar.mutate(false)}
                >
                  Registrarla así
                </Boton>
              ) : null
            }
          />
        </div>
      )}
      {aplicar.error instanceof ErrorDeApi && (
        <Aviso tono="error" titulo="No se ha registrado">{aplicar.error.message}</Aviso>
      )}
    </div>
  )
}

function Opcion({
  titulo,
  explicacion,
  opcion,
  destacada,
  accion,
}: {
  titulo: string
  explicacion: string
  opcion: OpcionAmortizacion
  destacada: boolean
  accion: React.ReactNode
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-campo bg-sup-1 p-4 ring-1 ${
        destacada ? 'ring-marca' : 'ring-linea'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-medium">{titulo}</h4>
        {destacada && <span className="text-xs text-marca">ahorra más</span>}
      </div>
      <p className="text-sm text-texto-2">{explicacion}</p>

      <p className="cifra text-2xl font-semibold text-positivo">
        {formatearDinero(opcion.ahorroNeto, { sinDecimales: true })}
      </p>
      <p className="text-xs text-texto-3">
        de ahorro neto ({formatearDinero(opcion.interesAhorrado, { sinDecimales: true })} de intereses
        {opcion.comision > 0 && <> menos {formatearDinero(opcion.comision, { sinDecimales: true })} de comisión</>})
      </p>

      <ul className="mt-1 flex flex-col gap-0.5 text-sm text-texto-2">
        <li>
          Nueva cuota: <strong>{formatearDinero(opcion.nuevaCuota)}</strong>
        </li>
        <li>
          {opcion.cuotasAhorradas > 0
            ? `Acabas ${opcion.cuotasAhorradas} meses antes`
            : 'Acabas el mismo mes'}
          {opcion.ultimaFecha && ` (${fecha(opcion.ultimaFecha)})`}
        </li>
      </ul>
      {accion}
    </div>
  )
}

function CuadroCompleto({ espacio, deuda }: { espacio: EspacioResumen; deuda: Deuda }) {
  const cuadro = useQuery({
    queryKey: ['cuadro', deuda.id],
    queryFn: () => api.cuadro(espacio.id, deuda.id),
  })
  if (cuadro.isLoading) return <Esqueleto className="mt-4 h-40 w-full" />
  if (!cuadro.data) return null

  return (
    <div className="mt-4 max-h-96 overflow-auto rounded-campo bg-sup-2">
      <table className="w-full min-w-[30rem] text-sm">
        <thead className="sticky top-0 bg-sup-2">
          <tr className="text-left text-xs uppercase tracking-[0.06em] text-texto-3">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 text-right font-medium">Cuota</th>
            <th className="px-3 py-2 text-right font-medium">Interés</th>
            <th className="px-3 py-2 text-right font-medium">Capital</th>
            <th className="px-3 py-2 text-right font-medium">Pendiente</th>
          </tr>
        </thead>
        <tbody>
          {cuadro.data.cuadro.map((fila) => (
            <tr key={fila.numero} className="border-t border-linea">
              <td className="px-3 py-1.5 text-texto-3">{fila.numero}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{fecha(fila.fecha)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatearDinero(fila.cuota)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-texto-2">
                {formatearDinero(fila.interes)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-texto-2">
                {formatearDinero(fila.capital)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatearDinero(fila.saldoVivo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ────────────────────────────────────────────────── Avalancha vs bola de nieve

function Estrategias({ espacio }: { espacio: EspacioResumen }) {
  const [extra, setExtra] = useState('200')
  const centimos = parsearImporte(extra) ?? 0

  const plan = useQuery({
    queryKey: ['estrategias', espacio.id, centimos],
    queryFn: () => api.estrategias(espacio.id, centimos),
  })

  return (
    <Tarjeta titulo="En qué orden pagarlas">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Campo
            etiqueta="Extra al mes"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            ayuda="Además de las cuotas"
          />
        </div>
      </div>

      {plan.data?.avalancha && plan.data.bolaDeNieve && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Plan
            titulo="Avalancha"
            explicacion="Primero el tipo de interés más alto. Es la que menos intereses paga."
            meses={plan.data.avalancha.meses}
            intereses={plan.data.avalancha.interesTotal}
            orden={plan.data.avalancha.liquidaciones}
            destacada
          />
          <Plan
            titulo="Bola de nieve"
            explicacion="Primero la deuda más pequeña. Paga algo más, pero liquida antes la primera y eso sostiene la constancia."
            meses={plan.data.bolaDeNieve.meses}
            intereses={plan.data.bolaDeNieve.interesTotal}
            orden={plan.data.bolaDeNieve.liquidaciones}
            destacada={false}
          />
        </div>
      )}

      {/* Cuando la deuda más pequeña es además la más cara, las dos estrategias
          dan lo mismo. Enseñar dos cuadros idénticos sin decirlo parece un
          fallo; decirlo es una respuesta útil. */}
      {plan.data?.sobrecosteBolaDeNieve === 0 && plan.data.mesesDeDiferencia === 0 && (
        <p className="mt-3 text-sm text-texto-2">
          En tu caso las dos estrategias coinciden: la deuda más pequeña es también la más cara, así
          que el orden es el mismo por los dos caminos. No hay nada que decidir aquí.
        </p>
      )}

      {plan.data?.sobrecosteBolaDeNieve !== undefined && plan.data.sobrecosteBolaDeNieve > 0 && (
        <p className="mt-3 text-sm text-texto-2">
          La bola de nieve te cuesta{' '}
          <strong>{formatearDinero(plan.data.sobrecosteBolaDeNieve, { sinDecimales: true })}</strong> más
          en intereses
          {plan.data.mesesDeDiferencia
            ? ` y ${plan.data.mesesDeDiferencia} meses más`
            : ''}
          . Si esa diferencia te parece un precio justo por ver una deuda liquidada antes, es una
          decisión tuya y es razonable.
        </p>
      )}
    </Tarjeta>
  )
}

function Plan({
  titulo,
  explicacion,
  meses,
  intereses,
  orden,
  destacada,
}: {
  titulo: string
  explicacion: string
  meses: number | null
  intereses: number
  orden: { nombre: string; mes: number }[]
  destacada: boolean
}) {
  return (
    <div className={`rounded-campo bg-sup-2 p-4 ring-1 ${destacada ? 'ring-marca' : 'ring-linea'}`}>
      <h4 className="font-medium">{titulo}</h4>
      <p className="mb-3 text-sm text-texto-2">{explicacion}</p>
      {meses === null ? (
        <Aviso tono="error" titulo="Así no se acaba">
          Con esas cuotas la deuda no llega a liquidarse: los mínimos no cubren ni los intereses.
        </Aviso>
      ) : (
        <>
          <p className="cifra text-2xl font-semibold">{meses} meses</p>
          <p className="text-sm text-texto-2">
            {formatearDinero(intereses, { sinDecimales: true })} de intereses
          </p>
          <ol className="mt-3 flex flex-col gap-0.5 text-sm text-texto-3">
            {orden.map((paso) => (
              <li key={paso.nombre}>
                {paso.nombre} — mes {paso.mes}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────── Tarjetas

function FichaTarjeta({
  espacio,
  tarjeta,
  puedeEditar,
}: {
  espacio: EspacioResumen
  tarjeta: TarjetaCredito
  puedeEditar: boolean
}) {
  const clientes = useQueryClient()
  const borrar = useMutation({
    mutationFn: () => api.borrarTarjeta(espacio.id, tarjeta.id),
    onSuccess: () => clientes.invalidateQueries({ queryKey: ['tarjetas', espacio.id] }),
  })

  const apretada = tarjeta.utilizacion > 30

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{tarjeta.nombre}</h3>
            {tarjeta.ultimos4 && <Etiqueta>**** {tarjeta.ultimos4}</Etiqueta>}
            <Etiqueta tono={tarjeta.modalidad === 'aplazado' ? 'marca' : 'neutro'}>
              {tarjeta.modalidad === 'aplazado' ? 'Aplazado' : 'Pago total'}
            </Etiqueta>
          </div>
          <p className="text-sm text-texto-2">
            Corte el {tarjeta.diaCorte} · cargo el {tarjeta.diaPago}
          </p>
        </div>
        {puedeEditar && (
          <Boton variante="fantasma" tamano="pequeno" cargando={borrar.isPending} onClick={() => borrar.mutate()}>
            Borrar
          </Boton>
        )}
      </div>

      {/* El número que casi ninguna app enseña y que cambia cuándo compras algo
          caro: una tarjeta de pago total es un préstamo sin intereses de entre
          veinte y cincuenta y cinco días. */}
      <div className="mt-4 rounded-campo bg-marca-tenue p-3">
        <p className="text-sm text-texto-2">Si compras hoy, lo pagas dentro de</p>
        <p className="cifra text-2xl font-semibold text-marca">
          {tarjeta.diasGratisSiComprasHoy} días
        </p>
        <p className="text-xs text-texto-3">
          El ciclo cierra el {fecha(tarjeta.ciclo.hasta)} y se cobra el {fecha(tarjeta.ciclo.fechaPago)}.
        </p>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-sm text-texto-2">
          <span>Dispuesto</span>
          <span className="cifra">
            {formatearDinero(tarjeta.dispuesto)} de {formatearDinero(tarjeta.limite, { sinDecimales: true })}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sup-3">
          <div
            className={`h-full rounded-full ${apretada ? 'bg-aviso' : 'bg-marca'}`}
            style={{ width: `${Math.min(tarjeta.utilizacion, 100)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-texto-3">
          {Math.round(tarjeta.utilizacion)} % usado
          {apretada && ' · por encima del 30 % empieza a pesar en tu historial, aunque lo pagues entero'}
        </p>
      </div>

      <p className="mt-3 text-sm text-texto-2">
        Llevas <Cifra centimos={tarjeta.consumidoCiclo} tamano="pequena" /> gastados en este ciclo.
      </p>
    </Tarjeta>
  )
}

function SimuladorAplazado({ espacio }: { espacio: EspacioResumen }) {
  const [saldo, setSaldo] = useState('3.000')
  const [tin, setTin] = useState('24')
  const [minimo, setMinimo] = useState('3')
  const [suelo, setSuelo] = useState('30')

  const simular = useMutation({
    mutationFn: () =>
      api.simularAplazado(espacio.id, {
        saldo: parsearImporte(saldo) ?? 0,
        tin: Number(tin.replace(',', '.')) || 0,
        minimoPorcentaje: Number(minimo.replace(',', '.')) || 0,
        minimoSuelo: parsearImporte(suelo) ?? 0,
      }),
  })

  return (
    <Tarjeta titulo="Qué cuesta aplazar">
      <p className="mb-4 text-sm leading-relaxed text-texto-2">
        El pago mínimo de una tarjeta revolving es de los productos más caros que se venden en
        España. Aquí puedes ver la cifra completa antes de contratar nada.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32">
          <Campo etiqueta="Saldo" value={saldo} onChange={(e) => setSaldo(e.target.value)} />
        </div>
        <div className="w-24">
          <Campo etiqueta="TIN %" value={tin} onChange={(e) => setTin(e.target.value)} />
        </div>
        <div className="w-24">
          <Campo etiqueta="Mínimo %" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
        </div>
        <div className="w-28">
          <Campo etiqueta="Suelo" value={suelo} onChange={(e) => setSuelo(e.target.value)} />
        </div>
        <Boton tamano="pequeno" cargando={simular.isPending} onClick={() => simular.mutate()}>
          Calcular
        </Boton>
      </div>

      {simular.data && (
        <div className="mt-4">
          {simular.data.nuncaSeLiquida ? (
            <Aviso tono="error" titulo="Esa deuda no se acaba nunca">
              Con ese pago no se cubren ni los intereses del mes: el saldo crece en vez de bajar.
              Harían falta al menos {formatearDinero(simular.data.cuotaMinimaViable)} al mes para
              que empiece a bajar.
            </Aviso>
          ) : (
            <div className="rounded-campo bg-sup-2 p-4">
              <p className="text-sm text-texto-2">Pagarías de más</p>
              <p className="cifra-heroe text-3xl font-semibold text-negativo">
                {formatearDinero(simular.data.interesTotal)}
              </p>
              <p className="mt-1 text-sm text-texto-2">
                por las mismas compras, durante <strong>{simular.data.meses} meses</strong> (
                {(simular.data.meses! / 12).toLocaleString('es-ES', { maximumFractionDigits: 1 })}{' '}
                años). En total {formatearDinero(simular.data.pagadoTotal)}
                {simular.data.porCadaEuro !== null && (
                  <>
                    : {simular.data.porCadaEuro.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €
                    por cada euro gastado
                  </>
                )}
                .
              </p>
              <p className="mt-2 text-sm text-texto-3">
                Primera cuota: {formatearDinero(simular.data.primeraCuota)}.
              </p>
            </div>
          )}
        </div>
      )}
      {simular.error instanceof ErrorDeApi && (
        <Aviso tono="error" titulo="No se ha podido calcular">{simular.error.message}</Aviso>
      )}
    </Tarjeta>
  )
}

// ──────────────────────────────────────────────────────────── Altas

function NuevaDeuda({ espacio }: { espacio: EspacioResumen }) {
  const clientes = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [datos, setDatos] = useState({
    nombre: '',
    tipo: 'hipoteca',
    entidad: '',
    principal: '',
    tin: '3',
    plazoMeses: '360',
    fechaPrimerPago: new Date().toISOString().slice(0, 10),
    comision: '0',
  })

  const crear = useMutation({
    mutationFn: () =>
      api.crearDeuda(espacio.id, {
        nombre: datos.nombre.trim(),
        tipo: datos.tipo,
        entidad: datos.entidad.trim() || null,
        principalOriginal: parsearImporte(datos.principal) ?? 0,
        tin: Number(datos.tin.replace(',', '.')) || 0,
        plazoMeses: Number(datos.plazoMeses) || 0,
        fechaPrimerPago: datos.fechaPrimerPago,
        comisionAmortizacion: Number(datos.comision.replace(',', '.')) || 0,
      }),
    onSuccess: () => {
      setAbierto(false)
      setDatos({ ...datos, nombre: '', principal: '' })
      clientes.invalidateQueries({ queryKey: ['deudas', espacio.id] })
    },
  })

  if (!abierto) {
    return (
      <div>
        <Boton variante="secundario" onClick={() => setAbierto(true)}>
          Añadir una deuda
        </Boton>
      </div>
    )
  }

  return (
    <Tarjeta titulo="Nueva deuda">
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Nombre" placeholder="Hipoteca" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto-2">Tipo</span>
          <select
            value={datos.tipo}
            onChange={(e) => setDatos({ ...datos, tipo: e.target.value })}
            className="h-11 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </label>
        <Campo etiqueta="Entidad" placeholder="Banco" value={datos.entidad} onChange={(e) => setDatos({ ...datos, entidad: e.target.value })} />
        <Campo etiqueta="Importe" placeholder="150.000" value={datos.principal} onChange={(e) => setDatos({ ...datos, principal: e.target.value })} />
        <Campo etiqueta="TIN %" value={datos.tin} onChange={(e) => setDatos({ ...datos, tin: e.target.value })} />
        <Campo etiqueta="Plazo (meses)" value={datos.plazoMeses} onChange={(e) => setDatos({ ...datos, plazoMeses: e.target.value })} />
        <Campo etiqueta="Primer pago" type="date" value={datos.fechaPrimerPago} onChange={(e) => setDatos({ ...datos, fechaPrimerPago: e.target.value })} />
        <Campo
          etiqueta="Comisión amortización %"
          value={datos.comision}
          onChange={(e) => setDatos({ ...datos, comision: e.target.value })}
          ayuda="Mira tu escritura"
        />
      </div>
      {crear.error instanceof ErrorDeApi && (
        <div className="mt-3">
          <Aviso tono="error" titulo="No se ha creado">{crear.error.message}</Aviso>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Boton cargando={crear.isPending} disabled={!datos.nombre.trim()} onClick={() => crear.mutate()}>
          Crear
        </Boton>
        <Boton variante="fantasma" onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
      </div>
    </Tarjeta>
  )
}

function NuevaTarjeta({ espacio }: { espacio: EspacioResumen }) {
  const clientes = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const cuentas = useQuery({ queryKey: ['cuentas', espacio.id], queryFn: () => api.cuentas(espacio.id) })
  const candidatas = (cuentas.data?.cuentas ?? []).filter((c) => c.tipo === 'tarjeta_credito' && !c.archivada)

  const [datos, setDatos] = useState({
    cuentaId: '',
    nombre: '',
    limite: '3.000',
    diaCorte: '25',
    diaPago: '5',
    modalidad: 'pago_total',
    tin: '',
  })

  const crear = useMutation({
    mutationFn: () =>
      api.crearTarjeta(espacio.id, {
        cuentaId: datos.cuentaId || candidatas[0]?.id,
        nombre: datos.nombre.trim(),
        limite: parsearImporte(datos.limite) ?? 0,
        diaCorte: Number(datos.diaCorte) || 1,
        diaPago: Number(datos.diaPago) || 1,
        modalidad: datos.modalidad,
        tin: datos.tin ? Number(datos.tin.replace(',', '.')) : null,
      }),
    onSuccess: () => {
      setAbierto(false)
      clientes.invalidateQueries({ queryKey: ['tarjetas', espacio.id] })
    },
  })

  if (!abierto) {
    return (
      <div>
        <Boton variante="secundario" onClick={() => setAbierto(true)}>
          Añadir una tarjeta
        </Boton>
      </div>
    )
  }

  return (
    <Tarjeta titulo="Nueva tarjeta">
      {candidatas.length === 0 ? (
        <Aviso tono="atencion" titulo="Falta la cuenta">
          Una tarjeta se apoya en una cuenta de tipo «Tarjeta de crédito», donde viven sus
          movimientos. Créala primero en la pestaña Cuentas.
        </Aviso>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-texto-2">Cuenta</span>
              <select
                value={datos.cuentaId || candidatas[0]!.id}
                onChange={(e) => setDatos({ ...datos, cuentaId: e.target.value })}
                className="h-11 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
              >
                {candidatas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <Campo etiqueta="Nombre" placeholder="Visa" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
            <Campo etiqueta="Límite" value={datos.limite} onChange={(e) => setDatos({ ...datos, limite: e.target.value })} />
            <Campo etiqueta="Día de corte" value={datos.diaCorte} onChange={(e) => setDatos({ ...datos, diaCorte: e.target.value })} />
            <Campo etiqueta="Día de cargo" value={datos.diaPago} onChange={(e) => setDatos({ ...datos, diaPago: e.target.value })} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-texto-2">Modalidad</span>
              <select
                value={datos.modalidad}
                onChange={(e) => setDatos({ ...datos, modalidad: e.target.value })}
                className="h-11 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
              >
                <option value="pago_total">Pago total a fin de mes</option>
                <option value="aplazado">Aplazado / revolving</option>
              </select>
            </label>
          </div>
          {crear.error instanceof ErrorDeApi && (
            <div className="mt-3">
              <Aviso tono="error" titulo="No se ha creado">{crear.error.message}</Aviso>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Boton cargando={crear.isPending} disabled={!datos.nombre.trim()} onClick={() => crear.mutate()}>
              Crear
            </Boton>
            <Boton variante="fantasma" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
          </div>
        </>
      )}
    </Tarjeta>
  )
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
}
