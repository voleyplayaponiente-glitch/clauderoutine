import { useState } from 'react'
import { useStore } from '../../store/store'
import { Campo, Select, Modal } from '../../componentes/formularios'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../../componentes/ui'
import { hoyISO, formatearFecha } from '../../lib/fechas'
import { nuevoId } from '../../dominio/id'
import { CONECTORES, definicionConector, type MovimientoExterno } from '../../dominio/conectores'
import { sincronizar, probarConexion } from '../../lib/conectores'
import type { Conector, ModoConexion, CuentaTesoreria, MovimientoTesoreria } from '../../dominio/tipos'

const MODOS: { valor: ModoConexion; texto: string }[] = [
  { valor: 'DEMO', texto: 'Demostración (datos simulados)' },
  { valor: 'SERVIDOR', texto: 'Servidor propio (Umbrel) — recomendado' },
  { valor: 'DISPOSITIVO', texto: 'Token en este dispositivo' },
]

function conectorNuevo(): Conector {
  return { id: nuevoId(), tipo: 'DEMO', nombre: 'Square (demo)', modo: 'DEMO', activo: true }
}

export function PanelConexiones() {
  const conectores = useStore((s) => s.config.conectores)
  const cuentas = useStore((s) => s.datos.cuentasTesoreria)
  const movimientos = useStore((s) => s.datos.movimientos)
  const logs = useStore((s) => s.datos.logsSync)
  const guardarConector = useStore((s) => s.guardarConector)
  const eliminarConector = useStore((s) => s.eliminarConector)
  const guardarCuenta = useStore((s) => s.guardarCuentaTesoreria)
  const importarMovimientos = useStore((s) => s.importarMovimientos)
  const guardarLogSync = useStore((s) => s.guardarLogSync)

  const [edit, setEdit] = useState<Conector | null>(null)
  const [preview, setPreview] = useState<{ conector: Conector; movs: MovimientoExterno[]; cuentaId: string; nuevos: number } | null>(null)
  const [estado, setEstado] = useState<Record<string, { ok: boolean; mensaje: string }>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)

  const cuentaDe = (c: Conector) => `pasarela-${c.id}`

  const probar = async (c: Conector) => {
    setOcupado(c.id)
    setEstado({ ...estado, [c.id]: await probarConexion(c) })
    setOcupado(null)
  }

  const sincronizarConector = async (c: Conector) => {
    setOcupado(c.id)
    try {
      const r = await sincronizar(c, hoyISO())
      const cuentaId = cuentaDe(c)
      const existentes = new Set(movimientos.filter((m) => m.cuentaId === cuentaId).map((m) => m.referencia))
      const nuevos = r.movimientos.filter((m) => !existentes.has(m.externalId)).length
      setPreview({ conector: c, movs: r.movimientos, cuentaId, nuevos })
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'Error de sincronización'
      setEstado({ ...estado, [c.id]: { ok: false, mensaje } })
      guardarLogSync({ id: nuevoId(), conectorId: c.id, fecha: new Date().toISOString(), resultado: 'ERROR', mensaje, registros: 0 })
    }
    setOcupado(null)
  }

  const aplicar = () => {
    if (!preview) return
    const { conector, movs, cuentaId } = preview
    // Asegura la cuenta pasarela del conector.
    if (!cuentas.find((c) => c.id === cuentaId)) {
      const cuenta: CuentaTesoreria = { id: cuentaId, creadoEn: new Date().toISOString(), creadoPor: 'sistema', origen: 'API', nombre: `${conector.nombre} (pasarela)`, tipo: 'PASARELA', saldoInicial: 0, cuentaPGC: '572' }
      guardarCuenta(cuenta)
    }
    const nuevos: MovimientoTesoreria[] = movs.map((m) => ({ id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'sistema', origen: 'API', cuentaId, fecha: m.fecha, concepto: m.concepto, importe: m.importe, clase: 'OTRO', conciliado: false, referencia: m.externalId }))
    const insertados = importarMovimientos(nuevos)
    guardarConector({ ...conector, ultimaSync: new Date().toISOString() })
    guardarLogSync({ id: nuevoId(), conectorId: conector.id, fecha: new Date().toISOString(), resultado: 'OK', mensaje: `${insertados} nuevos de ${movs.length} (idempotente)`, registros: insertados })
    setEstado({ ...estado, [conector.id]: { ok: true, mensaje: `Sincronizado: ${insertados} movimientos nuevos.` } })
    setPreview(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Conectores enchufables (Square, banco, pasarelas, tienda online). Las credenciales van en tu servidor (Umbrel) o en el dispositivo, nunca en el código.</p>
        <Boton onClick={() => setEdit(conectorNuevo())}>+ Conector</Boton>
      </div>

      {conectores.length === 0 ? (
        <Tarjeta><EstadoVacio icono="importar" titulo="Aún no hay conectores" descripcion="Añade un conector para sincronizar ventas y movimientos automáticamente. Empieza con el de demostración para ver cómo funciona sin credenciales." accion={<Boton onClick={() => setEdit(conectorNuevo())}>Añadir el primero</Boton>} /></Tarjeta>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {conectores.map((c) => {
            const est = estado[c.id]
            return (
              <Tarjeta key={c.id} className="!p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{c.nombre}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{definicionConector(c.tipo).nombre} · {MODOS.find((m) => m.valor === c.modo)?.texto.split(' ')[0]}</div>
                  </div>
                  <Semaforo estado={c.activo ? 'positivo' : 'neutro'} texto={c.activo ? 'Activo' : 'Inactivo'} />
                </div>
                {c.ultimaSync && <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Última sync: {formatearFecha(c.ultimaSync.slice(0, 10))}</div>}
                {est && <div className="mt-2"><Semaforo estado={est.ok ? 'positivo' : 'negativo'} texto={est.mensaje} /></div>}
                <div className="flex gap-3 text-xs mt-3">
                  <button className="underline" disabled={ocupado === c.id} onClick={() => void sincronizarConector(c)}>{ocupado === c.id ? 'Sincronizando…' : 'Sincronizar'}</button>
                  <button className="underline" onClick={() => void probar(c)}>Probar</button>
                  <button className="underline" onClick={() => setEdit({ ...c })}>Editar</button>
                  <button className="underline" style={{ color: 'var(--neg)' }} onClick={() => eliminarConector(c.id)}>Quitar</button>
                </div>
              </Tarjeta>
            )
          })}
        </div>
      )}

      {logs.length > 0 && (
        <Tarjeta>
          <h3 className="font-semibold mb-2">Registro de sincronizaciones</h3>
          <div className="space-y-1.5 text-sm">
            {logs.slice(0, 8).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2">
                <span className="truncate"><span className="tabular" style={{ color: 'var(--text-muted)' }}>{formatearFecha(l.fecha.slice(0, 10))}</span> · {l.mensaje}</span>
                <Semaforo estado={l.resultado === 'OK' ? 'positivo' : l.resultado === 'ERROR' ? 'negativo' : 'atencion'} texto={l.resultado} />
              </div>
            ))}
          </div>
        </Tarjeta>
      )}

      {/* Alta/edición de conector */}
      {edit && (
        <Modal titulo={conectores.find((c) => c.id === edit.id) ? 'Editar conector' : 'Nuevo conector'} onCerrar={() => setEdit(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select etiqueta="Servicio" valor={edit.tipo} onChange={(v) => setEdit({ ...edit, tipo: v })} opciones={CONECTORES.map((c) => ({ valor: c.tipo, texto: c.nombre }))} />
              <Campo etiqueta="Nombre" valor={edit.nombre} onChange={(v) => setEdit({ ...edit, nombre: v })} />
            </div>
            <Select etiqueta="Modo de conexión" valor={edit.modo} onChange={(v) => setEdit({ ...edit, modo: v })} opciones={MODOS} />
            {edit.modo === 'DISPOSITIVO' && (
              <Campo etiqueta="Token de acceso" valor={edit.token ?? ''} onChange={(v) => setEdit({ ...edit, token: v })} tipo="password" ayuda="Se guarda en este dispositivo (IndexedDB), nunca en el código ni en el repositorio." />
            )}
            {edit.modo === 'SERVIDOR' && (
              <>
                <Campo etiqueta="URL del servidor (Umbrel)" valor={edit.urlServidor ?? ''} onChange={(v) => setEdit({ ...edit, urlServidor: v })} placeholder="https://umbrel.local:3001" ayuda="Tu servidor guarda las credenciales cifradas y hace la llamada real." />
                <Campo etiqueta="Secreto compartido" valor={edit.secretoServidor ?? ''} onChange={(v) => setEdit({ ...edit, secretoServidor: v })} tipo="password" />
              </>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Boton variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton>
              <Boton onClick={() => { if (edit.nombre.trim()) { guardarConector(edit); setEdit(null) } }}>Guardar</Boton>
            </div>
          </div>
        </Modal>
      )}

      {/* Previsualización antes de aplicar */}
      {preview && (
        <Modal titulo="Previsualización de la sincronización" onCerrar={() => setPreview(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Semaforo estado="positivo" texto={`${preview.nuevos} nuevos`} />
              <Semaforo estado="neutro" texto={`${preview.movs.length - preview.nuevos} ya importados`} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Se importarán a la cuenta «{preview.conector.nombre} (pasarela)». Reimportar no duplica: la idempotencia usa el identificador externo.</p>
            <Tarjeta className="!p-0 overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left"><th className="px-3 py-2 font-medium">Fecha</th><th className="px-3 py-2 font-medium">Concepto</th><th className="px-3 py-2 font-medium text-right">Importe</th></tr></thead>
                <tbody>
                  {preview.movs.map((m) => (
                    <tr key={m.externalId} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-3 py-1.5 tabular">{formatearFecha(m.fecha)}</td>
                      <td className="px-3 py-1.5">{m.concepto}</td>
                      <td className="px-3 py-1.5 text-right"><ImporteEuro valor={m.importe} color /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
            <div className="flex justify-end gap-2 pt-1">
              <Boton variante="secundario" onClick={() => setPreview(null)}>Cancelar</Boton>
              <Boton onClick={aplicar}>Aplicar {preview.nuevos} nuevos</Boton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
