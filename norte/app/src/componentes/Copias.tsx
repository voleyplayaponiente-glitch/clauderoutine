import { juzgarCopias, type SaludCopias } from '@norte/dominio'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ErrorDeApi } from '../lib/api.js'
import { Aviso, Boton, Esqueleto, Tarjeta } from './ui.js'

/**
 * El estado de las copias, en la pantalla que se abre todos los días.
 *
 * Esta tarjeta existe porque **una copia que falla en silencio es peor que no
 * tener copias**: da la tranquilidad sin dar el respaldo. Enterrar el estado en
 * el registro de un contenedor equivale a no tenerlo.
 *
 * Solo la ve quien instaló Norte: el servidor responde 403 al resto y la
 * tarjeta desaparece sola en vez de enseñar un error que no le incumbe a nadie.
 */

const PUNTO: Record<SaludCopias, string> = {
  al_dia: 'bg-positivo',
  atrasada: 'bg-aviso',
  fallida: 'bg-negativo',
  sin_servicio: 'bg-negativo',
}

export function Copias() {
  const clientes = useQueryClient()
  const [pedida, setPedida] = useState(false)

  const copias = useQuery({
    queryKey: ['copias'],
    queryFn: api.copias,
    // Un 403 aquí no es un fallo: es que esta persona no es la dueña de la
    // instalación. Reintentarlo solo gastaría peticiones.
    retry: (intentos, error) =>
      !(error instanceof ErrorDeApi && (error.estado === 403 || error.estado === 401)) &&
      intentos < 2,
  })

  const pedir = useMutation({
    mutationFn: api.copiaAhora,
    onSuccess: () => {
      setPedida(true)
      // El servicio mira la señal cada minuto: se vuelve a preguntar un poco
      // después en vez de dejar la pantalla como estaba.
      setTimeout(() => clientes.invalidateQueries({ queryKey: ['copias'] }), 20_000)
    },
  })

  if (copias.isLoading) return <Esqueleto className="h-28 w-full" />
  if (copias.error || !copias.data) return null

  const juicio = juzgarCopias(
    { estado: copias.data.estado, servicioVivo: copias.data.servicioVivo },
    new Date(),
  )
  const ultima = copias.data.estado?.ultima

  return (
    <Tarjeta titulo="Copias de seguridad">
      <div className="flex flex-wrap items-start gap-3">
        <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${PUNTO[juicio.salud]}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{juicio.titulo}</p>
          <p className="text-sm leading-relaxed text-texto-2">{juicio.detalle}</p>
          {ultima && (
            <p className="mt-1 text-sm text-texto-3">
              Última: {new Date(ultima).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
              {copias.data.estado?.bytes ? ` · ${tamano(copias.data.estado.bytes)}` : ''}
            </p>
          )}
        </div>
        <Boton
          variante="secundario"
          tamano="pequeno"
          cargando={pedir.isPending}
          onClick={() => pedir.mutate()}
        >
          Hacer una copia ahora
        </Boton>
      </div>

      {pedida && !pedir.isError && (
        <Aviso titulo="Pedida">
          El servicio la recoge en menos de un minuto. Vuelve a esta pantalla en un rato para
          verla aquí.
        </Aviso>
      )}
      {pedir.error instanceof ErrorDeApi && (
        <Aviso tono="error" titulo="No se ha podido pedir">{pedir.error.message}</Aviso>
      )}

      {copias.data.copias.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-texto-2">
            Ver las {copias.data.copias.length} copias guardadas
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-texto-3">
            {copias.data.copias.map((copia) => (
              <li key={copia.sello} className="flex flex-wrap gap-2">
                <span className="tabular-nums">
                  {new Date(copia.fecha).toLocaleDateString('es-ES')}
                </span>
                <span>{tamano(copia.bytes)}</span>
                {copia.conDocumentos && <span>con documentos</span>}
              </li>
            ))}
          </ul>
          {/* Saber dónde están es la mitad de tener copias: la otra mitad es
              poder llevárselas fuera del Umbrel. */}
          <p className="mt-3 text-xs leading-relaxed text-texto-3">
            Están en <code className="rounded bg-sup-3 px-1">{copias.data.carpeta}</code> dentro de
            tu servidor. Cópialas de vez en cuando a un disco aparte: una copia que vive en la
            misma máquina que el original no protege de que se estropee esa máquina.
          </p>
        </details>
      )}
    </Tarjeta>
  )
}

function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
