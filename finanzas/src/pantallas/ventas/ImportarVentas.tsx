/**
 * Importación de ventas desde un CSV, con previsualización obligatoria.
 *
 * Nada entra sin verse antes: se enseñan las columnas que se han reconocido,
 * las filas que se van a crear con su punto de venta ya emparejado, y las que
 * se descartan con el motivo. El punto de venta que no se puede emparejar con
 * seguridad **no se adivina**: se elige a mano en la propia tabla.
 */
import { useMemo, useRef, useState } from 'react'
import { Boton, Semaforo, ImporteEuro, formatearEuro } from '../../componentes/ui'
import { Modal } from '../../componentes/formularios'
import { leerVentasCsv, baseYCuota, emparejarPunto, type LecturaVentasCsv } from '../../dominio/ventas-csv'
import { decodificarTextoBancario } from '../../dominio/texto'
import { formatearFecha } from '../../lib/fechas'
import { nuevoId } from '../../dominio/id'
import { datafonoPrincipal, datafonosDe } from '../../dominio/datafonos'
import type { CentroCoste, Configuracion, Venta } from '../../dominio/tipos'

/** Nombre corto de cada forma de cobro para la previsualización. */
const ETIQUETA_COBRO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  BIZUM: 'Bizum',
  TRANSFERENCIA: 'Transferencia',
  PASARELA: 'Pasarela',
  APLAZADO: 'Aplazado',
}

interface Props {
  config: Configuracion
  ventasExistentes: Venta[]
  onImportar: (ventas: Venta[]) => void
}

