import { formatearDinero } from '@norte/dominio'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Boton, Cifra, Esqueleto, EstadoVacio, Etiqueta, Tarjeta } from '../componentes/ui.js'
import { api, type EspacioResumen, type FiltrosMovimientos } from '../lib/api.js'
import { ir } from '../lib/router.js'

/**
 * La lista de movimientos: densa pero legible.
 *
 * El resumen de arriba es **del filtro entero, no de la página que se ve**. Si
 * enseñara el total de las 50 filas visibles, «has gastado 320 €» sería mentira
 * en cuanto el mes tuviera 51 movimientos.
 */
export function Movimientos({ espacio }: { espacio: EspacioResumen }) {
  const [filtros, setFiltros] = useState<FiltrosMovimientos>(() => mesActual())
  const clientes = useQueryClient()

  const lista = useQuery({
    queryKey: ['movimientos', espacio.id, filtros],
    queryFn: () => api.movimientos(espacio.id, filtros),
  })
  const cuentas = useQuery({ queryKey: ['cuentas', espacio.id], queryFn: () => api.cuentas(espacio.id) })

  const borrar = useMutation({
    mutationFn: (id: string) => api.borrarMovimiento(espacio.id, id),
    onSuccess: () => {
      clientes.invalidateQueries({ queryKey: ['movimientos', espacio.id] })
      clientes.invalidateQueries({ queryKey: ['cuentas', espacio.id] })
    },
  })

  const confirmar = useMutation({
    mutationFn: (id: string) => api.editarMovimiento(espacio.id, id, { estado: 'confirmado' }),
    onSuccess: () => {
      clientes.invalidateQueries({ queryKey: ['movimientos', espacio.id] })
      clientes.invalidateQueries({ queryKey: ['cuentas', espacio.id] })
    },
  })

  const nombreCuenta = (id: string) =>
    cuentas.data?.cuentas.find((c) => c.id === id)?.nombre ?? ''

  const puedeEditar = espacio.rol !== 'lector'

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">Movimientos</h1>
          <p className="text-texto-2">{espacio.nombre}</p>
        </div>
        {puedeEditar && (
          <p className="text-sm text-texto-3">
            Pulsa <kbd className="rounded bg-sup-3 px-1.5 py-0.5 text-texto-2">Ctrl</kbd> +{' '}
            <kbd className="rounded bg-sup-3 px-1.5 py-0.5 text-texto-2">K</kbd> para apuntar algo
          </p>
        )}
      </header>

      {lista.data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Resumen
            titulo="Ingresos"
            valor={lista.data.resumen.ingresos}
            color="text-positivo"
            previsto={lista.data.resumen.previsto.ingresos}
          />
          <Resumen
            titulo="Gastos"
            valor={lista.data.resumen.gastos}
            color="text-negativo"
            previsto={lista.data.resumen.previsto.gastos}
          />
          <Resumen
            titulo="Balance"
            valor={lista.data.resumen.balance}
            color={lista.data.resumen.balance >= 0 ? 'text-positivo' : 'text-negativo'}
            conSigno
          />
        </div>
      )}

      <Tarjeta>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto-2">Desde</span>
            <input
              type="date"
              value={filtros.desde ?? ''}
              onChange={(e) => setFiltros({ ...filtros, desde: e.target.value, pagina: 1 })}
              className="h-10 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto-2">Hasta</span>
            <input
              type="date"
              value={filtros.hasta ?? ''}
              onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value, pagina: 1 })}
              className="h-10 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
            />
          </label>
          <label className="flex min-w-40 flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium text-texto-2">Buscar</span>
            <input
              value={filtros.texto ?? ''}
              onChange={(e) => setFiltros({ ...filtros, texto: e.target.value, pagina: 1 })}
              placeholder="Concepto o comercio"
              className="h-10 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1 placeholder:text-texto-3"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto-2">Cuenta</span>
            <select
              value={filtros.cuentaId ?? ''}
              onChange={(e) => setFiltros({ ...filtros, cuentaId: e.target.value, pagina: 1 })}
              className="h-10 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
            >
              <option value="">Todas</option>
              {(cuentas.data?.cuentas ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <Boton variante="fantasma" tamano="pequeno" onClick={() => setFiltros(mesActual())}>
            Este mes
          </Boton>
        </div>

        {lista.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Esqueleto key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : !lista.data || lista.data.movimientos.length === 0 ? (
          <EstadoVacio
            titulo="Aquí no hay nada todavía"
            texto={
              cuentas.data && cuentas.data.cuentas.length === 0
                ? 'Primero crea una cuenta; después podrás apuntar movimientos con Ctrl+K.'
                : 'Prueba con Ctrl+K y escribe algo como «café 3,40 ayer». O cambia el filtro de fechas.'
            }
            accion={
              cuentas.data && cuentas.data.cuentas.length === 0 ? (
                <Boton tamano="pequeno" onClick={() => ir('/cuentas')}>
                  Crear una cuenta
                </Boton>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.06em] text-texto-3">
                    <th className="px-2 py-2 font-medium">Fecha</th>
                    <th className="px-2 py-2 font-medium">Concepto</th>
                    <th className="px-2 py-2 font-medium">Categoría</th>
                    <th className="px-2 py-2 text-right font-medium">Importe</th>
                    {/* La columna de acciones necesita nombre aunque no se
                        vea: en un lector de pantalla, una cabecera vacía deja
                        la última celda de cada fila sin decir de qué es. */}
                    <th className="px-2 py-2">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lista.data.movimientos.map((m) => (
                    <tr key={m.id} className="group border-t border-linea/70">
                      <td className="cifra whitespace-nowrap px-2 py-2.5 text-texto-2">
                        {m.fecha.slice(8, 10)}/{m.fecha.slice(5, 7)}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="text-texto-1">{m.concepto}</span>
                        {m.estado === 'previsto' && (
                          <span className="ml-2 align-middle">
                            <Etiqueta>Previsto</Etiqueta>
                          </span>
                        )}
                        <span className="block text-xs text-texto-3">{nombreCuenta(m.cuentaId)}</span>
                      </td>
                      <td className="px-2 py-2.5 text-texto-2">{m.categoria ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right">
                        <Cifra centimos={m.importe} tamano="pequena" colorear conSigno />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {puedeEditar && (
                          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            {m.estado === 'previsto' && (
                              <Boton
                                variante="fantasma"
                                tamano="pequeno"
                                onClick={() => confirmar.mutate(m.id)}
                              >
                                Confirmar
                              </Boton>
                            )}
                            <Boton
                              variante="fantasma"
                              tamano="pequeno"
                              onClick={() => borrar.mutate(m.id)}
                            >
                              Borrar
                            </Boton>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {lista.data.total > lista.data.movimientos.length && (
              <div className="mt-4 flex items-center justify-between text-sm text-texto-2">
                <span>
                  {lista.data.movimientos.length} de {lista.data.total}
                </span>
                <div className="flex gap-2">
                  <Boton
                    variante="secundario"
                    tamano="pequeno"
                    disabled={(filtros.pagina ?? 1) <= 1}
                    onClick={() => setFiltros({ ...filtros, pagina: (filtros.pagina ?? 1) - 1 })}
                  >
                    Anterior
                  </Boton>
                  <Boton
                    variante="secundario"
                    tamano="pequeno"
                    onClick={() => setFiltros({ ...filtros, pagina: (filtros.pagina ?? 1) + 1 })}
                  >
                    Siguiente
                  </Boton>
                </div>
              </div>
            )}
          </>
        )}
      </Tarjeta>

      <p className="text-sm text-texto-3">
        Borrar manda a la papelera: se puede recuperar durante 30 días.
      </p>
    </div>
  )
}

function Resumen({
  titulo,
  valor,
  color,
  conSigno = false,
  previsto = 0,
}: {
  titulo: string
  valor: number
  color: string
  conSigno?: boolean
  /** Lo que aún no ha pasado. Va debajo y en gris: no es lo mismo y no se suma. */
  previsto?: number
}) {
  return (
    <div className="rounded-tarjeta bg-sup-1 p-4 ring-1 ring-linea/60">
      <span className="text-xs uppercase tracking-[0.08em] text-texto-3">{titulo}</span>
      <p className={`cifra-heroe mt-1 text-2xl font-semibold ${color}`}>
        {formatearDinero(valor, { conSigno })}
      </p>
      {previsto > 0 && (
        <p className="cifra mt-0.5 text-sm text-texto-3">
          + {formatearDinero(previsto)} previstos
        </p>
      )}
    </div>
  )
}

/** El mes en curso, que es lo que se quiere ver el 95 % de las veces. */
function mesActual(): FiltrosMovimientos {
  const hoy = new Date()
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  const iso = (f: Date) =>
    `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
  return { desde: iso(primero), hasta: iso(ultimo), pagina: 1 }
}
