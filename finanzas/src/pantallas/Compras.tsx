import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Proveedores, terceroNuevo } from './Proveedores'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../componentes/ui'
import { Campo, CampoNumero, Select, Toggle, Modal } from '../componentes/formularios'
import { EditorLineasIva } from '../componentes/EditorLineasIva'
import { hoyISO, formatearFecha, mesDe, nombreMes, sumarDias } from '../lib/fechas'
import { nuevoId } from '../dominio/id'
import { totalesCompra } from '../dominio/compras'
import { resumirCompras, categoriasDe } from '../dominio/resumen-compras'
import { extraerDatosFactura, type DatosFactura } from '../dominio/factura-pdf'
import { lineasDePdf } from '../lib/extracto'
import { ResumenMensual } from './compras/ResumenMensual'
import { formatearEuro } from '../dominio/dinero'
import { guardarAdjunto, leerAdjunto, abrirAdjunto } from '../lib/adjuntos'
import type { Compra, Tercero, NaturalezaCompra, FormaPago, EstadoPago, LineaIva } from '../dominio/tipos'

const FORMAS_PAGO: { valor: FormaPago; texto: string }[] = [
  { valor: 'TRANSFERENCIA', texto: 'Transferencia' },
  { valor: 'DOMICILIADO', texto: 'Domiciliado' },
  { valor: 'EFECTIVO', texto: 'Efectivo' },
  { valor: 'TARJETA', texto: 'Tarjeta' },
  { valor: 'APLAZADO', texto: 'Aplazado' },
]
const ESTADOS: { valor: EstadoPago; texto: string }[] = [
  { valor: 'PENDIENTE', texto: 'Pendiente' },
  { valor: 'PARCIAL', texto: 'Parcial' },
  { valor: 'PAGADA', texto: 'Pagada' },
]

function compraNueva(): Compra {
  return {
    id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL',
    naturaleza: 'MERCADERIA', terceroId: '', numFactura: '', fechaFactura: hoyISO(),
    lineasIva: [], retencion: 0, formaPago: 'TRANSFERENCIA', estadoPago: 'PENDIENTE', deducible: true,
  }
}

