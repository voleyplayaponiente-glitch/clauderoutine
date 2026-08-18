import { formatearDinero, leerApunte } from '@norte/dominio'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, ErrorDeApi } from '../lib/api.js'
import { Aviso, Boton } from './ui.js'

/**
 * Entrada rápida: `Cmd/Ctrl + K`.
 *
 * El principio 2 del encargo dice que apuntar un gasto no puede costar más de
 * tres toques. Aquí es: atajo, escribir «café 3,40 ayer», Enter.
 *
 * La frase **se interpreta en el navegador**, con el mismo motor que usan los
 * tests. Sin ida y vuelta al servidor, la vista previa se actualiza según se
 * escribe, y lo que se ve es exactamente lo que se va a guardar: nada de
 * mandar una frase y descubrir después en qué la convirtió el servidor.
 */
export function EntradaRapida({ espacioId }: { espacioId: string }) {
  const [abierta, setAbierta] = useState(false)
  const [texto, setTexto] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const campo = useRef<HTMLInputElement>(null)
  const clientes = useQueryClient()

  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if ((evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault()
        setAbierta((v) => !v)
      }
      if (evento.key === 'Escape') setAbierta(false)
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [])

  useEffect(() => {
    if (abierta) campo.current?.focus()
  }, [abierta])

  const cuentas = useQuery({
    queryKey: ['cuentas', espacioId],
    queryFn: () => api.cuentas(espacioId),
    enabled: abierta,
  })
  const categorias = useQuery({
    queryKey: ['categorias', espacioId],
    queryFn: () => api.categorias(espacioId),
    enabled: abierta,
  })

  // `hoy` se calcula una vez por apertura: si se recalculara en cada tecla,
  // escribir a las 23:59:59 podría cambiar de día a mitad de la frase.
  const hoy = useMemo(() => new Date(), [abierta])
  const apunte = useMemo(() => leerApunte(texto, hoy), [texto, hoy])

  const cuentaElegida = cuentaId || cuentas.data?.cuentas.find((c) => !c.archivada)?.id || ''

  const guardar = useMutation({
    mutationFn: () =>
      api.crearMovimiento(espacioId, {
        cuentaId: cuentaElegida,
        categoriaId: categoriaId || null,
        importe: apunte.importe,
        fecha: apunte.fecha,
        concepto: apunte.concepto || 'Sin concepto',
      }),
    onSuccess: () => {
      clientes.invalidateQueries({ queryKey: ['movimientos', espacioId] })
      clientes.invalidateQueries({ queryKey: ['cuentas', espacioId] })
      setTexto('')
      setAbierta(false)
    },
  })

  if (!abierta) return null

  const listo = apunte.importe !== null && Boolean(cuentaElegida)
  const error = guardar.error instanceof ErrorDeApi ? guardar.error : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onClick={() => setAbierta(false)}
    >
      <div
        className="animar-entrada material w-full max-w-xl overflow-hidden rounded-panel bg-sup-1/95 shadow-ambiental ring-1 ring-linea"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={campo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && listo && !guardar.isPending) guardar.mutate()
          }}
          placeholder="café 3,40 ayer"
          aria-label="Apunta un movimiento"
          className="w-full bg-transparent px-5 py-4 text-lg text-texto-1 outline-none placeholder:text-texto-3"
        />

        <div className="border-t border-linea px-5 py-4">
          {texto.trim() === '' ? (
            <p className="text-sm leading-relaxed text-texto-3">
              Escribe lo que has gastado. Entiende «café 3,40 ayer», «45 gasolina», «nómina 2400» o
              «cena 32,50 el viernes».
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-base font-medium text-texto-1">
                  {apunte.concepto || <span className="text-texto-3">Sin concepto</span>}
                </span>
                {apunte.importe === null ? (
                  // No se inventa un importe: se dice que falta y ya está.
                  <span className="text-sm text-aviso">Falta el importe</span>
                ) : (
                  <span
                    className={`cifra-heroe text-2xl font-semibold ${
                      apunte.esIngreso ? 'text-positivo' : 'text-negativo'
                    }`}
                  >
                    {formatearDinero(apunte.importe, { conSigno: true })}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-texto-2">
                <span className="rounded-full bg-sup-3 px-2.5 py-1">
                  {fechaBonita(apunte.fecha)}
                  {!apunte.entendido.fecha && <span className="text-texto-3"> (hoy)</span>}
                </span>

                <select
                  value={cuentaElegida}
                  onChange={(e) => setCuentaId(e.target.value)}
                  aria-label="Cuenta"
                  className="h-8 rounded-full border border-linea bg-sup-2 px-2.5 text-sm"
                >
                  {(cuentas.data?.cuentas ?? [])
                    .filter((c) => !c.archivada)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                </select>

                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  aria-label="Categoría"
                  className="h-8 rounded-full border border-linea bg-sup-2 px-2.5 text-sm"
                >
                  <option value="">Sin categoría</option>
                  {(categorias.data?.categorias ?? [])
                    .filter((c) => (apunte.esIngreso ? c.flujo === 'ingreso' : c.flujo === 'gasto'))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.padreId ? '· ' : ''}
                        {c.nombre}
                      </option>
                    ))}
                </select>
              </div>

              {cuentas.data && cuentas.data.cuentas.length === 0 && (
                <Aviso tono="atencion" titulo="Primero hace falta una cuenta">
                  Crea una cuenta en la pantalla de Cuentas y vuelve aquí.
                </Aviso>
              )}
              {error && <Aviso tono="error">{error.message}</Aviso>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-linea bg-sup-2 px-5 py-3">
          <span className="text-xs text-texto-3">
            Enter para guardar · Esc para cerrar
          </span>
          <Boton
            tamano="pequeno"
            disabled={!listo}
            cargando={guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            Guardar
          </Boton>
        </div>
      </div>
    </div>
  )
}

function fechaBonita(iso: string): string {
  const hoy = new Date().toISOString().slice(0, 10)
  if (iso === hoy) return 'Hoy'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}
