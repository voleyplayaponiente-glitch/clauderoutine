import React, { useEffect, useState } from 'react'
import type { Centro, NuevoTrabajador, Trabajador } from '@shared/types'
import { useApp } from '../App'
import { Campo, Modal, Vacio, useUI } from '../components'
import { trabajadorVacio, COLORES_TRABAJADOR, colorTrabajador } from '../defaults'
import { mediaMensual, sueldoProrrateado, calcRetribucion, vacacionesPendientes } from '@shared/calculos'
import { euros, numEs } from '@shared/fechas'
import { dniNieValido, ibanValido } from '../validacion'

type Asig = { centro_id: number; es_principal: boolean }

export function PantallaTrabajadores(): React.JSX.Element {
  const { empresa } = useApp()
  const { toast, confirmar } = useUI()
  const [lista, setLista] = useState<Trabajador[]>([])
  const [centros, setCentros] = useState<Centro[]>([])
  const [texto, setTexto] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCentro, setFiltroCentro] = useState('')
  const [edit, setEdit] = useState<{ id: number | null; data: NuevoTrabajador; asig: Asig[] } | null>(
    null
  )

  const recargar = async (): Promise<void> => {
    if (!empresa) return setLista([])
    setLista(
      await window.api.trabajadores.listar({
        empresaId: empresa.id,
        texto: texto || undefined,
        tipo: filtroTipo || undefined,
        centroId: filtroCentro ? Number(filtroCentro) : undefined
      })
    )
  }
  useEffect(() => {
    if (empresa) window.api.centros.listar(empresa.id).then(setCentros)
  }, [empresa?.id])
  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id, texto, filtroTipo, filtroCentro])

  const abrirNuevo = (): void => {
    if (!empresa) return
    const color = COLORES_TRABAJADOR[lista.length % COLORES_TRABAJADOR.length]
    setEdit({ id: null, data: trabajadorVacio(empresa.id, color), asig: [] })
  }
  const abrirEdicion = async (t: Trabajador): Promise<void> => {
    const { id, ...rest } = t
    const asig = (await window.api.trabajadores.centrosDe(id)).map((a) => ({
      centro_id: a.centro_id,
      es_principal: a.es_principal === 1
    }))
    setEdit({ id, data: rest, asig })
  }

  const upd = (patch: Partial<NuevoTrabajador>): void =>
    setEdit((prev) => (prev ? { ...prev, data: { ...prev.data, ...patch } } : prev))

  const toggleCentro = (centroId: number, on: boolean): void => {
    setEdit((prev) => {
      if (!prev) return prev
      let asig = prev.asig.filter((a) => a.centro_id !== centroId)
      if (on) asig = [...asig, { centro_id: centroId, es_principal: prev.asig.length === 0 }]
      return { ...prev, asig }
    })
  }
  const marcarPrincipal = (centroId: number): void => {
    setEdit((prev) =>
      prev
        ? { ...prev, asig: prev.asig.map((a) => ({ ...a, es_principal: a.centro_id === centroId })) }
        : prev
    )
  }

  const guardar = async (): Promise<void> => {
    if (!edit) return
    const d = edit.data
    if (!d.nombre.trim()) return toast('El nombre es obligatorio')
    if (d.dni_nie && !dniNieValido(d.dni_nie)) return toast('El DNI/NIE no es válido')
    if (d.iban && !ibanValido(d.iban)) return toast('El IBAN no es válido')
    let id = edit.id
    if (id) await window.api.trabajadores.actualizar(id, d)
    else id = (await window.api.trabajadores.crear(d)).id
    await window.api.trabajadores.fijarCentros(id, edit.asig)
    setEdit(null)
    await recargar()
    toast('Trabajador guardado')
  }

  const borrar = async (t: Trabajador): Promise<void> => {
    const ok = await confirmar(
      `¿Borrar a «${t.nombre} ${t.apellidos}»? Se eliminarán sus cuadrantes y turnos. Esta acción no se puede deshacer.`
    )
    if (!ok) return
    await window.api.trabajadores.borrar(t.id)
    await recargar()
    toast('Trabajador borrado')
  }

  if (!empresa) return <Vacio>Selecciona o crea una empresa primero.</Vacio>

  return (
    <>
      <div className="topbar">
        <div className="page-title">Trabajadores · {empresa.razon_social}</div>
        <button className="btn primary" onClick={abrirNuevo}>
          + Nuevo trabajador
        </button>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            className="mini"
            style={{ minWidth: 220 }}
            placeholder="Buscar por nombre, apellidos o DNI…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <select className="mini" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="ajena">Cuenta ajena</option>
            <option value="autonomo">Autónomo</option>
          </select>
          <select className="mini" value={filtroCentro} onChange={(e) => setFiltroCentro(e.target.value)}>
            <option value="">Todos los centros</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {lista.length === 0 ? (
          <Vacio>No hay trabajadores con esos filtros.</Vacio>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>DNI/NIE</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Contrato</th>
                <th>Coef.</th>
                <th>Vac. pend.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id}>
                  <td>{t.codigo}</td>
                  <td>
                    <span className="swatch" style={{ background: colorTrabajador(t.color, t.id) }} />{' '}
                    <b>
                      {t.apellidos}, {t.nombre}
                    </b>
                  </td>
                  <td>{t.dni_nie}</td>
                  <td>
                    <span className={'tag ' + t.tipo}>{t.tipo === 'ajena' ? 'Ajena' : 'Autónomo'}</span>
                  </td>
                  <td>{t.categoria}</td>
                  <td>{t.tipo_contrato}</td>
                  <td>{numEs(t.coef_parcialidad, 3)}</td>
                  <td>{vacacionesPendientes(t.vacaciones_anuales, t.vacaciones_disfrutadas)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn small" onClick={() => abrirEdicion(t)}>
                      Ficha
                    </button>{' '}
                    <button className="btn small danger" onClick={() => borrar(t)}>
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <FichaTrabajador
          edit={edit}
          centros={centros}
          onClose={() => setEdit(null)}
          onGuardar={guardar}
          upd={upd}
          toggleCentro={toggleCentro}
          marcarPrincipal={marcarPrincipal}
        />
      )}
    </>
  )
}

