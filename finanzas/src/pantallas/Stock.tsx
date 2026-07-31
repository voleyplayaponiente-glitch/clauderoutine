import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../componentes/ui'
import { Campo, CampoNumero, Select, Toggle, Modal } from '../componentes/formularios'
import { hoyISO, formatearFecha } from '../lib/fechas'
import { nuevoId } from '../dominio/id'
import { formatearEuro } from '../dominio/dinero'
import { existenciaEn, existenciaTotal } from '../dominio/valoracion'
import { resumenArticulo, totalesInventario, esStockMuerto } from '../dominio/stock'
import { calcularRegularizacion } from '../dominio/inventario'
import type { Almacen, Articulo, MovimientoStock, TipoMovStock, TipoAlmacen } from '../dominio/tipos'

const TABS = [
  { id: 'articulos', texto: 'Artículos' },
  { id: 'movimientos', texto: 'Movimientos' },
  { id: 'inventario', texto: 'Inventario' },
  { id: 'almacenes', texto: 'Almacenes' },
] as const

export function Stock() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('articulos')
  const almacenes = useStore((s) => s.datos.almacenes).filter((a) => !a.anuladoEn)

  return (
    <>
      <CabeceraPantalla titulo="Stock" descripcion="Maestro de artículos, multi-almacén, valoración a coste medio e inventario." />
      {almacenes.length === 0 ? (
        <AvisoSinAlmacen />
      ) : (
        <>
          <div className="flex gap-1 mb-6 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }} role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="px-3.5 py-2 text-sm whitespace-nowrap rounded-t-lg" style={{ color: tab === t.id ? 'var(--text)' : 'var(--text-muted)', fontWeight: tab === t.id ? 600 : 400, borderBottom: tab === t.id ? '2px solid var(--color-brand-500)' : '2px solid transparent' }}>{t.texto}</button>
            ))}
          </div>
          {tab === 'articulos' && <TabArticulos />}
          {tab === 'movimientos' && <TabMovimientos />}
          {tab === 'inventario' && <TabInventario />}
          {tab === 'almacenes' && <TabAlmacenes />}
        </>
      )}
    </>
  )
}

