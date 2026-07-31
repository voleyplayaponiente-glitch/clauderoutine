import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, Semaforo } from '../componentes/ui'
import { Campo, Select } from '../componentes/formularios'
import { formatearFecha } from '../lib/fechas'
import { nuevoId } from '../dominio/id'
import { DESTINOS, destinoPorId, sugerirMapeo, validarFila, type FilaValidada } from '../dominio/importacion'
import { leerFichero, construirEntidad, claveDuplicado, clavesExistentes, type FicheroLeido } from '../lib/importacion'
import type { LoteImportacion } from '../dominio/tipos'

type Paso = 1 | 2 | 3 | 4

export function Importacion() {
  const config = useStore((s) => s.config)
  const datos = useStore((s) => s.datos)
  const aplicarImportacion = useStore((s) => s.aplicarImportacion)
  const deshacerImportacion = useStore((s) => s.deshacerImportacion)
  const guardarPlantilla = useStore((s) => s.guardarPlantilla)

  const [paso, setPaso] = useState<Paso>(1)
  const [destinoId, setDestinoId] = useState('articulos')
  const [cuentaId, setCuentaId] = useState('')
  const [fichero, setFichero] = useState<FicheroLeido | null>(null)
  const [filas, setFilas] = useState<string[][]>([])
  const [mapeo, setMapeo] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [omitirDup, setOmitirDup] = useState(true)
  const [lote, setLote] = useState<LoteImportacion | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const def = destinoPorId(destinoId)!
  const cuentasBanco = datos.cuentasTesoreria.filter((c) => c.tipo !== 'CAJA' && !c.anuladoEn)

  const reset = () => { setPaso(1); setFichero(null); setFilas([]); setMapeo({}); setError(null); setLote(null) }

  const onFichero = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    try {
      const leido = await leerFichero(f)
      setFichero({ ...leido, nombre: f.name } as any)
      setFilas(leido.filas)
      setMapeo(sugerirMapeo(leido.cabeceras, def))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el fichero')
      setFichero(null)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const aplicarPlantilla = (id: string) => {
    const p = config.plantillasImportacion.find((x) => x.id === id)
    if (p) setMapeo({ ...p.mapeo })
  }
  const guardarComoPlantilla = () => {
    const nombre = window.prompt('Nombre de la plantilla:')
    if (nombre?.trim()) guardarPlantilla({ id: nuevoId(), nombre: nombre.trim(), destinoId, mapeo })
  }

  // Validación de todas las filas (paso 3).
  const ctx = { cuentaId }
  const existentes = useMemo(() => clavesExistentes(destinoId, datos, ctx), [destinoId, datos, cuentaId])
  const validadas: FilaValidada[] = useMemo(() => {
    const vistas = new Set<string>()
    return filas.map((fila) => {
      const r = validarFila(fila, def, mapeo)
      if (r.estado !== 'error') {
        const clave = claveDuplicado(destinoId, r.valores, ctx)
        const dup = existentes.has(clave) || vistas.has(clave)
        vistas.add(clave)
        if (dup) return { ...r, estado: 'aviso', duplicado: true, mensajes: [...r.mensajes, 'Duplicado'] }
      }
      return r
    })
  }, [filas, def, mapeo, destinoId, existentes, cuentaId])

  const cuenta = { ok: 0, aviso: 0, error: 0, dup: 0 }
  for (const v of validadas) {
    cuenta[v.estado]++
    if (v.duplicado) cuenta.dup++
  }
  const aImportar = validadas.filter((v) => v.estado === 'ok' || (v.estado === 'aviso' && !(v.duplicado && omitirDup)))

  const editarCelda = (filaIdx: number, colIdx: number, valor: string) => {
    setFilas((prev) => {
      const copia = prev.map((f) => f.slice())
      while (copia[filaIdx].length <= colIdx) copia[filaIdx].push('')
      copia[filaIdx][colIdx] = valor
      return copia
    })
  }

  const importar = () => {
    const entidades = aImportar.map((v) => construirEntidad(destinoId, v.valores, fichero!.origen, ctx))
    const l = aplicarImportacion(destinoId, entidades, (fichero as any).nombre ?? 'importación')
    setLote(l)
    setPaso(4)
  }

  const puedeAvanzarMapeo = def.campos.filter((c) => c.obligatorio).every((c) => (mapeo[c.key] ?? -1) >= 0)
  const necesitaCuenta = destinoId === 'movimientos-banco'

  return (
    <>
      <CabeceraPantalla titulo="Importación" descripcion="Carga masiva desde Excel o CSV en cuatro pasos: subida, mapeo, previsualización e importación." />

      <Pasos paso={paso} />

      {/* Paso 1: subida */}
      {paso === 1 && (
        <div className="space-y-4">
          <Tarjeta>
            <h3 className="font-semibold mb-3">1 · Qué quieres importar</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {DESTINOS.map((d) => (
                <button key={d.id} onClick={() => { setDestinoId(d.id); setFichero(null); setFilas([]) }} className="text-left rounded-xl p-3 transition-colors" style={{ border: `1px solid ${destinoId === d.id ? 'var(--color-brand-500)' : 'var(--border)'}`, background: destinoId === d.id ? 'var(--surface-2)' : 'var(--surface)' }}>
                  <div className="font-medium text-sm">{d.nombre}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{d.descripcion}</div>
                </button>
              ))}
            </div>
            {necesitaCuenta && (
              <div className="mt-4 max-w-sm">
                <Select etiqueta="Cuenta bancaria destino" valor={cuentaId} onChange={setCuentaId} opciones={[{ valor: '', texto: '— Selecciona —' }, ...cuentasBanco.map((c) => ({ valor: c.id, texto: c.nombre }))]} />
              </div>
            )}
          </Tarjeta>

          <Tarjeta>
            <h3 className="font-semibold mb-3">Sube el fichero</h3>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Excel (.xlsx, .xls) o CSV. La primera fila debe contener las cabeceras. Los PDF de factura se completan a mano junto al documento.</p>
            <Boton variante="secundario" onClick={() => fileRef.current?.click()}>Elegir fichero…</Boton>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt,.pdf" className="hidden" onChange={onFichero} />
            {error && <div className="mt-3"><Semaforo estado="negativo" texto={error} /></div>}
            {fichero && (
              <div className="mt-4 flex items-center justify-between">
                <Semaforo estado="positivo" texto={`${(fichero as any).nombre}: ${filas.length} filas · ${fichero.cabeceras.length} columnas`} />
                <Boton onClick={() => setPaso(2)}>Siguiente: mapear →</Boton>
              </div>
            )}
          </Tarjeta>
        </div>
      )}

      {/* Paso 2: mapeo */}
      {paso === 2 && fichero && (
        <Tarjeta>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">2 · Asigna las columnas</h3>
            <div className="flex items-center gap-2">
              {config.plantillasImportacion.filter((p) => p.destinoId === destinoId).length > 0 && (
                <select onChange={(e) => e.target.value && aplicarPlantilla(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} defaultValue="">
                  <option value="">Aplicar plantilla…</option>
                  {config.plantillasImportacion.filter((p) => p.destinoId === destinoId).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              )}
              <button className="text-xs underline" style={{ color: 'var(--color-brand-500)' }} onClick={guardarComoPlantilla}>Guardar plantilla</button>
            </div>
          </div>
          <div className="space-y-2">
            {def.campos.map((campo) => (
              <div key={campo.key} className="flex items-center gap-3">
                <span className="w-40 text-sm">{campo.etiqueta}{campo.obligatorio && <span style={{ color: 'var(--neg)' }}> *</span>}</span>
                <select value={mapeo[campo.key] ?? -1} onChange={(e) => setMapeo({ ...mapeo, [campo.key]: Number(e.target.value) })} className="flex-1 rounded-lg px-2.5 py-1.5 text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <option value={-1}>— Ninguna —</option>
                  {fichero.cabeceras.map((c, i) => <option key={i} value={i}>{c || `Columna ${i + 1}`}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-5">
            <Boton variante="secundario" onClick={() => setPaso(1)}>← Atrás</Boton>
            <Boton onClick={() => setPaso(3)}>Siguiente: previsualizar →</Boton>
          </div>
          {!puedeAvanzarMapeo && <p className="text-xs text-right mt-2" style={{ color: 'var(--warn)' }}>Asigna todos los campos obligatorios (*).</p>}
        </Tarjeta>
      )}

      {/* Paso 3: previsualización */}
      {paso === 3 && fichero && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Semaforo estado="positivo" texto={`${cuenta.ok} correctas`} />
            <Semaforo estado="atencion" texto={`${cuenta.aviso} con aviso`} />
            <Semaforo estado="negativo" texto={`${cuenta.error} con error`} />
            {cuenta.dup > 0 && <label className="flex items-center gap-1.5 text-sm ml-2"><input type="checkbox" checked={omitirDup} onChange={(e) => setOmitirDup(e.target.checked)} /> Omitir {cuenta.dup} duplicados</label>}
          </div>
          <Tarjeta className="!p-0 overflow-hidden">
            <div className="overflow-x-auto max-h-[55vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: 'var(--surface)' }}>
                  <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                    <th className="px-3 py-2 font-medium">#</th>
                    {def.campos.map((c) => <th key={c.key} className="px-3 py-2 font-medium">{c.etiqueta}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {validadas.map((v, i) => {
                    const color = v.estado === 'error' ? 'rgba(255,69,58,.10)' : v.estado === 'aviso' ? 'rgba(255,159,10,.10)' : 'transparent'
                    return (
                      <tr key={i} className="border-t" style={{ borderColor: 'var(--border)', background: color }}>
                        <td className="px-3 py-1.5 tabular" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        {def.campos.map((campo) => {
                          const idx = mapeo[campo.key] ?? -1
                          const celda = v.celdas[campo.key]
                          return (
                            <td key={campo.key} className="px-2 py-1">
                              <input
                                value={idx >= 0 ? (filas[i]?.[idx] ?? '') : ''}
                                disabled={idx < 0}
                                onChange={(e) => idx >= 0 && editarCelda(i, idx, e.target.value)}
                                className="w-full min-w-[90px] rounded px-1.5 py-1 text-sm"
                                style={{ background: celda.error ? 'rgba(255,69,58,.12)' : 'var(--surface-2)', border: `1px solid ${celda.error ? 'var(--neg)' : 'var(--border)'}`, color: 'var(--text)' }}
                                title={celda.error}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Tarjeta>
          <div className="flex justify-between">
            <Boton variante="secundario" onClick={() => setPaso(2)}>← Atrás</Boton>
            <Boton onClick={importar}>Importar {aImportar.length} filas</Boton>
          </div>
          {cuenta.error > 0 && <p className="text-xs text-right" style={{ color: 'var(--warn)' }}>Las {cuenta.error} filas en rojo se omiten. Corrígelas en la tabla para incluirlas.</p>}
        </div>
      )}

      {/* Paso 4: hecho */}
      {paso === 4 && lote && (
        <Tarjeta>
          <div className="text-center py-6">
            <div className="text-lg font-semibold mb-2">Importación completada</div>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Se importaron {lote.ids.length} registros de «{lote.nombreFichero}».</p>
            <div className="flex items-center justify-center gap-2">
              <Boton variante="secundario" onClick={() => { deshacerImportacion(lote.id); reset() }}>Deshacer importación</Boton>
              <Boton onClick={reset}>Importar otro fichero</Boton>
            </div>
          </div>
        </Tarjeta>
      )}

      {/* Historial de importaciones */}
      {paso === 1 && datos.importaciones.length > 0 && (
        <Tarjeta className="mt-4">
          <h3 className="font-semibold mb-3">Importaciones recientes</h3>
          <div className="space-y-2">
            {[...datos.importaciones].reverse().slice(0, 8).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                <span>{formatearFecha(l.fecha.slice(0, 10))} · {destinoPorId(l.destinoId)?.nombre} · {l.ids.length} registros · {l.nombreFichero}</span>
                <button className="underline text-xs" style={{ color: 'var(--neg)' }} onClick={() => deshacerImportacion(l.id)}>Deshacer</button>
              </div>
            ))}
          </div>
        </Tarjeta>
      )}
    </>
  )
}

function Pasos({ paso }: { paso: Paso }) {
  const nombres = ['Subida', 'Mapeo', 'Previsualización', 'Hecho']
  return (
    <div className="flex items-center gap-2 mb-6">
      {nombres.map((n, i) => {
        const num = (i + 1) as Paso
        const activo = paso === num
        const hecho = paso > num
        return (
          <div key={n} className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold" style={{ background: activo || hecho ? 'var(--color-brand-500)' : 'var(--surface-2)', color: activo || hecho ? '#fff' : 'var(--text-muted)' }}>{i + 1}</span>
            <span className="text-sm" style={{ color: activo ? 'var(--text)' : 'var(--text-muted)', fontWeight: activo ? 600 : 400 }}>{n}</span>
            {i < 3 && <span className="w-6 h-px" style={{ background: 'var(--border)' }} />}
          </div>
        )
      })}
    </div>
  )
}