function FichaTrabajador(props: {
  edit: { id: number | null; data: NuevoTrabajador; asig: Asig[] }
  centros: Centro[]
  onClose: () => void
  onGuardar: () => void
  upd: (p: Partial<NuevoTrabajador>) => void
  toggleCentro: (id: number, on: boolean) => void
  marcarPrincipal: (id: number) => void
}): React.JSX.Element {
  const { edit, centros, upd } = props
  const d = edit.data
  const esAuto = d.tipo === 'autonomo'
  const media = mediaMensual(d.horas_convenio_completa, d.coef_parcialidad)
  const sueldoPro = sueldoProrrateado(d.sueldo_convenio_completo, d.coef_parcialidad)
  const retrib = calcRetribucion(d)
  // Los campos de fecha usan el selector nativo (valor ISO aaaa-mm-dd).
  const fecha = (v: string | null): string => v ?? ''
  const setFecha = (k: keyof NuevoTrabajador, v: string): void => {
    upd({ [k]: v || null } as Partial<NuevoTrabajador>)
  }

  return (
    <Modal
      wide
      title={edit.id ? 'Ficha del trabajador' : 'Nuevo trabajador'}
      onClose={props.onClose}
      actions={
        <>
          <button className="btn" onClick={props.onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={props.onGuardar}>
            Guardar
          </button>
        </>
      }
    >
      <div className="grid-3">
        <Campo label="Código / nº de orden" value={d.codigo} onChange={(v) => upd({ codigo: v })} />
        <Campo label="Tipo" list={[{ value: 'ajena', label: 'Cuenta ajena' }, { value: 'autonomo', label: 'Autónomo' }]} value={d.tipo} onChange={(v) => upd({ tipo: v as 'ajena' | 'autonomo' })} />
        <label className="field">
          <span>Color en la agenda</span>
          <input
            type="color"
            value={colorTrabajador(d.color, edit.id ?? 0)}
            onChange={(e) => upd({ color: e.target.value })}
          />
        </label>
      </div>
      <div style={{ height: 10 }} />
      <div className="grid-3">
        <Campo label="Nombre" required value={d.nombre} onChange={(v) => upd({ nombre: v })} />
        <Campo label="Apellidos" value={d.apellidos} onChange={(v) => upd({ apellidos: v })} />
        <div />
      </div>
      <div style={{ height: 10 }} />
      <div className="grid-3">
        <Campo label="DNI / NIE" value={d.dni_nie} onChange={(v) => upd({ dni_nie: v })} error={d.dni_nie && !dniNieValido(d.dni_nie) ? 'Formato no válido' : undefined} />
        {!esAuto && <Campo label="Nº Seguridad Social" value={d.nss} onChange={(v) => upd({ nss: v })} />}
        <Campo label="Categoría / puesto" value={d.categoria} onChange={(v) => upd({ categoria: v })} />
      </div>
      <div style={{ height: 10 }} />
      <div className="grid-3">
        <Campo label="Teléfono" value={d.telefono} onChange={(v) => upd({ telefono: v })} />
        <Campo label="Email" value={d.email} onChange={(v) => upd({ email: v })} />
        <Campo label="IBAN" value={d.iban} onChange={(v) => upd({ iban: v })} error={d.iban && !ibanValido(d.iban) ? 'IBAN no válido' : undefined} />
      </div>
      <div style={{ height: 10 }} />
      <Campo label="Dirección" value={d.direccion} onChange={(v) => upd({ direccion: v })} />

      <div style={{ height: 14 }} />
      <div className="card" style={{ background: 'var(--panel-2)', marginBottom: 12 }}>
        <h3>Contrato y jornada</h3>
        <div className="grid-3">
          <Campo label="Tipo de contrato" list={[{ value: 'indefinido', label: 'Indefinido' }, { value: 'temporal', label: 'Temporal' }]} value={d.tipo_contrato} onChange={(v) => upd({ tipo_contrato: v as 'indefinido' | 'temporal' })} />
          <Campo label="Inicio contrato" type="date" value={fecha(d.fecha_contrato_inicio)} onChange={(v) => setFecha('fecha_contrato_inicio', v)} />
          <Campo label="Fin contrato" type="date" value={fecha(d.fecha_contrato_fin)} onChange={(v) => setFecha('fecha_contrato_fin', v)} />
        </div>
        <div style={{ height: 10 }} />
        <div className="grid-3">
          <Campo label="Fecha de alta" type="date" value={fecha(d.fecha_alta)} onChange={(v) => setFecha('fecha_alta', v)} />
          <Campo label="Fin periodo de prueba" type="date" value={fecha(d.fecha_fin_periodo_prueba)} onChange={(v) => setFecha('fecha_fin_periodo_prueba', v)} />
          <Campo label="Fecha de baja" type="date" value={fecha(d.fecha_baja)} onChange={(v) => setFecha('fecha_baja', v)} />
        </div>
        <div style={{ height: 10 }} />
        <div className="grid-3">
          <Campo
            label="Horas de contrato (semanales)"
            type="number"
            step="0.01"
            value={d.horas_contrato_semanales}
            onChange={(v) => {
              const h = Number(v)
              const jc = d.jornada_completa_semanal || 40
              upd({ horas_contrato_semanales: h, coef_parcialidad: Math.round((h / jc) * 10000) / 10000 })
            }}
          />
          <Campo
            label="Jornada completa (h/semana)"
            type="number"
            step="0.01"
            value={d.jornada_completa_semanal}
            onChange={(v) => {
              const jc = Number(v)
              upd({
                jornada_completa_semanal: jc,
                coef_parcialidad: jc ? Math.round((d.horas_contrato_semanales / jc) * 10000) / 10000 : 0
              })
            }}
          />
          <Campo
            label="Coeficiente parcialidad (auto)"
            type="number"
            step="0.0001"
            value={d.coef_parcialidad}
            onChange={(v) => upd({ coef_parcialidad: Number(v) })}
          />
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          El coeficiente se calcula solo (horas semanales ÷ jornada completa). Puedes ajustarlo a mano si el contrato indica otro.
        </p>
        <div style={{ height: 10 }} />
        <div className="grid-3">
          <Campo
            label="Horas convenio anuales (jornada completa)"
            type="number"
            value={d.horas_convenio_completa}
            onChange={(v) => upd({ horas_convenio_completa: Number(v) })}
          />
          <div />
          <div />
        </div>
        {!esAuto && (
          <>
            <div style={{ height: 10 }} />
            <div className="grid-3">
              <Campo label="Precio hora complementaria (€)" type="number" step="0.01" value={d.precio_hora_complementaria} onChange={(v) => upd({ precio_hora_complementaria: Number(v) })} />
            </div>
          </>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <div className="kpi">
            <div className="n">{numEs(media)} h</div>
            <div className="l">Media mensual a trabajar (constante todo el año)</div>
          </div>
          <div className="kpi">
            <div className="n">{euros(sueldoPro)}</div>
            <div className="l">Sueldo prorrateado según jornada</div>
          </div>
        </div>
        {esAuto && (
          <p className="muted" style={{ marginTop: 10 }}>
            ⚠️ Autónomo/a: sin nº de SS de cuenta ajena, sin horas complementarias ni nómina. Se le
            asignan turnos para cubrir apertura, pero sin validaciones de jornada de cuenta ajena.
          </p>
        )}
      </div>

      <div className="card" style={{ background: 'var(--panel-2)', marginBottom: 12 }}>
        <h3>Retribución (importes mensuales, €)</h3>
        <div className="grid-3">
          <Campo label="Salario base según convenio" type="number" step="0.01" value={d.sueldo_convenio_completo} onChange={(v) => upd({ sueldo_convenio_completo: Number(v) })} />
          <Campo label="Plus de productividad" type="number" step="0.01" value={d.plus_productividad} onChange={(v) => upd({ plus_productividad: Number(v) })} />
          <Campo label="Plus de transporte" type="number" step="0.01" value={d.plus_transporte} onChange={(v) => upd({ plus_transporte: Number(v) })} />
        </div>
        <div style={{ height: 10 }} />
        <div className="grid-3">
          <label className="field">
            <span>Prorrateo pagas extra (3 pagas · automático)</span>
            <input
              value={numEs(retrib.prorrateoPagas)}
              readOnly
              title="Se calcula solo: salario base × 3 ÷ 12"
              style={{ background: 'var(--bg)', color: 'var(--text-soft)' }}
            />
          </label>
          <div />
          <div />
        </div>
        <div style={{ height: 10 }} />
        <div className="grid-3">
          <Campo label="Retrib. en especie SUJETA a IRPF" type="number" step="0.01" value={d.retribucion_especie} onChange={(v) => upd({ retribucion_especie: Number(v) })} />
          <Campo label="Retrib. en especie EXENTA (seguro salud)" type="number" step="0.01" value={d.retribucion_especie_exenta} onChange={(v) => upd({ retribucion_especie_exenta: Number(v) })} />
          <Campo label="IRPF (%)" type="number" step="0.01" value={d.irpf} onChange={(v) => upd({ irpf: Number(v) })} />
        </div>
        <div style={{ height: 10 }} />
        <div className="grid-3">
          <Campo label="Deducción retribución en especie" type="number" step="0.01" value={d.deduccion_especie} onChange={(v) => upd({ deduccion_especie: Number(v) })} />
          <Campo label="Deducción seguro de salud" type="number" step="0.01" value={d.deduccion_seguro_salud} onChange={(v) => upd({ deduccion_seguro_salud: Number(v) })} />
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <div className="kpi">
            <div className="n">{euros(retrib.totalDevengado)}</div>
            <div className="l">Total devengado</div>
          </div>
          <div className="kpi">
            <div className="n">{euros(retrib.retencionIrpf)}</div>
            <div className="l">Retención IRPF ({numEs(d.irpf)} % sobre {euros(retrib.baseSujetaIrpf)})</div>
          </div>
          <div className="kpi">
            <div className="n" style={{ color: 'var(--ok)' }}>{euros(retrib.neto)}</div>
            <div className="l">Total a percibir (neto estimado)</div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          La especie exenta (seguro de salud) no computa en la base de IRPF. Estimación orientativa;
          no sustituye a la nómina oficial. Exportable a Excel desde «Exportación».
        </p>
      </div>

      <div className="card" style={{ background: 'var(--panel-2)', marginBottom: 12 }}>
        <h3>Vacaciones</h3>
        <div className="grid-3">
          <Campo label="Días anuales" type="number" value={d.vacaciones_anuales} onChange={(v) => upd({ vacaciones_anuales: Number(v) })} />
          <Campo label="Días disfrutados" type="number" value={d.vacaciones_disfrutadas} onChange={(v) => upd({ vacaciones_disfrutadas: Number(v) })} />
          <div className="kpi">
            <div className="n">{vacacionesPendientes(d.vacaciones_anuales, d.vacaciones_disfrutadas)}</div>
            <div className="l">Días pendientes</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--panel-2)', marginBottom: 12 }}>
        <h3>Centros donde puede trabajar</h3>
        {centros.length === 0 ? (
          <p className="muted">No hay centros en esta empresa.</p>
        ) : (
          centros.map((c) => {
            const a = edit.asig.find((x) => x.centro_id === c.id)
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, width: 240 }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={!!a} onChange={(e) => props.toggleCentro(c.id, e.target.checked)} />
                  <span className="swatch" style={{ background: c.color }} /> {c.nombre}
                </label>
                {a && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                    <input type="radio" name="principal" style={{ width: 'auto' }} checked={a.es_principal} onChange={() => props.marcarPrincipal(c.id)} />
                    Principal
                  </label>
                )}
              </div>
            )
          })
        )}
      </div>

      <Campo label="Observaciones" value={d.observaciones} onChange={(v) => upd({ observaciones: v })} />
    </Modal>
  )
}