function AvisoSinAlmacen() {
  const guardarAlmacen = useStore((s) => s.guardarAlmacen)
  const crear = () => guardarAlmacen({ id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL', nombre: 'Almacén central', tipo: 'CENTRAL' })
  return (
    <Tarjeta>
      <EstadoVacio icono="stock" titulo="Empieza creando un almacén" descripcion="El stock se controla por almacén (central, tienda, tránsito). Crea al menos uno y podrás dar de alta artículos y registrar movimientos." accion={<Boton onClick={crear}>Crear almacén central</Boton>} />
    </Tarjeta>
  )
}

// ─────────────────────────── Artículos ───────────────────────────

function articuloNuevo(proveedorId?: string): Articulo {
  return { id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL', referencia: '', descripcion: '', pvp: 0, stockMinimo: 0, stockOptimo: 0, proveedorPrincipalId: proveedorId }
}

function TabArticulos() {
  const config = useStore((s) => s.config)
  const datos = useStore((s) => s.datos)
  const guardarArticulo = useStore((s) => s.guardarArticulo)
  const anularArticulo = useStore((s) => s.anularArticulo)
  const almacenIds = datos.almacenes.filter((a) => !a.anuladoEn).map((a) => a.id)
  const articulos = datos.articulos.filter((a) => !a.anuladoEn)
  const [edit, setEdit] = useState<Articulo | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const resumenes = useMemo(
    () => articulos.map((a) => resumenArticulo(a, datos.movimientosStock, almacenIds)),
    [articulos, datos.movimientosStock, almacenIds],
  )
  const tot = totalesInventario(resumenes)
  const q = busqueda.trim().toLowerCase()
  const filtrados = q ? resumenes.filter((r) => r.articulo.referencia.toLowerCase().includes(q) || r.articulo.descripcion.toLowerCase().includes(q)) : resumenes

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Valor a coste</div><div className="text-lg font-semibold"><ImporteEuro valor={tot.valorCoste} /></div></Tarjeta>
        <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Valor a PVP</div><div className="text-lg font-semibold"><ImporteEuro valor={tot.valorPvp} /></div></Tarjeta>
        <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Referencias</div><div className="text-lg font-semibold tabular">{tot.referencias}</div></Tarjeta>
        <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Bajo mínimo</div><div className="text-lg font-semibold tabular" style={{ color: tot.bajoMinimo > 0 ? 'var(--warn)' : 'var(--text)' }}>{tot.bajoMinimo}</div></Tarjeta>
      </div>

      <div className="flex items-center gap-2 justify-between">
        <div className="flex-1 max-w-sm"><Campo etiqueta="" valor={busqueda} onChange={setBusqueda} placeholder="Buscar referencia o descripción…" /></div>
        <Boton onClick={() => setEdit(articuloNuevo())}>+ Artículo</Boton>
      </div>

      {articulos.length === 0 ? (
        <Tarjeta><EstadoVacio icono="stock" titulo="Aún no hay artículos" descripcion="Da de alta tu maestro de artículos con referencia, PVP, stock mínimo e impuesto especial si aplica." accion={<Boton onClick={() => setEdit(articuloNuevo())}>Añadir el primero</Boton>} /></Tarjeta>
      ) : (
        <Tarjeta className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left"><th className="px-4 py-2.5 font-medium">Ref.</th><th className="px-4 py-2.5 font-medium">Descripción</th><th className="px-4 py-2.5 font-medium text-right">Stock</th><th className="px-4 py-2.5 font-medium text-right">Coste medio</th><th className="px-4 py-2.5 font-medium text-right">Valor</th><th className="px-4 py-2.5 font-medium">Alertas</th><th className="px-4 py-2.5"></th></tr></thead>
              <tbody>
                {filtrados.map((r) => {
                  const muerto = esStockMuerto(r, datos.movimientosStock, hoyISO(), config.umbrales.diasStockMuerto)
                  return (
                    <tr key={r.articulo.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2.5 tabular font-medium">{r.articulo.referencia}</td>
                      <td className="px-4 py-2.5">{r.articulo.descripcion}{r.articulo.contenidoMl ? <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>· {r.articulo.contenidoMl} ml</span> : null}</td>
                      <td className="px-4 py-2.5 text-right tabular">{r.cantidad}</td>
                      <td className="px-4 py-2.5 text-right"><ImporteEuro valor={r.costeMedio} /></td>
                      <td className="px-4 py-2.5 text-right"><ImporteEuro valor={r.valorCoste} /></td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1 flex-wrap">
                          {r.bajoMinimo && <Semaforo estado="atencion" texto="Bajo mínimo" />}
                          {muerto && <Semaforo estado="negativo" texto="Stock muerto" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button className="underline text-xs mr-3" onClick={() => setEdit({ ...r.articulo })}>Editar</button>
                        <button className="underline text-xs" style={{ color: 'var(--neg)' }} onClick={() => anularArticulo(r.articulo.id)}>Anular</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      {edit && (
        <Modal titulo={edit.referencia ? `Editar ${edit.referencia}` : 'Nuevo artículo'} onCerrar={() => setEdit(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Campo etiqueta="Referencia" valor={edit.referencia} onChange={(v) => setEdit({ ...edit, referencia: v })} autoFocus />
              <Campo etiqueta="EAN" valor={edit.ean ?? ''} onChange={(v) => setEdit({ ...edit, ean: v })} />
            </div>
            <Campo etiqueta="Descripción" valor={edit.descripcion} onChange={(v) => setEdit({ ...edit, descripcion: v })} />
            <div className="grid grid-cols-2 gap-4">
              <Campo etiqueta="Familia" valor={edit.familia ?? ''} onChange={(v) => setEdit({ ...edit, familia: v })} />
              <Campo etiqueta="Subfamilia" valor={edit.subfamilia ?? ''} onChange={(v) => setEdit({ ...edit, subfamilia: v })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <CampoNumero etiqueta="PVP" valor={edit.pvp} onChange={(v) => setEdit({ ...edit, pvp: v })} sufijo="€" />
              <CampoNumero etiqueta="Stock mínimo" valor={edit.stockMinimo} onChange={(v) => setEdit({ ...edit, stockMinimo: v })} />
              <CampoNumero etiqueta="Stock óptimo" valor={edit.stockOptimo} onChange={(v) => setEdit({ ...edit, stockOptimo: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select etiqueta="Proveedor principal" valor={edit.proveedorPrincipalId ?? ''} onChange={(v) => setEdit({ ...edit, proveedorPrincipalId: v || undefined })} opciones={[{ valor: '', texto: '—' }, ...datos.terceros.filter((t) => !t.anuladoEn).map((t) => ({ valor: t.id, texto: t.nombre }))]} />
              <Select etiqueta="Impuesto especial" valor={edit.impuestoEspecialId ?? ''} onChange={(v) => setEdit({ ...edit, impuestoEspecialId: v || undefined })} opciones={[{ valor: '', texto: 'Ninguno' }, ...config.impuestosEspeciales.map((i) => ({ valor: i.id, texto: i.nombre }))]} />
            </div>
            {edit.impuestoEspecialId && <CampoNumero etiqueta="Contenido (ml)" valor={edit.contenidoMl ?? 0} onChange={(v) => setEdit({ ...edit, contenidoMl: v })} sufijo="ml" ayuda="Para calcular el impuesto especial por mililitro." />}
            <div className="flex justify-end gap-2 pt-1"><Boton variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton><Boton onClick={() => { if (edit.referencia.trim()) { guardarArticulo(edit); setEdit(null) } }}>Guardar</Boton></div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────── Movimientos ───────────────────────────

const TIPOS_MOV: { valor: TipoMovStock; texto: string; entrada: boolean | 'traspaso' }[] = [
  { valor: 'COMPRA', texto: 'Entrada por compra', entrada: true },
  { valor: 'APERTURA', texto: 'Aprovisionamiento de apertura', entrada: true },
  { valor: 'VENTA', texto: 'Salida por venta', entrada: false },
  { valor: 'MERMA', texto: 'Merma', entrada: false },
  { valor: 'ROTURA', texto: 'Rotura', entrada: false },
  { valor: 'AUTOCONSUMO', texto: 'Autoconsumo', entrada: false },
  { valor: 'TRASPASO', texto: 'Traspaso entre almacenes', entrada: 'traspaso' },
]

function TabMovimientos() {
  const datos = useStore((s) => s.datos)
  const guardarMovimientoStock = useStore((s) => s.guardarMovimientoStock)
  const guardarMovimientosStock = useStore((s) => s.guardarMovimientosStock)
  const anular = useStore((s) => s.anularMovimientoStock)
  const almacenes = datos.almacenes.filter((a) => !a.anuladoEn)
  const articulos = datos.articulos.filter((a) => !a.anuladoEn)
  const [abierto, setAbierto] = useState(false)

  const [f, setF] = useState(() => ({ tipo: 'COMPRA' as TipoMovStock, articuloId: articulos[0]?.id ?? '', almacenId: almacenes[0]?.id ?? '', almacenDestinoId: almacenes[1]?.id ?? almacenes[0]?.id ?? '', fecha: hoyISO(), cantidad: 0, costeUnitario: 0, motivo: '' }))

  const nombreArt = (id: string) => articulos.find((a) => a.id === id)?.referencia ?? '—'
  const nombreAlm = (id: string) => almacenes.find((a) => a.id === id)?.nombre ?? '—'

  const movs = useMemo(() => datos.movimientosStock.filter((m) => !m.anuladoEn).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 200), [datos.movimientosStock])

  const guardar = () => {
    if (!f.articuloId || !f.almacenId || f.cantidad <= 0) return
    const def = TIPOS_MOV.find((t) => t.valor === f.tipo)!
    const stamp = () => ({ id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL' as const, articuloId: f.articuloId, fecha: f.fecha, tipo: f.tipo, costeUnitario: f.costeUnitario, esAprovisionamientoApertura: f.tipo === 'APERTURA', motivo: f.motivo || undefined })
    if (def.entrada === 'traspaso') {
      if (f.almacenDestinoId === f.almacenId) return
      const coste = existenciaEn(f.articuloId, f.almacenId, datos.movimientosStock).costeMedio
      const parejaId = nuevoId()
      const salida: MovimientoStock = { ...stamp(), id: nuevoId(), almacenId: f.almacenId, cantidad: -Math.abs(f.cantidad), costeUnitario: coste, traspasoParejaId: parejaId }
      const entrada: MovimientoStock = { ...stamp(), id: parejaId, almacenId: f.almacenDestinoId, cantidad: Math.abs(f.cantidad), costeUnitario: coste, traspasoParejaId: salida.id }
      guardarMovimientosStock([salida, entrada])
    } else {
      const signo = def.entrada ? 1 : -1
      guardarMovimientoStock({ ...stamp(), almacenId: f.almacenId, cantidad: signo * Math.abs(f.cantidad) })
    }
    setAbierto(false)
    setF({ ...f, cantidad: 0, costeUnitario: 0, motivo: '' })
  }

  const esTraspaso = TIPOS_MOV.find((t) => t.valor === f.tipo)?.entrada === 'traspaso'
  const esEntrada = TIPOS_MOV.find((t) => t.valor === f.tipo)?.entrada === true

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Boton onClick={() => setAbierto(true)}>+ Movimiento</Boton></div>
      {movs.length === 0 ? (
        <Tarjeta><EstadoVacio icono="importar" titulo="Sin movimientos de stock" descripcion="Registra entradas por compra, salidas por venta, traspasos entre tiendas, mermas y roturas." accion={<Boton onClick={() => setAbierto(true)}>Registrar el primero</Boton>} /></Tarjeta>
      ) : (
        <Tarjeta className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left"><th className="px-4 py-2.5 font-medium">Fecha</th><th className="px-4 py-2.5 font-medium">Artículo</th><th className="px-4 py-2.5 font-medium">Almacén</th><th className="px-4 py-2.5 font-medium">Tipo</th><th className="px-4 py-2.5 font-medium text-right">Cantidad</th><th className="px-4 py-2.5 font-medium text-right">Coste</th><th className="px-4 py-2.5"></th></tr></thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2.5 tabular">{formatearFecha(m.fecha)}</td>
                    <td className="px-4 py-2.5">{nombreArt(m.articuloId)}</td>
                    <td className="px-4 py-2.5">{nombreAlm(m.almacenId)}</td>
                    <td className="px-4 py-2.5">{TIPOS_MOV.find((t) => t.valor === m.tipo)?.texto ?? m.tipo}</td>
                    <td className="px-4 py-2.5 text-right tabular" style={{ color: m.cantidad < 0 ? 'var(--neg)' : 'var(--pos)' }}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</td>
                    <td className="px-4 py-2.5 text-right"><ImporteEuro valor={m.costeUnitario} /></td>
                    <td className="px-4 py-2.5 text-right"><button className="underline text-xs" style={{ color: 'var(--neg)' }} onClick={() => anular(m.id)}>Anular</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      {abierto && (
        <Modal titulo="Movimiento de stock" onCerrar={() => setAbierto(false)}>
          <div className="space-y-4">
            <Select etiqueta="Tipo" valor={f.tipo} onChange={(v) => setF({ ...f, tipo: v })} opciones={TIPOS_MOV.map((t) => ({ valor: t.valor, texto: t.texto }))} />
            <div className="grid grid-cols-2 gap-4">
              <Select etiqueta="Artículo" valor={f.articuloId} onChange={(v) => setF({ ...f, articuloId: v })} opciones={articulos.map((a) => ({ valor: a.id, texto: `${a.referencia} · ${a.descripcion}` }))} />
              <Campo etiqueta="Fecha" valor={f.fecha} onChange={(v) => setF({ ...f, fecha: v })} tipo="date" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select etiqueta={esTraspaso ? 'Almacén origen' : 'Almacén'} valor={f.almacenId} onChange={(v) => setF({ ...f, almacenId: v })} opciones={almacenes.map((a) => ({ valor: a.id, texto: a.nombre }))} />
              {esTraspaso && <Select etiqueta="Almacén destino" valor={f.almacenDestinoId} onChange={(v) => setF({ ...f, almacenDestinoId: v })} opciones={almacenes.map((a) => ({ valor: a.id, texto: a.nombre }))} />}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CampoNumero etiqueta="Cantidad" valor={f.cantidad} onChange={(v) => setF({ ...f, cantidad: v })} />
              {esEntrada && <CampoNumero etiqueta="Coste unitario" valor={f.costeUnitario} onChange={(v) => setF({ ...f, costeUnitario: v })} sufijo="€" />}
            </div>
            {!esEntrada && !esTraspaso && <Campo etiqueta="Motivo" valor={f.motivo} onChange={(v) => setF({ ...f, motivo: v })} placeholder="Motivo de la salida" />}
            <div className="flex justify-end gap-2 pt-1"><Boton variante="secundario" onClick={() => setAbierto(false)}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────── Inventario ───────────────────────────

function TabInventario() {
  const datos = useStore((s) => s.datos)
  const guardarMovimientosStock = useStore((s) => s.guardarMovimientosStock)
  const almacenes = datos.almacenes.filter((a) => !a.anuladoEn)
  const articulos = datos.articulos.filter((a) => !a.anuladoEn)
  const [almacenId, setAlmacenId] = useState(almacenes[0]?.id ?? '')
  const [contado, setContado] = useState<Record<string, number>>({})
  const [aviso, setAviso] = useState<string | null>(null)

  const filas = articulos.map((a) => {
    const e = existenciaEn(a.id, almacenId, datos.movimientosStock)
    const contadoVal = contado[a.id]
    const dif = contadoVal === undefined ? 0 : contadoVal - e.cantidad
    return { articulo: a, teorica: e.cantidad, costeMedio: e.costeMedio, contado: contadoVal, diferencia: dif }
  })

  const regularizar = () => {
    const movs: MovimientoStock[] = []
    for (const fila of filas) {
      if (fila.contado === undefined) continue
      const reg = calcularRegularizacion(fila.articulo.id, almacenId, fila.contado, datos.movimientosStock)
      if (reg.diferencia === 0) continue
      movs.push({ id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL', articuloId: fila.articulo.id, almacenId, fecha: hoyISO(), tipo: 'REGULARIZACION', cantidad: reg.diferencia, costeUnitario: reg.costeMedio, esAprovisionamientoApertura: false, motivo: 'Regularización por inventario' })
    }
    if (movs.length === 0) { setAviso('No hay diferencias que regularizar.'); return }
    guardarMovimientosStock(movs)
    setContado({})
    setAviso(`Regularizados ${movs.length} artículos. Se generaron los movimientos y su asiento 300/610.`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="w-64"><Select etiqueta="Almacén a inventariar" valor={almacenId} onChange={setAlmacenId} opciones={almacenes.map((a) => ({ valor: a.id, texto: a.nombre }))} /></div>
        <Boton onClick={regularizar}>Regularizar diferencias</Boton>
      </div>
      {aviso && <Semaforo estado="positivo" texto={aviso} />}
      {articulos.length === 0 ? (
        <Tarjeta><EstadoVacio icono="stock" titulo="No hay artículos que inventariar" descripcion="Da de alta artículos en la pestaña Artículos." /></Tarjeta>
      ) : (
        <Tarjeta className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left"><th className="px-4 py-2.5 font-medium">Ref.</th><th className="px-4 py-2.5 font-medium">Descripción</th><th className="px-4 py-2.5 font-medium text-right">Teórico</th><th className="px-4 py-2.5 font-medium text-right">Contado</th><th className="px-4 py-2.5 font-medium text-right">Diferencia</th></tr></thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.articulo.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2.5 tabular font-medium">{fila.articulo.referencia}</td>
                    <td className="px-4 py-2.5">{fila.articulo.descripcion}</td>
                    <td className="px-4 py-2.5 text-right tabular">{fila.teorica}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input type="number" value={fila.contado ?? ''} placeholder="—" className="w-20 rounded-lg px-2 py-1 text-sm tabular text-right" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} onChange={(e) => setContado({ ...contado, [fila.articulo.id]: e.target.value === '' ? undefined as any : Number(e.target.value) })} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular" style={{ color: fila.diferencia === 0 ? 'var(--text-muted)' : fila.diferencia > 0 ? 'var(--pos)' : 'var(--neg)' }}>{fila.contado === undefined ? '' : (fila.diferencia > 0 ? '+' : '') + fila.diferencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </div>
  )
}

// ─────────────────────────── Almacenes ───────────────────────────

const TIPOS_ALM: { valor: TipoAlmacen; texto: string }[] = [
  { valor: 'CENTRAL', texto: 'Central' },
  { valor: 'TIENDA', texto: 'Tienda' },
  { valor: 'TRANSITO', texto: 'Tránsito' },
]

function TabAlmacenes() {
  const config = useStore((s) => s.config)
  const datos = useStore((s) => s.datos)
  const guardarAlmacen = useStore((s) => s.guardarAlmacen)
  const almacenes = datos.almacenes.filter((a) => !a.anuladoEn)
  const [edit, setEdit] = useState<Almacen | null>(null)
  const puntos = config.centrosCoste.filter((c) => c.tipo === 'PUNTO_VENTA' && !c.activoHasta)

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Boton onClick={() => setEdit({ id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL', nombre: '', tipo: 'TIENDA' })}>+ Almacén</Boton></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {almacenes.map((a) => (
          <Tarjeta key={a.id} className="!p-4">
            <div className="font-medium">{a.nombre}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{TIPOS_ALM.find((t) => t.valor === a.tipo)?.texto}{a.puntoVentaId ? ` · ${puntos.find((p) => p.id === a.puntoVentaId)?.nombre ?? ''}` : ''}</div>
            <button className="underline text-xs mt-3" onClick={() => setEdit({ ...a })}>Editar</button>
          </Tarjeta>
        ))}
      </div>
      {edit && (
        <Modal titulo={edit.nombre ? 'Editar almacén' : 'Nuevo almacén'} onCerrar={() => setEdit(null)}>
          <div className="space-y-4">
            <Campo etiqueta="Nombre" valor={edit.nombre} onChange={(v) => setEdit({ ...edit, nombre: v })} autoFocus />
            <Select etiqueta="Tipo" valor={edit.tipo} onChange={(v) => setEdit({ ...edit, tipo: v as TipoAlmacen })} opciones={TIPOS_ALM} />
            <Select etiqueta="Punto de venta (opcional)" valor={edit.puntoVentaId ?? ''} onChange={(v) => setEdit({ ...edit, puntoVentaId: v || undefined })} opciones={[{ valor: '', texto: '—' }, ...puntos.map((p) => ({ valor: p.id, texto: p.nombre }))]} />
            <div className="flex justify-end gap-2 pt-1"><Boton variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton><Boton onClick={() => { if (edit.nombre.trim()) { guardarAlmacen(edit); setEdit(null) } }}>Guardar</Boton></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
