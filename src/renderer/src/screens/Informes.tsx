import React, { useEffect, useMemo, useState } from 'react'
import type { Centro, Trabajador, Turno } from '@shared/types'
import { useApp } from '../App'
import { Vacio } from '../components'
import { horasCentroMes, resumenMesTrabajador, vacacionesPendientes } from '@shared/calculos'
import { MESES, numEs, euros } from '@shared/fechas'

const hoy = new Date()

interface FilaTrab {
  trabajador: Trabajador
  resumen: ReturnType<typeof resumenMesTrabajador>
}

export function PantallaInformes(): React.JSX.Element {
  const { empresa } = useApp()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [centros, setCentros] = useState<Centro[]>([])
  const [filas, setFilas] = useState<FilaTrab[]>([])
  const [turnosEmpresa, setTurnosEmpresa] = useState<Array<Turno & { trabajador_id: number }>>([])

  useEffect(() => {
    if (!empresa) return
    ;(async () => {
      const cs = await window.api.centros.listar(empresa.id)
      setCentros(cs)
      const csPorId: Record<number, Centro> = {}
      for (const c of cs) csPorId[c.id] = c
      const trabs = await window.api.trabajadores.listar({ empresaId: empresa.id })
      const res: FilaTrab[] = []
      for (const t of trabs) {
        const cuad = await window.api.cuadrante.obtenerOCrear(t.id, anio, mes)
        const turnos = await window.api.cuadrante.turnos(cuad.id)
        const centroRef = turnos.find((x) => x.centro_id != null)?.centro_id
        const horasAnuales = centroRef ? csPorId[centroRef]?.horas_anuales_convenio ?? 0 : t.horas_convenio_completa
        res.push({ trabajador: t, resumen: resumenMesTrabajador(t, horasAnuales, turnos) })
      }
      setFilas(res)
      setTurnosEmpresa(await window.api.cuadrante.turnosMesEmpresa(empresa.id, anio, mes))
    })()
  }, [empresa?.id, anio, mes])

  const totalHoras = useMemo(() => filas.reduce((s, f) => s + f.resumen.horasRealizadas, 0), [filas])

  if (!empresa) return <Vacio>Selecciona o crea una empresa primero.</Vacio>

  return (
    <>
      <div className="topbar">
        <div className="page-title">Informes · {MESES[mes - 1]} {anio}</div>
        <div className="row">
          <select className="mini" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input className="mini" type="number" style={{ width: 90 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </div>
      </div>

      <div className="card">
        <h3>Horas por trabajador</h3>
        {filas.length === 0 ? (
          <Vacio>No hay trabajadores.</Vacio>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Trabajador</th>
                <th>Tipo</th>
                <th>Realizadas</th>
                <th>Media teórica</th>
                <th>Contratadas</th>
                <th>Desv. vs media</th>
                <th>Complementarias</th>
                <th>Valor comp.</th>
                <th>Vac. pend.</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.trabajador.id}>
                  <td>
                    <b>{f.trabajador.apellidos}, {f.trabajador.nombre}</b>
                  </td>
                  <td>
                    <span className={'tag ' + f.trabajador.tipo}>{f.trabajador.tipo === 'ajena' ? 'Ajena' : 'Autónomo'}</span>
                  </td>
                  <td>{numEs(f.resumen.horasRealizadas)} h</td>
                  <td>{numEs(f.resumen.mediaMensualTeorica)} h</td>
                  <td>{numEs(f.resumen.horasContratadasMes)} h</td>
                  <td style={{ color: f.resumen.desviacionVsMedia > 0 ? 'var(--warn)' : 'inherit' }}>
                    {f.resumen.desviacionVsMedia > 0 ? '+' : ''}
                    {numEs(f.resumen.desviacionVsMedia)} h
                  </td>
                  <td style={{ color: f.resumen.horasComplementarias > 0 ? 'var(--warn)' : 'inherit' }}>
                    {f.trabajador.tipo === 'ajena' ? numEs(f.resumen.horasComplementarias) + ' h' : '—'}
                  </td>
                  <td>{f.trabajador.tipo === 'ajena' ? euros(f.resumen.valorComplementarias) : '—'}</td>
                  <td>{vacacionesPendientes(f.trabajador.vacaciones_anuales, f.trabajador.vacaciones_disfrutadas)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  <b>TOTAL</b>
                </td>
                <td>
                  <b>{numEs(totalHoras)} h</b>
                </td>
                <td colSpan={6}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Horas por centro</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Centro</th>
              <th>Código</th>
              <th>Horas del mes</th>
            </tr>
          </thead>
          <tbody>
            {centros.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="swatch" style={{ background: c.color }} /> <b>{c.nombre}</b>
                </td>
                <td>{c.codigo}</td>
                <td>{numEs(horasCentroMes(c.id, turnosEmpresa))} h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