export function ImportarVentas({ config, ventasExistentes, onImportar }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [lectura, setLectura] = useState<LecturaVentasCsv | null>(null)
  const [nombre, setNombre] = useState('')
  const [puntos, setPuntos] = useState<(string | undefined)[]>([])
  const [error, setError] = useState<string | null>(null)
  /** El texto se guarda para poder releerlo si hay que indicar la fecha a mano. */
  const [texto, setTexto] = useState('')
  const [fechaManual, setFechaManual] = useState('')
  const [todos, setTodos] = useState('')
  const [datafonoElegido, setDatafonoElegido] = useState('')

  const centros = useMemo(
    () => config.centrosCoste.filter((c) => c.tipo === 'PUNTO_VENTA' && !c.activoHasta),
    [config.centrosCoste],
  )
  const tipoDefecto = config.tiposIva.find((t) => t.porDefecto)?.tipo ?? 21

  const elegir = async (f: File) => {
    setError(null)
    try {
      const contenido = decodificarTextoBancario(await f.arrayBuffer())
      const r = leerVentasCsv(contenido, f.name)
      setTexto(contenido)
      setFechaManual('')
      setLectura(r)
      setNombre(f.name)
      // Cada fila se empareja sola con su tienda; lo que no case queda vacío.
      setTodos('')
      setDatafonoElegido('')
      setPuntos(r.filas.map((fila) => emparejarPunto(fila.puntoTexto, centros) ?? (centros.length === 1 ? centros[0].id : undefined)))
    } catch (e) {
      setError(`No se ha podido leer el fichero: ${e instanceof Error ? e.message : 'error desconocido'}`)
    } finally {
      if (ref.current) ref.current.value = ''
    }
  }

  /**
   * La persona indica el periodo que el fichero no trae y se vuelve a leer con
   * ese dato. En el semanal, el día elegido es el primero de los siete.
   */
  const ponerFecha = (fecha: string) => {
    setFechaManual(fecha)
    if (!fecha || !lectura) return
    const hasta =
      lectura.necesitaPeriodo === 'SEMANA'
        ? new Date(Date.parse(fecha) + 6 * 86_400_000).toISOString().slice(0, 10)
        : fecha
    const r = leerVentasCsv(texto, `periodo-${fecha}-${hasta}.csv`)
    setLectura(r)
    setPuntos(r.filas.map(() => (todos || undefined)))
  }

  /** Un día ya registrado en esa tienda no se duplica: se avisa y se salta. */
  const yaExiste = (centroCosteId: string, fecha: string) =>
    ventasExistentes.some((v) => !v.anuladoEn && v.centroCosteId === centroCosteId && v.fecha === fecha)

  const listas = (lectura?.filas ?? []).map((f, i) => ({
    fila: f,
    centroCosteId: puntos[i],
    duplicada: puntos[i] ? yaExiste(puntos[i]!, f.fecha) : false,
  }))
  const importables = listas.filter((l) => l.centroCosteId && !l.duplicada)
  const hayTarjeta = listas.some((l) => l.fila.cobros.some((c) => c.forma === 'TARJETA'))
  const datafonosTienda = datafonosDe(config.datafonos, todos || undefined)
  const principal = datafonoPrincipal(config.datafonos, todos || undefined)
  const sinPunto = listas.filter((l) => !l.centroCosteId).length
  const duplicadas = listas.filter((l) => l.duplicada).length

  const aplicar = () => {
    const tIva = config.tiposIva.find((t) => t.porDefecto) ?? config.tiposIva[0]
    const ventas: Venta[] = importables.map(({ fila, centroCosteId }) => {
      const { base, cuota } = baseYCuota(fila, tipoDefecto)
      const datafono = datafonoElegido ? config.datafonos.find((d) => d.id === datafonoElegido) : datafonoPrincipal(config.datafonos, centroCosteId)
      return {
        id: nuevoId(),
        creadoEn: new Date().toISOString(),
        creadoPor: 'sistema',
        origen: 'CSV',
        centroCosteId: centroCosteId!,
        fecha: fila.fecha,
        lineasIva: [{ base, tipoIvaId: tIva.id, tipo: fila.tipoIva ?? tIva.tipo, regimen: tIva.regimen, cuota }],
        // El cobro con tarjeta se asigna al datáfono de esa tienda.
        cobros: fila.cobros.map((c) => (c.forma === 'TARJETA' ? { ...c, datafonoId: datafono?.id } : c)),
        numTickets: fila.numTickets ?? 0,
        unidades: fila.unidades ?? 0,
        cerrado: false,
      }
    })
    onImportar(ventas)
    setLectura(null)
  }

  return (
    <>
      <Boton variante="secundario" onClick={() => ref.current?.click()}>Importar CSV</Boton>
      <input ref={ref} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void elegir(f) }} />
      {error && <span className="ml-2 text-xs" style={{ color: 'var(--neg)' }}>{error}</span>}

      {lectura && (
        <Modal titulo={`Importar ventas · ${nombre}`} onCerrar={() => setLectura(null)}>
          <div className="space-y-3">
            {lectura.origen === 'SQUARE_SEMANAL' && (
              <p className="text-xs font-medium">Informe «Resumen de ventas» de Square, por día de la semana.</p>
            )}
            {lectura.origen === 'SQUARE_RESUMEN' && (
              <p className="text-xs font-medium">Resumen de ventas de Square, de un solo día.</p>
            )}
            {lectura.columnas.length > 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Columnas reconocidas — {lectura.columnas.join(' · ')}
              </p>
            )}

            {/* El informe de Square no dice de qué tienda es y todos los días
                son de la misma: se elige una vez, no siete. */}
            {listas.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: 'var(--surface-2)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Punto de venta:</span>
                <select
                  value={todos}
                  onChange={(e) => { setTodos(e.target.value); if (e.target.value) setPuntos((p) => p.map(() => e.target.value)) }}
                  className="rounded-lg px-2 py-1 text-xs"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <option value="">— elegir —</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Con qué datáfono entran los cobros con tarjeta. Se propone el
                principal de la tienda elegida y se puede cambiar aquí. */}
            {hayTarjeta && todos && (
              <div className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: 'var(--surface-2)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Los cobros con tarjeta entran por:</span>
                {datafonosTienda.length === 0 ? (
                  <span className="text-xs" style={{ color: 'var(--warn)' }}>
                    esa tienda no tiene datáfono; quedarán sin asignar
                  </span>
                ) : (
                  <select
                    value={datafonoElegido || (principal?.id ?? '')}
                    onChange={(e) => setDatafonoElegido(e.target.value)}
                    className="rounded-lg px-2 py-1 text-xs"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    {datafonosTienda.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre} · {d.banco}{d.principal ? ' (principal)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {lectura.necesitaPeriodo && (
              <div className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: 'var(--surface-2)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {lectura.necesitaPeriodo === 'SEMANA' ? 'Primer día de la semana:' : 'Fecha de este resumen:'}
                </span>
                <input
                  type="date"
                  value={fechaManual}
                  onChange={(e) => ponerFecha(e.target.value)}
                  className="rounded-lg px-2 py-1 text-xs"
                  style={{ background: 'var(--surface)', border: '1px solid var(--warn)', color: 'var(--text)' }}
                />
              </div>
            )}

            {lectura.avisos.map((a) => (
              <p key={a} className="text-xs" style={{ color: 'var(--warn)' }}>· {a}</p>
            ))}

            <div className="flex flex-wrap gap-2">
              <Semaforo estado={importables.length > 0 ? 'positivo' : 'neutro'} texto={`${importables.length} ${importables.length === 1 ? 'día' : 'días'} a importar`} />
              {sinPunto > 0 && <Semaforo estado="atencion" texto={`${sinPunto} sin punto de venta`} />}
              {duplicadas > 0 && <Semaforo estado="atencion" texto={`${duplicadas} ya registrados`} />}
              {lectura.descartadas.length > 0 && <Semaforo estado="negativo" texto={`${lectura.descartadas.length} descartadas`} />}
            </div>

            {listas.length > 0 && (
              <div className="overflow-auto" style={{ maxHeight: 320 }}>
                <table className="w-full text-sm" style={{ minWidth: todos ? undefined : 640 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                      <th className="py-2 pr-3 font-medium">Fecha</th>
                      {!todos && <th className="py-2 pr-3 font-medium">Punto de venta</th>}
                      <th className="py-2 pr-3 font-medium text-right">Base</th>
                      <th className="py-2 pr-3 font-medium text-right">IVA</th>
                      <th className="py-2 pr-3 font-medium">Cobros</th>
                      <th className="py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {listas.map((l, i) => {
                      const { base, cuota, desglosado } = baseYCuota(l.fila, tipoDefecto)
                      return (
                        <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                          <td className="py-1.5 pr-3 tabular">{formatearFecha(l.fila.fecha)}</td>
                          {/* Con la tienda ya elegida arriba, repetirla en cada
                              fila solo estorba y descuadra la tabla. */}
                          {!todos && (
                            <td className="py-1.5 pr-3">
                              <select
                                value={l.centroCosteId ?? ''}
                                onChange={(e) => setPuntos((p) => p.map((v, j) => (j === i ? e.target.value || undefined : v)))}
                                className="rounded-lg px-2 py-1 text-xs"
                                style={{ background: 'var(--surface-2)', border: `1px solid ${l.centroCosteId ? 'var(--border)' : 'var(--warn)'}`, color: 'var(--text)' }}
                              >
                                <option value="">— elige la tienda —</option>
                                {centros.map((c: CentroCoste) => (
                                  <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                              </select>
                              {l.fila.puntoTexto && !l.centroCosteId && (
                                <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>en el fichero: «{l.fila.puntoTexto}»</span>
                              )}
                            </td>
                          )}
                          <td className="py-1.5 pr-3 text-right"><ImporteEuro valor={base} /></td>
                          <td className="py-1.5 pr-3 text-right">
                            <ImporteEuro valor={cuota} />
                            {desglosado && <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>desglosado</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {l.fila.cobros.length > 0
                              ? l.fila.cobros.map((c) => `${ETIQUETA_COBRO[c.forma] ?? c.forma} ${formatearEuro(c.importe)}`).join(' · ')
                              : '—'}
                          </td>
                          <td className="py-1.5 text-xs" style={{ color: 'var(--warn)' }}>{l.duplicada ? 'ya registrado' : ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {lectura.descartadas.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer" style={{ color: 'var(--text-muted)' }}>Ver las {lectura.descartadas.length} filas descartadas</summary>
                <ul className="mt-2 space-y-1">
                  {lectura.descartadas.slice(0, 40).map((d) => (
                    <li key={d.linea} style={{ color: 'var(--text-muted)' }}>
                      Línea {d.linea}: <strong>{d.motivo}</strong> — {d.texto.slice(0, 90)}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Los días entran como <strong>borrador</strong>, sin cerrar: revísalos y ciérralos uno a uno cuando cuadren.
            </p>

            <div className="flex justify-end gap-2">
              <Boton variante="secundario" onClick={() => setLectura(null)}>Cancelar</Boton>
              <Boton onClick={aplicar}>Importar {importables.length} {importables.length === 1 ? 'día' : 'días'}</Boton>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
