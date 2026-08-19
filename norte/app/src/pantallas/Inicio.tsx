import { formatearDinero } from '@norte/dominio'
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Copias } from '../componentes/Copias.js'
import { GraficoArea } from '../componentes/Grafico.js'
import { Aviso, Boton, Campo, Cifra, Esqueleto, EstadoVacio, Etiqueta, Tarjeta } from '../componentes/ui.js'
import { api, type Cuadro, type EspacioResumen } from '../lib/api.js'
import { ir } from '../lib/router.js'

/**
 * El cuadro.
 *
 * Una sola cifra manda: **el patrimonio neto**. El saldo de la cuenta sube
 * cuando pides un préstamo y eso no es haber mejorado; activos menos pasivos sí
 * lo dice. Es la única cifra heroica de la pantalla — poner tres números
 * gigantes es no elegir.
 *
 * Debajo, las dos preguntas que se hacen todos los días: cómo va el patrimonio
 * y si el saldo aguanta el mes. La segunda se responde con **el día de saldo
 * mínimo**, no con el saldo final: acabar el mes con 800 € no consuela si el
 * día 12 te quedas en −40.
 *
 * **El texto de esta pantalla cuenta en qué punto está la app, así que hay que
 * actualizarlo al cerrar cada fase.** Se quedó diciendo «lo siguiente son las
 * cuentas y los movimientos» cuando esas pestañas ya estaban arriba, y el
 * usuario lo vio en su instalación: una app que se equivoca sobre sí misma
 * empieza a no ser creíble en lo demás.
 */
export function Inicio({ espacio }: { espacio: EspacioResumen | undefined }) {
  if (!espacio) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <EstadoVacio
          titulo="No tienes ningún espacio"
          texto="Un espacio es un ámbito financiero: el tuyo, el de la pareja o el del negocio."
          accion={<CrearEspacio />}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-8">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{espacio.nombre}</h1>
        <Etiqueta tono="marca">{nombreTipo(espacio.tipo)}</Etiqueta>
        <Etiqueta>{nombreRol(espacio.rol)}</Etiqueta>
      </header>

      <CuadroCompleto espacio={espacio} />
      <Copias />
      <Compartir espacio={espacio} />

      <Tarjeta titulo="Nuevo espacio">
        <p className="mb-4 text-sm leading-relaxed text-texto-2">
          El personal es solo tuyo. Uno de pareja o de negocio se puede compartir con quien invites.
        </p>
        <CrearEspacio />
      </Tarjeta>
    </div>
  )
}

