import React, { useState } from 'react'
import type { Empresa, NuevaEmpresa } from '@shared/types'
import { useApp } from '../App'
import { Campo, Modal, Vacio, useUI } from '../components'
import { empresaVacia } from '../defaults'

export function PantallaEmpresas(): React.JSX.Element {
  const { empresas, recargarEmpresas } = useApp()
  const { toast, confirmar } = useUI()
  const [editando, setEditando] = useState<{ id: number | null; data: NuevaEmpresa } | null>(null)

  const abrirNueva = (): void => setEditando({ id: null, data: empresaVacia() })
  const abrirEdicion = (e: Empresa): void =>
    setEditando({
      id: e.id,
      data: {
        razon_social: e.razon_social,
        cif: e.cif,
        domicilio: e.domicilio,
        admin_nombre: e.admin_nombre,
        admin_nif: e.admin_nif,
        sello_imagen: e.sello_imagen
      }
    })

  const guardar = async (): Promise<void> => {
    if (!editando) return
    if (!editando.data.razon_social.trim()) {
      toast('La razón social es obligatoria')
      return
    }
    if (editando.id) await window.api.empresas.actualizar(editando.id, editando.data)
    else await window.api.empresas.crear(editando.data)
    setEditando(null)
    await recargarEmpresas()
    toast('Empresa guardada')
  }

  const borrar = async (e: Empresa): Promise<void> => {
    const ok = await confirmar(
      `¿Borrar la empresa «${e.razon_social}»? Se eliminarán también sus centros, trabajadores y cuadrantes. Esta acción no se puede deshacer.`
    )
    if (!ok) return
    await window.api.empresas.borrar(e.id)
    await recargarEmpresas()
    toast('Empresa borrada')
  }

  const onSello = (file: File | undefined, upd: (v: string | null) => void): void => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => upd(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">Empresas</div>
        <button className="btn primary" onClick={abrirNueva}>
          + Nueva empresa
        </button>
      </div>

      <div className="card">
        {empresas.length === 0 ? (
          <Vacio>No hay empresas. Crea la primera para empezar.</Vacio>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Razón social</th>
                <th>CIF</th>
                <th>Administrador</th>
                <th>Sello</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.id}>
                  <td>
                    <b>{e.razon_social}</b>
                  </td>
                  <td>{e.cif}</td>
                  <td>{e.admin_nombre}</td>
                  <td>{e.sello_imagen ? '✅' : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn small" onClick={() => abrirEdicion(e)}>
                      Editar
                    </button>{' '}
                    <button className="btn small danger" onClick={() => borrar(e)}>
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
          title={editando.id ? 'Editar empresa' : 'Nueva empresa'}
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
          <div className="grid-2">
            <Campo
              label="Razón social"
              required
              value={editando.data.razon_social}
              onChange={(v) => setEditando({ ...editando, data: { ...editando.data, razon_social: v } })}
            />
            <Campo
              label="CIF"
              value={editando.data.cif}
              onChange={(v) => setEditando({ ...editando, data: { ...editando.data, cif: v } })}
            />
          </div>
          <div style={{ height: 10 }} />
          <Campo
            label="Domicilio"
            value={editando.data.domicilio}
            onChange={(v) => setEditando({ ...editando, data: { ...editando.data, domicilio: v } })}
          />
          <div style={{ height: 10 }} />
          <div className="grid-2">
            <Campo
              label="Administrador (nombre)"
              value={editando.data.admin_nombre}
              onChange={(v) =>
                setEditando({ ...editando, data: { ...editando.data, admin_nombre: v } })
              }
            />
            <Campo
              label="NIF del administrador"
              value={editando.data.admin_nif}
              onChange={(v) => setEditando({ ...editando, data: { ...editando.data, admin_nif: v } })}
            />
          </div>
          <div style={{ height: 14 }} />
          <label className="field">
            <span>Sello de empresa (imagen, para los PDF)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                onSello(e.target.files?.[0], (v) =>
                  setEditando((prev) => (prev ? { ...prev, data: { ...prev.data, sello_imagen: v } } : prev))
                )
              }
            />
          </label>
          {editando.data.sello_imagen && (
            <div style={{ marginTop: 8 }}>
              <img
                src={editando.data.sello_imagen}
                alt="Sello"
                style={{ maxHeight: 70, border: '1px solid var(--border)', borderRadius: 6, padding: 4 }}
              />{' '}
              <button
                className="btn small"
                onClick={() =>
                  setEditando({ ...editando, data: { ...editando.data, sello_imagen: null } })
                }
              >
                Quitar
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
