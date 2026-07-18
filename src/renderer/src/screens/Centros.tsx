import React, { useEffect, useState } from 'react'
import type { Centro, Festivo, NuevoCentro } from '@shared/types'
import { useApp } from '../App'
import { Campo, Modal, Vacio, useUI } from '../components'
import { centroVacio, COLORES_CENTRO } from '../defaults'
import { isoALocal, localAIso } from '@shared/fechas'

function Check(props: { label: string; checked: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
      <input
        type="checkbox"
        style={{ width: 'auto' }}
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      {props.label}
    </label>
  )
}

export function PantallaCentros(): React.JSX.Element {
  const { empresa } = useApp()
  const { toast, confirmar } = useUI()
  const [centros, setCentros] = useState<Centro[]>([])
  const [editando, setEditando] = useState<{ id: number | null; data: NuevoCentro } | null>(null)
  const [festivos, setFestivos] = useState<Festivo[]>([])
  const [nuevoFest, setNuevoFest] = useState({ fecha: '', desc: '' })

  const recargar = async (): Promise<void> => {
    if (!empresa) return setCentros([])
    setCentros(await window.api.centros.listar(empresa.id))
  }
  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id])

  const abrirNuevo = (): void => {
    if (!empresa) return
    const color = COLORES_CENTRO[centros.length % COLORES_CENTRO.length]
    setEditando({ id: null, data: centroVacio(empresa.id, color) })
    setFestivos([])
  }
  const abrirEdicion = async (c: Centro): Promise<void> => {
    const { id, ...rest } = c
    setEditando({ id, data: rest })
    setFestivos(await window.api.festivos.listar(id))
  }

  const guardar = async (): Promise<void> => {
    if (!editando) return
    const d = editando.data
    if (!d.codigo.trim() || !d.nombre.trim()) {
      toast('Código y nombre del centro son obligatorios')
      return
    }
    if (editando.id) await window.api.centros.actualizar(editando.id, d)
    else await window.api.centros.crear(d)
    setEditando(null)
    await recargar()
    toast('Centro guardado')
  }

  const borrar = async (c: Centro): Promise<void> => {
    const ok = await confirmar(
      `¿Borrar el centro «${c.nombre}»? Se quitará de los trabajadores y turnos asociados. Esta acción no se puede deshacer.`
    )
    if (!ok) return
    await window.api.centros.borrar(c.id)
    await recargar()
    toast('Centro borrado')
  }

  const addFestivo = async (): Promise<void> => {
    if (!editando?.id) {
      toast('Guarda el centro antes de añadir festivos')
      return
    }
    const iso = localAIso(nuevoFest.fecha)
    if (!iso) {
      toast('Fecha no válida (dd/mm/aaaa)')
      return
    }
    await window.api.festivos.crear(editando.id, iso, nuevoFest.desc)
    setNuevoFest({ fecha: '', desc: '' })
    setFestivos(await window.api.festivos.listar(editando.id))
  }
  const delFestivo = async (f: Festivo): Promise<void> => {
    await window.api.festivos.borrar(f.id)
    if (editando?.id) setFestivos(await window.api.festivos.listar(editando.id))
  }

  const upd = (patch: Partial<NuevoCentro>): void =>
    setEditando((prev) => (prev ? { ...prev, data: { ...prev.data, ...patch } } : prev))

  if (!empresa) return <Vacio>Selecciona o crea una empresa primero.</Vacio>

  return (
    <>
      <div className="topbar">
        <div className="page-title">Centros · {empresa.razon_social}</div>
        <button className="btn primary" onClick={abrirNuevo}>
          + Nuevo centro
        </button>
      </div>

      <div className="card">
        {centros.length === 0 ? (
          <Vacio>No hay centros en esta empresa.</Vacio>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Localidad</th>
                <th>Convenio</th>
                <th>H. anuales</th>
                <th>Apertura</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {centros.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="swatch" style={{ background: c.color }} />
                  </td>
                  <td>{c.codigo}</td>
                  <td>
                    <b>{c.nombre}</b>
                  </td>
                  <td>{c.localidad}</td>
                  <td>{c.convenio}</td>
                  <td>{c.horas_anuales_convenio}</td>
                  <td>
                    {c.hora_apertura}–{c.hora_cierre}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn small" onClick={() => abrirEdicion(c)}>
                      Editar
                    </button>{' '}
                    <button className="btn small danger" onClick={() => borrar(c)}>
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editando && (
        <Modal
          wide
          title={editando.id ? 'Editar centro' : 'Nuevo centro'}
          onClose={() => setEditando(null)}
          actions={
            <>
              <button className="btn" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button className="btn primary" onClick={guardar}>
                Guardar
              </button>
            </>
          }
        >
          <div className="grid-3">
            <Campo label="Código" required value={editando.data.codigo} onChange={(v) => upd({ codigo: v })} />
            <Campo label="Nombre" required value={editando.data.nombre} onChange={(v) => upd({ nombre: v })} />
            <label className="field">
              <span>Color (agenda)</span>
              <input type="color" value={editando.data.color} onChange={(e) => upd({ color: e.target.value })} />
            </label>
          </div>
          <div style={{ height: 10 }} />
          <div className="grid-3">
            <Campo label="Provincia" value={editando.data.provincia} onChange={(v) => upd({ provincia: v })} />
            <Campo label="Localidad" value={editando.data.localidad} onChange={(v) => upd({ localidad: v })} />
            <Campo label="Convenio colectivo" value={editando.data.convenio} onChange={(v) => upd({ convenio: v })} />
          </div>
          <div style={{ height: 10 }} />
          <Campo label="Dirección" value={editando.data.direccion} onChange={(v) => upd({ direccion: v })} />
          <div style={{ height: 10 }} />
          <div className="grid-3">
            <Campo
              label="Horas anuales del convenio"
              type="number"
              value={editando.data.horas_anuales_convenio}
              onChange={(v) => upd({ horas_anuales_convenio: Number(v) })}
            />
            <Campo label="Hora de apertura" value={editando.data.hora_apertura} onChange={(v) => upd({ hora_apertura: v })} />
            <Campo label="Hora de cierre" value={editando.data.hora_cierre} onChange={(v) => upd({ hora_cierre: v })} />
          </div>
          <div style={{ height: 12 }} />
          <div className="card" style={{ background: 'var(--panel-2)', marginBottom: 0 }}>
            <h3>Días de apertura</h3>
            <div className="row">
              <Check
                label="Laborables (L–V)"
                checked={editando.data.abre_laborables === 1}
                onChange={(v) => upd({ abre_laborables: v ? 1 : 0 })}
              />
              <Check
                label="Sábados"
                checked={editando.data.abre_sabados === 1}
                onChange={(v) => upd({ abre_sabados: v ? 1 : 0 })}
              />
              <Check
                label="Domingos"
                checked={editando.data.abre_domingos === 1}
                onChange={(v) => upd({ abre_domingos: v ? 1 : 0 })}
              />
              <Check
                label="Festivos"
                checked={editando.data.abre_festivos === 1}
                onChange={(v) => upd({ abre_festivos: v ? 1 : 0 })}
              />
            </div>
          </div>

          <div style={{ height: 12 }} />
          <div className="card" style={{ background: 'var(--panel-2)', marginBottom: 0 }}>
            <h3>Festivos aplicables</h3>
            {!editando.id && <p className="muted">Guarda el centro para poder añadir festivos.</p>}
            {editando.id && (
              <>
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <Campo
                    label="Fecha (dd/mm/aaaa)"
                    value={nuevoFest.fecha}
                    onChange={(v) => setNuevoFest({ ...nuevoFest, fecha: v })}
                    placeholder="25/12/2026"
                  />
                  <Campo
                    label="Descripción"
                    value={nuevoFest.desc}
                    onChange={(v) => setNuevoFest({ ...nuevoFest, desc: v })}
                    placeholder="Navidad"
                  />
                  <button className="btn" onClick={addFestivo}>
                    Añadir
                  </button>
                </div>
                <div style={{ marginTop: 10 }}>
                  {festivos.length === 0 ? (
                    <p className="muted">Sin festivos cargados.</p>
                  ) : (
                    festivos.map((f) => (
                      <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '3px 0' }}>
                        <b>{isoALocal(f.fecha)}</b>
                        <span className="muted">{f.descripcion}</span>
                        <button className="btn small danger" onClick={() => delFestivo(f)}>
                          Quitar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