function CuadroCompleto({ espacio }: { espacio: EspacioResumen }) {
  const cuadro = useQuery({ queryKey: ['cuadro', espacio.id], queryFn: () => api.cuadro(espacio.id) })

  /**
   * La foto del patrimonio del mes se guarda al abrir la pantalla, y es
   * idempotente. Sin cron y sin tarea en el servidor.
   *
   * La contrapartida se dice en la propia tarjeta del gráfico: **un mes en el
   * que no abras Norte no tendrá punto**.
   */
  const foto = useMutation({ mutationFn: () => api.guardarFoto(espacio.id) })
  useEffect(() => {
    if (espacio.rol !== 'lector') foto.mutate()
    // Una vez por espacio y carga: no es un efecto que deba repetirse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espacio.id])

  if (cuadro.isLoading) return <Esqueleto className="h-72 w-full" />
  if (!cuadro.data) return null
  const datos = cuadro.data

  return (
    <>
      <Patrimonio cuadro={datos} />
      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Proyeccion cuadro={datos} />
        <Vencimientos cuadro={datos} />
      </div>
    </>
  )
}

function Patrimonio({ cuadro }: { cuadro: Cuadro }) {
  const { patrimonio, variacionMes, historico } = cuadro
  const puntos = historico.puntos.map((punto) => ({
    etiqueta: new Date(punto.mes).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
    valor: punto.neto,
  }))

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-texto-3">Patrimonio neto</p>
          {/* La única cifra heroica de la pantalla. */}
          <p className="cifra-heroe text-5xl font-semibold sm:text-6xl">
            {formatearDinero(patrimonio.neto)}
          </p>
          <p className="mt-1 text-sm text-texto-2">
            {formatearDinero(patrimonio.activos, { sinDecimales: true })} en activos −{' '}
            {formatearDinero(patrimonio.pasivos, { sinDecimales: true })} en deudas
          </p>
          {variacionMes && (
            <p
              className={`mt-1 text-sm ${
                variacionMes.absoluta >= 0 ? 'text-positivo' : 'text-negativo'
              }`}
            >
              {formatearDinero(variacionMes.absoluta, { conSigno: true, sinDecimales: true })}
              {variacionMes.porcentaje !== null &&
                ` (${variacionMes.porcentaje > 0 ? '+' : ''}${variacionMes.porcentaje.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %)`}{' '}
              desde el mes pasado
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-texto-3">Líquido</dt>
            <dd className="cifra">{formatearDinero(cuadro.liquido, { sinDecimales: true })}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-texto-3">Invertido</dt>
            <dd className="cifra">{formatearDinero(cuadro.valorCartera, { sinDecimales: true })}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 border-t border-linea pt-4">
        {historico.hayBastante ? (
          <>
            <p className="mb-1 text-sm font-medium text-texto-2">Evolución del patrimonio neto</p>
            <GraficoArea puntos={puntos} titulo="Evolución del patrimonio neto" alto={180} />
          </>
        ) : (
          <p className="text-sm leading-relaxed text-texto-2">
            El gráfico de evolución aparecerá cuando haya <strong>al menos dos meses</strong> de
            fotos. Norte guarda una cada mes, la primera vez que abres esta pantalla — así que un
            mes en el que no entres se quedará sin punto. Una línea de un solo punto se leería como
            «plano», y eso sería mentir con un dibujo.
          </p>
        )}
      </div>
    </Tarjeta>
  )
}

function Proyeccion({ cuadro }: { cuadro: Cuadro }) {
  const { proyeccion } = cuadro
  const puntos = proyeccion.dias.map((dia) => ({
    etiqueta: new Date(dia.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
    valor: dia.saldo,
  }))
  const indiceMinimo = proyeccion.dias.findIndex((d) => d.fecha === proyeccion.minimo.fecha)
  const enNegativo = proyeccion.primerDiaEnNegativo !== null

  return (
    <Tarjeta titulo="Los próximos 30 días">
      <p className="mb-1 text-sm text-texto-2">
        Tu saldo más bajo será de{' '}
        <strong className={enNegativo ? 'text-negativo' : ''}>
          {formatearDinero(proyeccion.minimo.saldo)}
        </strong>{' '}
        el {fechaLarga(proyeccion.minimo.fecha)}.
      </p>
      <GraficoArea
        puntos={puntos}
        titulo="Proyección del saldo a 30 días"
        alto={170}
        lineaCero
        destacado={{
          indice: indiceMinimo,
          alerta: enNegativo,
          // Sin negativo no hay nada que añadir: el mínimo ya está en la frase
          // de arriba y el saldo final es la etiqueta directa del gráfico.
          texto: enNegativo
            ? `Te quedas en negativo el ${fechaLarga(proyeccion.primerDiaEnNegativo!)}.`
            : undefined,
        }}
      />
      <p className="mt-3 text-xs leading-relaxed text-texto-3">
        Solo entra lo que ya está comprometido: recibos previstos, cuotas de deudas y recibos de
        tarjeta. <strong>No se extrapola el gasto variable</strong>, porque una línea inventada se
        cumple bonita en la pantalla y nunca en el banco.
      </p>
    </Tarjeta>
  )
}

function Vencimientos({ cuadro }: { cuadro: Cuadro }) {
  return (
    <Tarjeta titulo="Lo que viene">
      {cuadro.documentosPorRevisar > 0 && (
        <div className="mb-4">
          <Aviso titulo="Tienes documentos por revisar">
            {cuadro.documentosPorRevisar} documento{cuadro.documentosPorRevisar === 1 ? '' : 's'} sin
            aplicar.{' '}
            <button className="underline" onClick={() => ir('/documentos')}>
              Ir a Documentos
            </button>
          </Aviso>
        </div>
      )}

      {cuadro.vencimientos.length === 0 ? (
        <p className="text-sm leading-relaxed text-texto-2">
          No hay nada comprometido en los próximos 30 días. Si tienes recibos que se repiten,
          créalos como recurrentes y aparecerán aquí solos.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-linea">
          {cuadro.vencimientos.map((vencimiento, i) => (
            <li key={`${vencimiento.fecha}-${i}`} className="flex items-center gap-3 py-2">
              <span className="w-16 shrink-0 text-sm text-texto-3">{fechaCorta(vencimiento.fecha)}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{vencimiento.concepto}</span>
              <Cifra centimos={vencimiento.importe} tamano="pequena" colorear />
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function CrearEspacio() {
  const clientes = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<'pareja' | 'negocio'>('pareja')

  const crear = useMutation({
    mutationFn: () => api.crearEspacio(nombre.trim(), tipo),
    onSuccess: () => {
      setNombre('')
      clientes.invalidateQueries({ queryKey: ['sesion'] })
    },
  })

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (nombre.trim()) crear.mutate()
      }}
    >
      <div className="min-w-45 flex-1">
        <Campo
          etiqueta="Nombre"
          placeholder="Casa"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-texto-2">Tipo</span>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as 'pareja' | 'negocio')}
          className="h-11 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
        >
          <option value="pareja">Pareja</option>
          <option value="negocio">Negocio</option>
        </select>
      </label>
      <Boton type="submit" cargando={crear.isPending} disabled={!nombre.trim()}>
        Crear
      </Boton>
    </form>
  )
}

/**
 * Invitar a alguien. Solo el propietario, y solo en espacios que se comparten.
 *
 * Desde que el registro está cerrado, esta es **la única forma de que entre
 * alguien nuevo** en esta instalación.
 */
function Compartir({ espacio }: { espacio: EspacioResumen }) {
  const clientes = useQueryClient()
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<'editor' | 'lector'>('editor')
  const [enlace, setEnlace] = useState<string | null>(null)

  const puede = espacio.rol === 'propietario' && espacio.tipo !== 'personal'

  const pendientes = useQuery({
    queryKey: ['invitaciones', espacio.id],
    queryFn: () => api.invitaciones(espacio.id),
    enabled: puede,
  })

  const crear = useMutation({
    mutationFn: () => api.crearInvitacion(espacio.id, { rol, ...(email.trim() ? { email: email.trim() } : {}) }),
    onSuccess: (datos) => {
      setEnlace(`${window.location.origin}${window.location.pathname}${datos.ruta}`)
      setEmail('')
      clientes.invalidateQueries({ queryKey: ['invitaciones', espacio.id] })
    },
  })

  const anular = useMutation({
    mutationFn: (id: string) => api.anularInvitacion(espacio.id, id),
    onSuccess: () => clientes.invalidateQueries({ queryKey: ['invitaciones', espacio.id] }),
  })

  if (!puede) return null

  return (
    <Tarjeta titulo="Compartir este espacio">
      <p className="mb-4 text-sm leading-relaxed text-texto-2">
        Norte no admite registros abiertos: quien no tenga cuenta solo puede entrar con un enlace
        tuyo. Cada enlace vale <strong>una sola vez</strong> y caduca a los 7 días.
      </p>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          crear.mutate()
        }}
      >
        <div className="min-w-52 flex-1">
          <Campo
            etiqueta="Correo (opcional)"
            type="email"
            placeholder="pareja@ejemplo.es"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            ayuda="Si lo pones, el enlace solo sirve para esa persona."
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto-2">Puede</span>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as 'editor' | 'lector')}
            className="h-11 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
          >
            <option value="editor">Editar</option>
            <option value="lector">Solo ver</option>
          </select>
        </label>
        <Boton type="submit" cargando={crear.isPending}>
          Crear enlace
        </Boton>
      </form>

      {enlace && <EnlaceInvitacion enlace={enlace} />}

      {pendientes.data && pendientes.data.invitaciones.length > 0 && (
        <div className="mt-5 flex flex-col gap-2">
          <h4 className="text-sm font-medium text-texto-2">Invitaciones sin usar</h4>
          {pendientes.data.invitaciones.map((i) => (
            <div
              key={i.id}
              className="flex flex-wrap items-center gap-3 rounded-campo bg-sup-2 px-3 py-2 text-sm"
            >
              <span className="text-texto-1">{i.email ?? 'Cualquiera con el enlace'}</span>
              <Etiqueta>{i.rol === 'lector' ? 'Solo ver' : 'Editar'}</Etiqueta>
              <span className="text-texto-3">
                caduca el {new Date(i.expiraEn).toLocaleDateString('es-ES')}
              </span>
              <Boton
                variante="fantasma"
                tamano="pequeno"
                className="ml-auto"
                cargando={anular.isPending}
                onClick={() => anular.mutate(i.id)}
              >
                Anular
              </Boton>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  )
}

function EnlaceInvitacion({ enlace }: { enlace: string }) {
  const [copiado, setCopiado] = useState(false)

  /**
   * `navigator.clipboard` **no existe** en un origen inseguro, y Norte se sirve
   * por http:// dentro de la red de casa: sin el respaldo, el botón no haría
   * nada justo en el sitio donde se usa. Por eso además el enlace está en un
   * campo seleccionable, que es lo que siempre funciona.
   */
  async function copiar() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(enlace)
      } else {
        const campo = document.getElementById('enlace-invitacion') as HTMLInputElement | null
        campo?.select()
        document.execCommand('copy')
      }
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <Aviso titulo="Enlace creado">
        Cópialo y envíaselo por donde quieras. <strong>No se vuelve a mostrar</strong>: si lo
        pierdes, anúlalo y crea otro.
      </Aviso>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="enlace-invitacion"
          readOnly
          value={enlace}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-campo border border-linea bg-sup-2 px-3 font-mono text-xs text-texto-1"
        />
        <Boton variante="secundario" onClick={copiar}>
          {copiado ? 'Copiado' : 'Copiar'}
        </Boton>
      </div>
    </div>
  )
}

function nombreTipo(tipo: EspacioResumen['tipo']): string {
  return { personal: 'Personal', pareja: 'Pareja', negocio: 'Negocio' }[tipo]
}

function nombreRol(rol: EspacioResumen['rol']): string {
  return { propietario: 'Propietario', editor: 'Editor', lector: 'Solo lectura' }[rol]
}