export function Compras() {
  const [tab, setTab] = useState<'compras' | 'proveedores'>('compras')
  return (
    <>
      <CabeceraPantalla titulo="Compras" descripcion="Compras de mercadería y de servicios, con IVA, deducibilidad y vencimientos." />
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--border)' }} role="tablist">
        {(['compras', 'proveedores'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className="px-3.5 py-2 text-sm capitalize rounded-t-lg"
            style={{ color: tab === t ? 'var(--text)' : 'var(--text-muted)', fontWeight: tab === t ? 600 : 400, borderBottom: tab === t ? '2px solid var(--color-brand-500)' : '2px solid transparent' }}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'compras' ? <ListaCompras /> : <Proveedores />}
    </>
  )
}

function ListaCompras() {
  const config = useStore((s) => s.config)
  const terceros = useStore((s) => s.datos.terceros).filter((t) => !t.anuladoEn)
  const compras = useStore((s) => s.datos.compras).filter((c) => !c.anuladoEn)
  const guardarCompra = useStore((s) => s.guardarCompra)
  const anularCompra = useStore((s) => s.anularCompra)
  const guardarTercero = useStore((s) => s.guardarTercero)
  const empresaId = useStore((s) => s.grupo.empresaActivaId)

  const [editando, setEditando] = useState<Compra | null>(null)
  const [lectura, setLectura] = useState<DatosFactura | null>(null)
  const [leyendoPdf, setLeyendoPdf] = useState(false)
  const pdfRef = useRef<HTMLInputElement>(null)
  const [provNuevo, setProvNuevo] = useState<Tercero | null>(null)

  const nombreProv = (id: string) => terceros.find((t) => t.id === id)?.nombre ?? '—'
  const puntos = config.centrosCoste.filter((c) => !c.activoHasta)
  const tarjetas = config.tarjetas.filter((t) => t.activa)
  const nombreTarjeta = (id?: string) => config.tarjetas.find((t) => t.id === id)?.nombre

  /**
   * Archiva el documento en el espacio de la empresa activa y deja en la compra
   * solo su id: el contenido no viaja en cada escritura de datos.
   */
  const adjuntar = async (f: File, compra?: Compra) => {
    const base = compra ?? editando
    if (!base) return
    const adjuntoId = nuevoId()
    await guardarAdjunto(empresaId, adjuntoId, { nombre: f.name, tipo: f.type || 'application/pdf', datos: await f.arrayBuffer() })
    setEditando({ ...base, adjuntoId, adjuntoNombre: f.name, adjuntoTipo: f.type || 'application/pdf', adjuntoTamano: f.size })
  }

  const verAdjunto = async (c: Compra) => {
    if (!c.adjuntoId) return
    const a = await leerAdjunto(empresaId, c.adjuntoId)
    if (a) abrirAdjunto(a)
  }

  const porMes = useMemo(() => {
    const mapa = new Map<string, Compra[]>()
    for (const c of [...compras].sort((a, b) => b.fechaFactura.localeCompare(a.fechaFactura))) {
      const k = mesDe(c.fechaFactura)
      mapa.set(k, [...(mapa.get(k) ?? []), c])
    }
    return [...mapa.entries()]
  }, [compras])

  const abrirNueva = () => {
    const c = compraNueva()
    if (terceros[0]) c.terceroId = terceros[0].id
    setEditando(c)
  }

  const setNaturaleza = (n: NaturalezaCompra) => {
    if (!editando) return
    setEditando({ ...editando, naturaleza: n, cuentaGasto: n === 'MERCADERIA' ? '600' : editando.cuentaGasto ?? '629' })
  }
  /**
   * La categoría es ahora el campo que manda: de ella salen la naturaleza
   * (stock o gasto), la cuenta contable y si es deducible.
   */
  const esInternacional =
    config.categoriasGasto.find((c) => c.id === editando?.categoriaGastoId)?.esInternacional === true

  const setCategoriaUnica = (categoriaGastoId: string) => {
    if (!editando) return
    const cat = config.categoriasGasto.find((x) => x.id === categoriaGastoId)
    setEditando({
      ...editando,
      categoriaGastoId: categoriaGastoId || undefined,
      naturaleza: cat?.esStock ? 'MERCADERIA' : 'SERVICIO',
      cuentaGasto: cat?.cuentaPGC ?? editando.cuentaGasto,
      deducible: cat?.deduciblePorDefecto ?? editando.deducible,
      // El impuesto especial solo tiene sentido en compra internacional.
      impuestoEspecial: cat?.esInternacional ? (editando.impuestoEspecial ?? 0) : undefined,
    })
  }

  const setCategoria = (categoriaGastoId: string) => {
    if (!editando) return
    const cat = config.categoriasGasto.find((x) => x.id === categoriaGastoId)
    setEditando({ ...editando, categoriaGastoId, cuentaGasto: cat?.cuentaPGC ?? editando.cuentaGasto, deducible: cat?.deduciblePorDefecto ?? editando.deducible })
  }
  const setProveedor = (terceroId: string) => {
    if (!editando) return
    const prov = terceros.find((t) => t.id === terceroId)
    const venc = prov?.condicionesPagoDias ? sumarDias(editando.fechaFactura, prov.condicionesPagoDias) : editando.fechaVencimiento
    setEditando({ ...editando, terceroId, fechaVencimiento: venc })
  }

  /**
   * Lee una factura en PDF y precarga lo que ha encontrado. NO guarda nada:
   * los campos quedan en el formulario para revisarlos.
   */
  const onFacturaPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setLeyendoPdf(true)
    setLectura(null)
    try {
      const lineas = await lineasDePdf(await f.arrayBuffer())
      const d = extraerDatosFactura(lineas, config.empresa.cif)
      setLectura(d)

      const base = editando ?? compraNueva()
      // La factura que se acaba de leer se guarda en el archivo: es el
      // documento de esa compra y luego hay que dárselo a la gestoría.
      const adjuntoId = nuevoId()
      await guardarAdjunto(empresaId, adjuntoId, { nombre: f.name, tipo: f.type || 'application/pdf', datos: await f.arrayBuffer() })
      const tipoIva = d.tipoIva ?? base.lineasIva[0]?.tipo ?? 21
      const tIva = config.tiposIva.find((t) => t.tipo === tipoIva) ?? config.tiposIva.find((t) => t.porDefecto)
      // Solo se tocan los campos realmente leídos: lo demás se respeta.
      const prov = d.cif ? terceros.find((t) => t.cif.toUpperCase().replace(/[\s-]/g, '') === d.cif) : undefined
      setEditando({
        ...base,
        origen: 'PDF',
        adjuntoId,
        adjuntoNombre: f.name,
        adjuntoTipo: f.type || 'application/pdf',
        adjuntoTamano: f.size,
        terceroId: prov?.id ?? base.terceroId,
        numFactura: d.numFactura ?? base.numFactura,
        fechaFactura: d.fecha ?? base.fechaFactura,
        retencion: d.retencion ?? base.retencion,
        lineasIva:
          d.base !== undefined && tIva
            ? [{ base: d.base, tipoIvaId: tIva.id, tipo: tIva.tipo, regimen: tIva.regimen, cuota: d.cuota ?? 0 }]
            : base.lineasIva,
      })
    } catch (err) {
      setLectura({ avisos: [`No se ha podido leer el PDF: ${err instanceof Error ? err.message : 'error'}`], encontrados: [] })
    } finally {
      setLeyendoPdf(false)
      if (pdfRef.current) pdfRef.current.value = ''
    }
  }

  const guardar = () => {
    if (!editando || !editando.terceroId || !editando.numFactura.trim()) return
    guardarCompra(editando)
    setEditando(null)
  }

  const totales = editando ? totalesCompra(editando) : null

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2 mb-4">
        <Boton variante="secundario" onClick={() => pdfRef.current?.click()}>
          {leyendoPdf ? 'Leyendo la factura…' : 'Subir factura en PDF'}
        </Boton>
        <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={onFacturaPdf} />
        <Boton onClick={abrirNueva}>+ Registrar compra</Boton>
      </div>

      <ResumenMensual compras={compras} categorias={config.categoriasGasto} terceros={terceros} empresaId={empresaId} />

      {compras.length === 0 ? (
        <Tarjeta><EstadoVacio icono="compras" titulo="Aún no hay compras registradas" descripcion="Registra facturas de mercadería y de servicios con su IVA, retención, vencimiento y deducibilidad." accion={<Boton onClick={abrirNueva}>Registrar la primera</Boton>} /></Tarjeta>
      ) : (
        <div className="space-y-6">
          {porMes.map(([mes, lista]) => {
            const totalMes = lista.reduce((s, c) => s + totalesCompra(c).total, 0)
            return (
              <div key={mes}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="font-semibold capitalize">{nombreMes(mes)}</h3>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Total <ImporteEuro valor={totalMes} className="font-medium" /></span>
                </div>
                <Tarjeta className="!p-0 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                        <th className="px-4 py-2.5 font-medium">Fecha</th>
                        <th className="px-4 py-2.5 font-medium">Proveedor</th>
                        <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Factura</th>
                        <th className="px-4 py-2.5 font-medium text-right">Total</th>
                        <th className="px-4 py-2.5 font-medium text-center">Estado</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((c) => {
                        const t = totalesCompra(c)
                        return (
                          <tr key={c.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                            <td className="px-4 py-2.5 tabular">{formatearFecha(c.fechaFactura)}</td>
                            <td className="px-4 py-2.5">
                              {nombreProv(c.terceroId)}
                              {!c.deducible && <span className="ml-2 text-xs" style={{ color: 'var(--warn)' }}>· no deducible</span>}
                            </td>
                            <td className="px-4 py-2.5 tabular hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>
                              {c.numFactura}
                              {c.adjuntoId && (
                                <>
                                  {' '}
                                  <button type="button" className="underline not-tabular" style={{ color: 'var(--color-brand-500)' }} onClick={() => void verAdjunto(c)} title={c.adjuntoNombre}>
                                    PDF
                                  </button>
                                </>
                              )}
                              {c.formaPago === 'TARJETA' && nombreTarjeta(c.tarjetaId) && (
                                <span className="block text-xs">{nombreTarjeta(c.tarjetaId)}</span>
                              )}
                              {c.formaPago === 'TARJETA' && !c.tarjetaId && (
                                <span className="block text-xs" style={{ color: 'var(--warn)' }}>tarjeta sin indicar</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right"><ImporteEuro valor={t.total} /></td>
                            <td className="px-4 py-2.5 text-center">
                              <Semaforo estado={c.estadoPago === 'PAGADA' ? 'positivo' : c.estadoPago === 'PARCIAL' ? 'atencion' : 'neutro'} texto={ESTADOS.find((e) => e.valor === c.estadoPago)!.texto} />
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <button className="underline text-xs mr-3" onClick={() => setEditando({ ...c })}>Editar</button>
                              <button className="underline text-xs" style={{ color: 'var(--neg)' }} onClick={() => anularCompra(c.id)}>Anular</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </Tarjeta>
              </div>
            )
          })}
        </div>
      )}

      {editando && totales && (
        <Modal titulo="Registrar compra" onCerrar={() => { setEditando(null); setLectura(null) }}>
          <div className="space-y-4">
            {lectura && (
              <div className="rounded-xl p-3 text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
                <p className="font-medium">
                  Leído del PDF: {lectura.encontrados.length > 0 ? lectura.encontrados.join(', ') : 'nada aprovechable'}.
                  {' '}Revísalo antes de guardar.
                </p>
                {(lectura.proveedor || lectura.cif) && !editando.terceroId && (
                  <p style={{ color: 'var(--text-muted)' }}>
                    Proveedor detectado: «{lectura.proveedor ?? lectura.cif}»
                    {lectura.cif && lectura.proveedor ? ` · ${lectura.cif}` : ''} — no está dado de alta.{' '}
                    {/* Se abre el alta con lo leído; sigue habiendo que confirmarlo. */}
                    <button
                      type="button"
                      className="underline"
                      style={{ color: 'var(--color-brand-500)' }}
                      onClick={() => setProvNuevo({ ...terceroNuevo(), nombre: lectura.proveedor ?? '', cif: lectura.cif ?? '' })}
                    >
                      Crear con estos datos
                    </button>{' '}
                    o elígelo de la lista.
                  </p>
                )}
                {lectura.avisos.map((a) => (
                  <p key={a} style={{ color: 'var(--warn)' }}>· {a}</p>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Select
                etiqueta="Naturaleza del gasto"
                valor={editando.categoriaGastoId ?? ''}
                onChange={setCategoriaUnica}
                opciones={[
                  { valor: '', texto: '— Sin clasificar —' },
                  ...categoriasDe(config.categoriasGasto, 'COMPRAS').map((c) => ({ valor: c.id, texto: c.nombre })),
                ]}
              />
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium">Proveedor</span>
                  <button type="button" className="text-xs underline" style={{ color: 'var(--color-brand-500)' }} onClick={() => setProvNuevo(terceroNuevo())}>+ Nuevo</button>
                </div>
                <select value={editando.terceroId} onChange={(e) => setProveedor(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <option value="">— Selecciona —</option>
                  {terceros.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Campo etiqueta="Nº factura" valor={editando.numFactura} onChange={(v) => setEditando({ ...editando, numFactura: v })} />
              <Campo etiqueta="Fecha factura" valor={editando.fechaFactura} onChange={(v) => setEditando({ ...editando, fechaFactura: v })} tipo="date" />
              <Campo etiqueta="Vencimiento" valor={editando.fechaVencimiento ?? ''} onChange={(v) => setEditando({ ...editando, fechaVencimiento: v })} tipo="date" />
            </div>

            <EditorLineasIva lineas={editando.lineasIva} tiposIva={config.tiposIva} onChange={(l: LineaIva[]) => setEditando({ ...editando, lineasIva: l })} />

            <div className="grid grid-cols-2 gap-4">
              <CampoNumero etiqueta="Retención (111/115)" valor={editando.retencion} onChange={(v) => setEditando({ ...editando, retencion: v })} sufijo="€" />
              <Select etiqueta="Centro de coste" valor={editando.centroCosteId ?? ''} onChange={(v) => setEditando({ ...editando, centroCosteId: v || undefined })}
                opciones={[{ valor: '', texto: '— Estructura —' }, ...puntos.map((p) => ({ valor: p.id, texto: p.nombre }))]} />
            </div>

            {esInternacional && (
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                <CampoNumero
                  etiqueta="Impuesto especial soportado"
                  sufijo="€"
                  valor={editando.impuestoEspecial ?? 0}
                  onChange={(v) => setEditando({ ...editando, impuestoEspecial: v })}
                  ayuda="Compra internacional: el impuesto especial de vapeo (modelo 573) suma al coste de la mercancía y se declara aparte."
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Select
                etiqueta="Forma de pago"
                valor={editando.formaPago}
                onChange={(v) => setEditando({ ...editando, formaPago: v, tarjetaId: v === 'TARJETA' ? editando.tarjetaId : undefined })}
                opciones={FORMAS_PAGO}
              />
              <Select etiqueta="Estado" valor={editando.estadoPago} onChange={(v) => setEditando({ ...editando, estadoPago: v })} opciones={ESTADOS} />
            </div>

            {/* Con qué tarjeta: sin esto el cargo no se puede cuadrar con el
                extracto del banco que la emite. */}
            {editando.formaPago === 'TARJETA' && (
              <Select
                etiqueta="¿Con qué tarjeta?"
                valor={editando.tarjetaId ?? ''}
                onChange={(v) => setEditando({ ...editando, tarjetaId: v || undefined })}
                opciones={[
                  { valor: '', texto: '— Indica la tarjeta —' },
                  ...tarjetas.map((t) => ({ valor: t.id, texto: t.ultimos4 ? `${t.nombre} ···${t.ultimos4}` : t.nombre })),
                ]}
              />
            )}

            <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
              <Toggle etiqueta="Gasto deducible" valor={editando.deducible} onChange={(v) => setEditando({ ...editando, deducible: v })} />
              {!editando.deducible && (
                <div className="mt-2">
                  <Campo etiqueta="Motivo de no deducibilidad" valor={editando.motivoNoDeducible ?? ''} onChange={(v) => setEditando({ ...editando, motivoNoDeducible: v })} placeholder="Obligatorio: por qué no es deducible" />
                </div>
              )}
            </div>

            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Documento adjunto</span>
              <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void adjuntar(f) }} className="text-sm" />
              {editando.adjuntoNombre && (
                <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {editando.adjuntoNombre}
                  {editando.adjuntoId ? (
                    <> · <button type="button" className="underline" style={{ color: 'var(--color-brand-500)' }} onClick={() => void verAdjunto(editando)}>ver</button> · guardado en el archivo</>
                  ) : (
                    <> · <span style={{ color: 'var(--warn)' }}>solo se guarda el nombre; vuelve a seleccionarlo para archivarlo</span></>
                  )}
                </span>
              )}
            </label>

            <div className="flex items-center justify-between rounded-xl p-3 text-sm" style={{ background: 'var(--surface-2)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Base {formatearEuro(totales.base)} · IVA {formatearEuro(totales.cuota)}{totales.retencion > 0 ? ` · Ret. −${formatearEuro(totales.retencion)}` : ''}</span>
              <span className="font-semibold tabular">Total {formatearEuro(totales.total)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Boton variante="secundario" onClick={() => setEditando(null)}>Cancelar</Boton>
              <Boton onClick={guardar}>Guardar compra</Boton>
            </div>
            {(!editando.terceroId || !editando.numFactura.trim()) && <p className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>Indica proveedor y nº de factura para guardar.</p>}
          </div>
        </Modal>
      )}

      {/* Alta rápida de proveedor desde la compra */}
      {provNuevo && (
        <Modal titulo="Nuevo proveedor" onCerrar={() => setProvNuevo(null)}>
          <div className="space-y-4">
            <Campo etiqueta="Nombre / Razón social" valor={provNuevo.nombre} onChange={(v) => setProvNuevo({ ...provNuevo, nombre: v })} autoFocus />
            <div className="grid grid-cols-2 gap-4">
              <Campo etiqueta="CIF / NIF" valor={provNuevo.cif} onChange={(v) => setProvNuevo({ ...provNuevo, cif: v.toUpperCase() })} />
              <CampoNumero etiqueta="Pago a" valor={provNuevo.condicionesPagoDias ?? 0} onChange={(v) => setProvNuevo({ ...provNuevo, condicionesPagoDias: v })} sufijo="días" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Boton variante="secundario" onClick={() => setProvNuevo(null)}>Cancelar</Boton>
              <Boton onClick={() => { if (provNuevo.nombre.trim()) { guardarTercero(provNuevo); if (editando) setProveedor(provNuevo.id); setProvNuevo(null) } }}>Crear y usar</Boton>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
