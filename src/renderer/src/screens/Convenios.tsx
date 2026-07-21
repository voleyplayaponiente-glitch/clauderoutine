import React, { useEffect, useState } from 'react'
import type { ConvenioSalario, NuevoConvenioSalario } from '@shared/types'
import { Campo, Modal, Vacio, useUI } from '../components'
import { numEs } from '@shared/fechas'

function convenioVacio(): NuevoConvenioSalario {
  return {
    convenio: '',
    categoria: '',
    salario_base: 0,
    plus_productividad: 0,
    plus_transporte: 0,
    precio_hora_complementaria: 0,
    horas_convenio_anuales: 1768,
    notas: ''
  }
}

export function PantallaConvenios(): React.JSX.Element {
  const { toast, confirmar } = useUI()
  const [lista, setLista] = useState<ConvenioSalario[]>([])
  const [edit, setEdit] = useState<{ id: number | null; data: NuevoConvenioSalario } | null>(null)

  const recargar = async (): Promise<void> => setLista(await window.api.convenios.listar())
  useEffect(() => {
    recargar()
  }, [])

  const guardar = async (): Promise<void> => {
    if (!edit) return
    if (!edit.data.convenio.trim() || !edit.data.categoria.trim()) {
      toast('Indica el convenio y la categoría')
      return
    }
    if (edit.id) await window.api.convenios.actualizar(edit.id, edit.data)
    else await window.api.convenios.crear(edit.data)
    setEdit(null)
    await recargar()
    toast('Salario de convenio guardado')
  }

  const borrar = async (c: ConvenioSalario): Promise<void> => {
    if (!(await confirmar(`¿Borrar «${c.convenio} — ${c.categoria}»?`))) return
    await window.api.convenios.borrar(c.id)
    await recargar()
  }

  const d = edit?.data
  const upd = (p: Partial<NuevoConvenioSalario>): void =>
    setEdit((e) => (e ? { ...e, data: { ...e.data, ...p } } : e))

  return (
    <>
      <div className="topbar">
        <div className="page-title">Salarios por convenio</div>
        <button className="btn primary" onClick={() => setEdit({ id: null, data: convenioVacio() })}>
          + Nuevo salario de convenio
        </button>
      </div>

      <div className="card">
        <p className="muted">
          Tabla de salarios según convenio y categoría (importes de <b>jornada completa</b>). Desde
          la ficha de cada trabajador puedes aplicar uno de estos salarios con un clic: rellena el
          salario base, los pluses, el precio de la hora complementaria y las horas anuales del
          convenio.
        </p>
        {lista.length === 0 ? (
          <Vacio>Aún no hay salarios de convenio. Crea el primero con el botón de arriba.</Vacio>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Convenio</th>
                <th>Categoría</th>
                <th style={{ textAlign: 'right' }}>Salario base €/mes</th>
                <th style={{ textAlign: 'right' }}>Plus product.</th>
                <th style={{ textAlign: 'right' }}>Plus transp.</th>
                <th style={{ textAlign: 'right' }}>€/h compl.</th>
                <th style={{ textAlign: 'right' }}>Horas año</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td>{c.convenio}</td>
                  <td>{c.categoria}</td>
                  <td style={{ textAlign: 'right' }}>{numEs(c.salario_base)}</td>
                  <td style={{ textAlign: 'right' }}>{numEs(c.plus_productividad)}</td>
                  <td style={{ textAlign: 'right' }}>{numEs(c.plus_transporte)}</td>
                  <td style={{ textAlign: 'right' }}>{numEs(c.precio_hora_complementaria)}</td>
                  <td style={{ textAlign: 'right' }}>{numEs(c.horas_convenio_anuales, 0)}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button
                      className="btn small"
                      onClick={() =>
                        setEdit({
                          id: c.id,
                          data: {
                            convenio: c.convenio,
                            categoria: c.categoria,
                            salario_base: c.salario_base,
                            plus_productividad: c.plus_productividad,
                            plus_transporte: c.plus_transporte,
                            precio_hora_complementaria: c.precio_hora_complementaria,
                            horas_convenio_anuales: c.horas_convenio_anuales,
                            notas: c.notas
                          }
                        })
                      }
                    >
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

      {edit && d && (
        <Modal
          title={edit.id ? 'Editar salario de convenio' : 'Nuevo salario de convenio'}
          onClose={() => setEdit(null)}
          actions={
            <>
              <button className="btn" onClick={() => setEdit(null)}>
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
              label="Convenio"
              required
              value={d.convenio}
              placeholder="p. ej. Comercio vareo — Alicante 2026"
              onChange={(v) => upd({ convenio: v })}
            />
            <Campo
              label="Categoría"
              required
              value={d.categoria}
              placeholder="p. ej. Dependiente/a"
              onChange={(v) => upd({ categoria: v })}
            />
          </div>
          <div className="grid-3" style={{ marginTop: 10 }}>
            <Campo
              label="Salario base (€/mes, jornada completa)"
              type="number"
              step="0.01"
              value={d.salario_base}
              onChange={(v) => upd({ salario_base: Number(v) })}
            />
            <Campo
              label="Plus productividad (€/mes)"
              type="number"
              step="0.01"
              value={d.plus_productividad}
              onChange={(v) => upd({ plus_productividad: Number(v) })}
            />
            <Campo
              label="Plus transporte (€/mes)"
              type="number"
              step="0.01"
              value={d.plus_transporte}
              onChange={(v) => upd({ plus_transporte: Number(v) })}
            />
            <Campo
              label="Precio hora complementaria (€)"
              type="number"
              step="0.01"
              value={d.precio_hora_complementaria}
              onChange={(v) => upd({ precio_hora_complementaria: Number(v) })}
            />
            <Campo
              label="Horas anuales del convenio"
              type="number"
              value={d.horas_convenio_anuales}
              onChange={(v) => upd({ horas_convenio_anuales: Number(v) })}
            />
            <Campo label="Notas" value={d.notas} onChange={(v) => upd({ notas: v })} />
          </div>
        </Modal>
      )}
    </>
  )
}
