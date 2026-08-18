import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Logotipo } from '../componentes/Marca.js'
import { Aviso, Boton, Campo, Esqueleto } from '../componentes/ui.js'
import { api, ErrorDeApi } from '../lib/api.js'

/**
 * La puerta.
 *
 * Tres situaciones distintas y cada una se cuenta como es, porque un formulario
 * de registro que luego rechaza es peor que no ofrecerlo:
 *
 *  · Instalación recién estrenada → «crea tu cuenta», sin más.
 *  · Ya hay alguien y no traes invitación → solo se puede entrar, y se explica.
 *  · Traes invitación → se dice a qué espacio y quién te invita antes de pedir
 *    un solo dato.
 */
export function Entrar({ tokenInvitacion }: { tokenInvitacion?: string }) {
  const clientes = useQueryClient()

  const puerta = useQuery({ queryKey: ['puerta'], queryFn: api.estadoPuerta })
  const invitacion = useQuery({
    queryKey: ['invitacion', tokenInvitacion],
    queryFn: () => api.consultarInvitacion(tokenInvitacion!),
    enabled: Boolean(tokenInvitacion),
  })

  const invitacionValida = invitacion.data?.valida ? invitacion.data : null
  const puedeRegistrarse =
    puerta.data?.primeraCuenta === true || Boolean(invitacionValida)

  const [modo, setModo] = useState<'entrar' | 'registro' | null>(null)
  const modoReal = modo ?? (puedeRegistrarse ? 'registro' : 'entrar')

  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [contrasena, setContrasena] = useState('')

  const envio = useMutation({
    mutationFn: () =>
      modoReal === 'entrar'
        ? api.entrar(email, contrasena)
        : api.registro(email, nombre, contrasena, tokenInvitacion),
    onSuccess: (sesion) => {
      clientes.setQueryData(['sesion'], sesion)
      // Fuera el testigo de la barra de direcciones en cuanto se usa.
      if (tokenInvitacion) window.location.hash = '/'
    },
  })

  const error = envio.error instanceof ErrorDeApi ? envio.error : null
  const cargando = puerta.isLoading || (Boolean(tokenInvitacion) && invitacion.isLoading)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fondo px-5 py-10">
      <div className="animar-entrada w-full max-w-sm">
        <div className="mb-8 flex flex-col gap-3">
          <Logotipo tamano={34} />
          <Presentacion
            modo={modoReal}
            primeraCuenta={puerta.data?.primeraCuenta === true}
            invitacion={invitacionValida}
          />
        </div>

        {cargando ? (
          <div className="flex flex-col gap-3">
            <Esqueleto className="h-11 w-full" />
            <Esqueleto className="h-11 w-full" />
          </div>
        ) : (
          <>
            {invitacion.data && !invitacion.data.valida && (
              <div className="mb-5">
                <Aviso tono="atencion" titulo="Esa invitación no vale">
                  {invitacion.data.mensaje}
                </Aviso>
              </div>
            )}

            <form
              className="flex flex-col gap-4"
              onSubmit={(evento) => {
                evento.preventDefault()
                envio.mutate()
              }}
            >
              {modoReal === 'registro' && (
                <Campo
                  etiqueta="Cómo te llamas"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoComplete="name"
                  required
                />
              )}

              <Campo
                etiqueta="Correo"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                ayuda={
                  modoReal === 'registro' && invitacionValida?.email
                    ? `La invitación es para ${invitacionValida.email}.`
                    : undefined
                }
                required
              />

              <Campo
                etiqueta="Contraseña"
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                autoComplete={modoReal === 'entrar' ? 'current-password' : 'new-password'}
                ayuda={
                  modoReal === 'registro'
                    ? 'Al menos 10 caracteres. Una frase que recuerdes vale más que un símbolo raro.'
                    : undefined
                }
                required
              />

              {error && (
                <Aviso tono="error" titulo="No se ha podido continuar">
                  {error.message}
                </Aviso>
              )}

              <Boton type="submit" cargando={envio.isPending} className="mt-2 w-full">
                {modoReal === 'entrar' ? 'Entrar' : 'Crear cuenta'}
              </Boton>
            </form>

            {puedeRegistrarse && (
              <p className="mt-6 text-center text-sm text-texto-3">
                {modoReal === 'entrar' ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
                <button
                  type="button"
                  className="font-medium text-marca hover:underline"
                  onClick={() => {
                    setModo(modoReal === 'entrar' ? 'registro' : 'entrar')
                    envio.reset()
                  }}
                >
                  {modoReal === 'entrar' ? 'Créala' : 'Entra'}
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function Presentacion({
  modo,
  primeraCuenta,
  invitacion,
}: {
  modo: 'entrar' | 'registro'
  primeraCuenta: boolean
  invitacion: { espacio: string; invitaPor: string; rol: string } | null
}) {
  if (invitacion && modo === 'registro') {
    return (
      <p className="text-[0.95rem] leading-relaxed text-texto-2">
        <strong className="text-texto-1">{invitacion.invitaPor}</strong> te invita a{' '}
        <strong className="text-texto-1">{invitacion.espacio}</strong>
        {invitacion.rol === 'lector' ? ', para que puedas verlo' : ', para llevarlo entre los dos'}.
        Crea tu cuenta y entras directo.
      </p>
    )
  }
  if (primeraCuenta && modo === 'registro') {
    return (
      <p className="text-[0.95rem] leading-relaxed text-texto-2">
        Esta instalación es nueva. La primera cuenta es la tuya y será la que mande: a partir de
        ahí, solo se entra por invitación.
      </p>
    )
  }
  if (modo === 'entrar') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[0.95rem] leading-relaxed text-texto-2">Tu dinero, en una pantalla.</p>
        {!primeraCuenta && (
          // Decirlo aquí evita que alguien rellene un registro que iba a ser
          // rechazado de todas formas.
          <p className="text-sm leading-relaxed text-texto-3">
            Este Norte no admite registros abiertos. Si te han invitado, entra por el enlace que te
            enviaron.
          </p>
        )}
      </div>
    )
  }
  return (
    <p className="text-[0.95rem] leading-relaxed text-texto-2">
      Crea tu cuenta. Los datos se quedan en este servidor, que es el tuyo.
    </p>
  )
}
