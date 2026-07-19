import React, { useEffect, useState } from 'react'
import type { Trabajador } from '@shared/types'
import { useApp } from '../App'
import { Vacio, useUI } from '../components'
import { MESES } from '@shared/fechas'
import type { ResultadoOperacion } from '@shared/types'

const hoy = new Date()

export function PantallaExportar(): React.JSX.Element {
  const { empresa } = useApp()
  const { toast } = useUI()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([])
  const [trabId, setTrabId] = useState<number | null>(null)

  useEffect(() => {
    if (!empresa) return
    window.api.trabajadores.listar({ empresaId: empresa.id }).then((ts) => {
      setTrabajadores(ts)
      setTrabId((prev) => prev ?? ts[0]?.id ?? null)
    })
  }, [empresa?.id])

  const feedback = (r: ResultadoOperacion): void => {
    if (r.ok) toast('Documento guardado' + (r.ruta ? '' : ''))
    else if (r.error) toast('Error: ' + r.error)
  }

  if (!empresa) return <Vacio>Selecciona o crea una empresa primero.</Vacio>

  return (
    <>
      <div className="topbar">
        <div className="page-title">Exportación</div>
      </div>

      <div className="card">
        <h3>Cuadrante horario firmado (por trabajador y mes)</h3>
        <p className="muted">
          Genera el registro de jornada con cabecera, tabla día a día, totales, cláusula «RECIBÍ Y
          ACEPTO», doble bloque de firmas y sello de empresa.
        </p>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ minWidth: 260 }}>
            <span>Trabajador/a</span>
            <select value={trabId ?? ''} onChange={(e) => setTrabId(Number(e.target.value))}>
              {trabajadores.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.apellidos}, {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Mes</span>
            <select className="mini" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Año</span>
            <input className="mini" style={{ width: 90 }} type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
          </label>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button
            className="btn primary"
            disabled={!trabId}
            onClick={async () => feedback(await window.api.exportar.cuadrantePdf(trabId!, anio, mes))}
          >
            📄 Exportar PDF
          </button>
          <button
            className="btn"
            disabled={!trabId}
            onClick={async () => feedback(await window.api.exportar.cuadranteExcel(trabId!, anio, mes))}
          >
            📊 Exportar Excel
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Resumen mensual de horas por centro</h3>
        <p className="muted">Total de horas por centro de {empresa.razon_social} en el mes seleccionado.</p>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn primary" onClick={async () => feedback(await window.api.exportar.resumenPdf(empresa.id, anio, mes))}>
            📄 Resumen PDF
          </button>
          <button className="btn" onClick={async () => feedback(await window.api.exportar.resumenExcel(empresa.id, anio, mes))}>
            📊 Resumen Excel
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Retribuciones de los trabajadores</h3>
        <p className="muted">
          Excel con el desglose de retribución (salario base, plus, prorrateo de pagas, retribución
          en especie y deducciones) de todos los trabajadores de {empresa.razon_social}.
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={async () => feedback(await window.api.exportar.retribucionExcel(empresa.id))}>
            📊 Retribuciones (Excel)
          </button>
        </div>
      </div>
    </>
  )
}
