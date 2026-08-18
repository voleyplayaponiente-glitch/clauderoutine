import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Aviso, Boton, Campo, EstadoVacio, Etiqueta, Tarjeta } from '../componentes/ui.js'
import { api, type EspacioResumen } from '../lib/api.js'
import { ir } from '../lib/router.js'

/**
 * Pantalla de inicio de la fase 1.
 *
 * El bento completo con el patrimonio neto es la fase 6; poner aquí un
 * dashboard con cifras inventadas sería enseñar una maqueta y llamarla app. Lo
 * que sí hace ya es lo de esta fase: decir en qué espacio estás, con qué papel,
 * y dejarte abrir la puerta a quien tú decidas.
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
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">{espacio.nombre}</h1>
          <Etiqueta tono="marca">{nombreTipo(espacio.tipo)}</Etiqueta>
          <Etiqueta>{nombreRol(espacio.rol)}</Etiqueta>
        </div>
        <p className="text-texto-2">Aquí vivirá tu cuadro completo. De momento, los cimientos.</p>
      </header>

      <Aviso titulo="Fase 1 de 9: cimientos">
        Están puestos el esquema de datos completo, las cuentas de usuario, el aislamiento entre
        espacios —con sus tests— y el sistema de diseño. Lo siguiente son las cuentas y los
        movimientos, y después la lectura de nóminas y extractos.
      </Aviso>

      <div className="grid gap-5 sm:grid-cols-2">
        <Tarjeta titulo="Tus datos, en tu servidor">
          <p className="text-sm leading-relaxed text-texto-2">
            Norte guarda en PostgreSQL, dentro de tu Umbrel. Limpiar el navegador, cambiar de móvil
            o entrar desde otro equipo ya no pierde nada: esto es lo que arregla el problema de
            siempre.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Sistema de diseño">
          <p className="mb-4 text-sm leading-relaxed text-texto-2">
            Los componentes con los que se construye todo lo demás, en los dos temas.
          </p>
          <Boton variante="secundario" tamano="pequeno" onClick={() => ir('/muestra')}>
            Ver el muestrario
          </Boton>
        </Tarjeta>
      </div>

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
