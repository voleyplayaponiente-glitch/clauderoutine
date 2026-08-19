import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Aviso, Boton, Campo, Esqueleto, Tarjeta } from '../componentes/ui.js'
import { api, ErrorDeApi, type EspacioResumen } from '../lib/api.js'
import { ir } from '../lib/router.js'

/**
 * Ajustes de la instalación: la licencia y sacar tus datos.
 *
 * Las dos cosas van juntas **a propósito**. Una pantalla que te pide una clave
 * de licencia tiene que enseñar, en la misma pantalla y con el mismo tamaño de
 * letra, el botón de llevarte todo lo tuyo. Si solo estuviera lo primero, esto
 * sería una pantalla de cobro; con las dos, es un trato.
 */
export function Ajustes({ espacio }: { espacio: EspacioResumen }) {
  const licencia = useQuery({ queryKey: ['licencia'], queryFn: () => api.licencia() })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">Ajustes</h1>
        <p className="text-texto-2">De esta instalación de Norte</p>
      </header>

      <TusDatos espacio={espacio} />

      <Tarjeta titulo="Lo que Norte no es">
        <p className="text-sm leading-relaxed text-texto-2">
          Norte no mueve dinero, no se conecta a tu banco y no da asesoramiento de inversión ni
          fiscal. Los informes que genera no son documentos contables.
        </p>
        <div className="mt-4">
          <Boton variante="secundario" type="button" onClick={() => ir('/legal')}>
            Aviso legal y privacidad
          </Boton>
        </div>
      </Tarjeta>

      {licencia.isLoading ? (
        <Esqueleto className="h-40 w-full" />
      ) : licencia.data ? (
        <Licencia estado={licencia.data} />
      ) : null}
    </div>
  )
}

function TusDatos({ espacio }: { espacio: EspacioResumen }) {
  return (
    <Tarjeta titulo="Tus datos">
      <p className="text-sm leading-relaxed text-texto-2">
        Todo lo de <strong>{espacio.nombre}</strong>, en un fichero y en tu disco. Sin pedir
        permiso a nadie y sin pasar por internet: lo genera este mismo servidor, que es el tuyo.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a href={api.urlExportacion(espacio.id, 'json')} download>
          <Boton variante="secundario" type="button">
            Descargar todo (JSON)
          </Boton>
        </a>
        <a href={api.urlExportacion(espacio.id, 'csv')} download>
          <Boton variante="secundario" type="button">
            Movimientos (CSV)
          </Boton>
        </a>
        <Boton variante="fantasma" type="button" onClick={() => ir('/informe')}>
          Ver el informe
        </Boton>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-texto-3">
        El CSV lleva punto y coma y coma decimal, que es lo que espera un Excel en español. El
        JSON lleva los importes en céntimos enteros, como los guarda Norte. Exportar funciona
        siempre, también sin licencia.
      </p>
    </Tarjeta>
  )
}

function Licencia({ estado }: { estado: import('../lib/api.js').EstadoLicencia }) {
  const clienteConsultas = useQueryClient()
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [puesta, setPuesta] = useState(false)

  const guardar = useMutation({
    mutationFn: () => api.ponerLicencia(clave.trim()),
    onSuccess: () => {
      setError(null)
      setClave('')
      setPuesta(true)
      clienteConsultas.invalidateQueries({ queryKey: ['licencia'] })
    },
    onError: (fallo) =>
      setError(fallo instanceof ErrorDeApi ? fallo.message : 'No se ha podido guardar la clave.'),
  })

  const PUNTO = { ok: 'bg-positivo', aviso: 'bg-aviso', mal: 'bg-negativo' }[estado.salud]

  return (
    <Tarjeta titulo="Licencia">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${PUNTO}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{estado.titulo}</p>
          <p className="text-sm leading-relaxed text-texto-2">{estado.detalle}</p>
          <p className="mt-1 text-sm text-texto-3">
            {estado.usuariosActivos === 1 ? '1 persona' : `${estado.usuariosActivos} personas`} en
            esta instalación.
          </p>
        </div>
      </div>

      {estado.soyElDueno ? (
        <form
          className="mt-4 flex flex-col gap-3 border-t border-linea pt-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            setError(null)
            setPuesta(false)
            guardar.mutate()
          }}
        >
          <Campo
            etiqueta="Clave de licencia"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="NORTE-1.…"
            ayuda="Pégala entera, tal como te la dieron."
          />
          {error && <Aviso tono="error">{error}</Aviso>}
          {puesta && <Aviso tono="info">Guardada. El cupo se ha actualizado ya.</Aviso>}
          <div>
            <Boton type="submit" cargando={guardar.isPending} disabled={clave.trim().length === 0}>
              Guardar la clave
            </Boton>
          </div>
        </form>
      ) : (
        <p className="mt-4 border-t border-linea pt-4 text-sm text-texto-3">
          La licencia la lleva quien instaló Norte.
        </p>
      )}
    </Tarjeta>
  )
}
