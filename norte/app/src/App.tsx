import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Logotipo } from './componentes/Marca.js'
import { Aviso, Boton, Esqueleto } from './componentes/ui.js'
import { useUi, type Tema } from './estado/ui.js'
import { api, ErrorDeApi, type Sesion } from './lib/api.js'
import { ir, useRuta } from './lib/router.js'
import { Entrar } from './pantallas/Entrar.js'
import { Inicio } from './pantallas/Inicio.js'
import { Muestra } from './pantallas/Muestra.js'

export function App() {
  const ruta = useRuta()
  const clientes = useQueryClient()
  const { espacioId, elegirEspacio } = useUi()

  const sesion = useQuery<Sesion>({
    queryKey: ['sesion'],
    queryFn: api.yo,
    // Un 401 no es un fallo del que reintentar: es que no has entrado.
    retry: (intentos, error) => !(error instanceof ErrorDeApi && error.estado === 401) && intentos < 2,
  })

  const salir = useMutation({
    mutationFn: api.salir,
    onSuccess: () => clientes.setQueryData(['sesion'], null),
  })

  const espacios = sesion.data?.espacios ?? []
  const activo = espacios.find((e) => e.id === espacioId) ?? espacios[0]

  // Si el espacio guardado ya no existe (te dieron de baja, o es otro
  // dispositivo), se cae al primero que haya en vez de dejar la app en blanco.
  useEffect(() => {
    if (activo && activo.id !== espacioId) elegirEspacio(activo.id)
  }, [activo, espacioId, elegirEspacio])

  if (sesion.isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-10">
        <Esqueleto className="h-10 w-48" />
        <Esqueleto className="h-32 w-full" />
      </div>
    )
  }

  // El enlace de invitación lleva el testigo en el fragmento (#/…), que el
  // navegador NO manda al servidor: no acaba en los registros de nginx ni en
  // los de la API.
  const tokenInvitacion = ruta.startsWith('/invitacion/') ? ruta.slice('/invitacion/'.length) : undefined

  const sinSesion = !sesion.data || (sesion.error instanceof ErrorDeApi && sesion.error.estado === 401)
  if (sinSesion) {
    if (sesion.error instanceof ErrorDeApi && sesion.error.codigo === 'sin_conexion') {
      return (
        <main className="flex min-h-dvh items-center justify-center px-5">
          <div className="max-w-md">
            <Aviso tono="error" titulo="No se llega al servidor de Norte">
              Comprueba que el servidor está levantado. Si Norte corre en tu Umbrel, entra por la
              dirección del Umbrel y no por la del navegador de otro equipo.
            </Aviso>
          </div>
        </main>
      )
    }
    return <Entrar tokenInvitacion={tokenInvitacion} />
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="material sticky top-0 z-20 border-b border-linea bg-sup-1/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-5">
          <button onClick={() => ir('/')} className="flex items-center" aria-label="Ir al inicio">
            <Logotipo tamano={24} />
          </button>

          {espacios.length > 0 && (
            <select
              value={activo?.id}
              onChange={(e) => elegirEspacio(e.target.value)}
              aria-label="Espacio"
              className="h-9 rounded-campo border border-linea bg-sup-2 px-2.5 text-sm text-texto-1"
            >
              {espacios.map((espacio) => (
                <option key={espacio.id} value={espacio.id}>
                  {espacio.nombre}
                </option>
              ))}
            </select>
          )}

          <div className="ml-auto flex items-center gap-2">
            <SelectorTema />
            <Boton
              variante="fantasma"
              tamano="pequeno"
              cargando={salir.isPending}
              onClick={() => salir.mutate()}
            >
              Salir
            </Boton>
          </div>
        </div>
      </header>

      <main className="animar-entrada">
        {ruta === '/muestra' ? <Muestra /> : <Inicio espacio={activo} />}
      </main>

      <footer className="mx-auto max-w-5xl px-5 pb-10 pt-4 text-sm text-texto-3">
        {sesion.data?.usuario.email} · Norte guarda tus datos en este servidor.
      </footer>
    </div>
  )
}

function SelectorTema() {
  const { tema, cambiarTema } = useUi()
  const opciones: { valor: Tema; texto: string }[] = [
    { valor: 'sistema', texto: 'Automático' },
    { valor: 'claro', texto: 'Claro' },
    { valor: 'oscuro', texto: 'Oscuro' },
  ]
  return (
    <select
      value={tema}
      onChange={(e) => cambiarTema(e.target.value as Tema)}
      aria-label="Tema"
      className="h-9 rounded-campo border border-linea bg-sup-2 px-2.5 text-sm text-texto-1"
    >
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.texto}
        </option>
      ))}
    </select>
  )
}
