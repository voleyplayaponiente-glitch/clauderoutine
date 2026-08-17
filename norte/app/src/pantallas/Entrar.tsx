import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Logotipo } from '../componentes/Marca.js'
import { Aviso, Boton, Campo } from '../componentes/ui.js'
import { api, ErrorDeApi } from '../lib/api.js'

export function Entrar() {
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar')
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [contrasena, setContrasena] = useState('')
  const clientes = useQueryClient()

  const envio = useMutation({
    mutationFn: () =>
      modo === 'entrar' ? api.entrar(email, contrasena) : api.registro(email, nombre, contrasena),
    onSuccess: (sesion) => {
      clientes.setQueryData(['sesion'], sesion)
    },
  })

  const error = envio.error instanceof ErrorDeApi ? envio.error : null

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fondo px-5 py-10">
      <div className="animar-entrada w-full max-w-sm">
        <div className="mb-8 flex flex-col gap-3">
          <Logotipo tamano={34} />
          <p className="text-[0.95rem] leading-relaxed text-texto-2">
            {modo === 'entrar'
              ? 'Tu dinero, en una pantalla.'
              : 'Crea tu cuenta. Los datos se quedan en este servidor, que es el tuyo.'}
          </p>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            envio.mutate()
          }}
        >
          {modo === 'registro' && (
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
            required
          />

          <Campo
            etiqueta="Contraseña"
            type="password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            ayuda={
              modo === 'registro'
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
            {modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
          </Boton>
        </form>

        <p className="mt-6 text-center text-sm text-texto-3">
          {modo === 'entrar' ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            type="button"
            className="font-medium text-marca hover:underline"
            onClick={() => {
              setModo(modo === 'entrar' ? 'registro' : 'entrar')
              envio.reset()
            }}
          >
            {modo === 'entrar' ? 'Créala' : 'Entra'}
          </button>
        </p>
      </div>
    </main>
  )
}
