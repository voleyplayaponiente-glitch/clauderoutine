import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { Centro, SituacionDia, Trabajador, Turno } from '@shared/types'
import { useApp } from '../App'
import { Vacio, useUI } from '../components'
import { horasDia, resumenMesTrabajador } from '@shared/calculos'
import { avisosMes, type Aviso } from '@shared/avisos'
import { DIAS_SEMANA_CORTO, MESES, diaSemanaIso, numEs } from '@shared/fechas'

const SITUACIONES: Array<{ v: SituacionDia; label: string }> = [
  { v: 'libre', label: 'Libre' },
  { v: 'trabaja', label: 'Trabaja' },
  { v: 'vacaciones', label: 'Vacaciones' },
  { v: 'baja', label: 'Baja' },
  { v: 'festivo', label: 'Festivo' },
  { v: 'permiso', label: 'Permiso' }
]

const hoy = new Date()

export function PantallaCuadrante(): React.JSX.Element {
  const { empresa } = useApp()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [vista, setVista] = useState<'trabajador' | 'centro'>('trabajador')
  const [centros, setCentros] = useState<Centro[]>([])
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([])
  const [festivos, setFestivos] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!empresa) return
    window.api.centros.listar(empresa.id).then(setCentros)
    window.api.trabajadores.listar({ empresaId: empresa.id }).then(setTrabajadores)
    window.api.festivos.listarEmpresa(empresa.id).then((fs) => setFestivos(new Set(fs.map((f) => f.fecha))))
  }, [empresa?.id])

  const centrosPorId = useMemo(() => {
    const m: Record<number, Centro> = {}
    for (const c of centros) m[c.id] = c
    return m
  }, [centros])

  const cambiarMes = (delta: number): void => {
    let m = mes + delta
    let a = anio
    if (m < 1) {
      m = 12
      a--
    } else if (m > 12) {
      m = 1
      a++
    }
    setMes(m)
    setAnio(a)
  }

  if (!empresa) return <Vacio>Selecciona o crea una empresa primero.</Vacio>

  return (
    <>
      <div className="topbar">
        <div className="page-title">Cuadrantes · {MESES[mes - 1]} {anio}</div>
        <div className="row">
          <button className="btn small" onClick={() => cambiarMes(-1)}>
            ‹ Mes anterior
          </button>
          <select className="mini" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input className="mini" type="number" style={{ width: 90 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
          <button className="btn small" onClick={() => cambiarMes(1)}>
            Mes siguiente ›
          </button>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <button className={'btn small' + (vista === 'trabajador' ? ' primary' : '')} onClick={() => setVista('trabajador')}>
          Vista por trabajador
        </button>
        <button className={'btn small' + (vista === 'centro' ? ' primary' : '')} onClick={() => setVista('centro')}>
          Vista por centro
        </button>
      </div>

      <Leyenda centros={centros} />

      {vista === 'trabajador' ? (
        <VistaTrabajador
          empresaId={empresa.id}
          anio={anio}
          mes={mes}
          trabajadores={trabajadores}
          centros={centros}
          centrosPorId={centrosPorId}
          festivos={festivos}
        />
      ) : (
        <VistaCentro empresaId={empresa.id} anio={anio} mes={mes} centros={centros} trabajadores={trabajadores} />
      )}
    </>
  )
}

function Leyenda({ centros }: { centros: Centro[] }): React.JSX.Element {
  return (
    <div className="legend">
      {centros.map((c) => (
        <span key={c.id}>
          <span className="swatch" style={{ background: c.color }} /> {c.nombre}
        </span>
      ))}
    </div>
  )
}

// ------------------------------------------------------------- Vista por trabajador
function VistaTrabajador(props: {
  empresaId: number
  anio: number
  mes: number
  trabajadores: Trabajador[]
  centros: Centro[]
  centrosPorId: Record<number, Centro>
  festivos: Set<string>
}): React.JSX.Element {
  const { toast } = useUI()
  const { anio, mes, trabajadores, centrosPorId, festivos } = props
  const [trabId, setTrabId] = useState<number | null>(null)
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [centrosAsig, setCentrosAsig] = useState<number[]>([])

  useEffect(() => {
    if (!trabId && trabajadores.length) setTrabId(trabajadores[0].id)
  }, [trabajadores, trabId])

  const cargar = useCallback(async () => {
    if (!trabId) return
    const c = await window.api.cuadrante.obtenerOCrear(trabId, anio, mes)
    setTurnos(await window.api.cuadrante.turnos(c.id))
    const asig = await window.api.trabajadores.centrosDe(trabId)
    setCentrosAsig(asig.length ? asig.map((a) => a.centro_id) : Object.keys(centrosPorId).map(Number))
  }, [trabId, anio, mes, centrosPorId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const trabajador = trabajadores.find((t) => t.id === trabId) ?? null

  const guardarTurno = async (t: Turno): Promise<void> => {
    setTurnos((prev) => prev.map((x) => (x.id === t.id ? t : x)))
    await window.api.cuadrante.guardarTurno(t)
  }

  const resumen = useMemo(() => {
    if (!trabajador) return null
    const centroRef = turnos.find((t) => t.centro_id != null)?.centro_id
    const horasAnuales = centroRef ? centrosPorId[centroRef]?.horas_anuales_convenio ?? 0 : trabajador.horas_convenio_completa
    return resumenMesTrabajador(trabajador, horasAnuales, turnos)
  }, [trabajador, turnos, centrosPorId])

  const avisos: Aviso[] = useMemo(() => {
    if (!trabajador) return []
    return avisosMes({ trabajador, turnos, centrosPorId, festivosPorFecha: festivos, anio, mes })
  }, [trabajador, turnos, centrosPorId, festivos, anio, mes])

  const copiarSemanaAnterior = async (): Promise<void> => {
    const porFecha = new Map(turnos.map((t) => [t.fecha, t]))
    const nuevos: Turno[] = []
    for (const t of turnos) {
      const [a, m, d] = t.fecha.split('-').map(Number)
      const prev = new Date(a, m - 1, d - 7)
      const prevIso = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
      const src = porFecha.get(prevIso)
      if (src && src.situacion !== 'libre') {
        nuevos.push({ ...t, situacion: src.situacion, centro_id: src.centro_id, entrada1: src.entrada1, salida1: src.salida1, entrada2: src.entrada2, salida2: src.salida2, descanso_min: src.descanso_min })
      }
    }
    if (!nuevos.length) return toast('No hay semana anterior dentro del mes para copiar')
    const map = new Map(nuevos.map((t) => [t.id, t]))
    setTurnos((prev) => prev.map((t) => map.get(t.id) ?? t))
    await window.api.cuadrante.guardarTurnos(nuevos)
    toast('Copiado el patrón de 7 días antes')
  }

  const [patron, setPatron] = useState({ centro: '', e1: '10:00', s1: '14:00', e2: '', s2: '', descanso: '0' })
  const aplicarPatronLaborables = async (): Promise<void> => {
    const centroId = patron.centro ? Number(patron.centro) : centrosAsig[0]
    if (!centroId) return toast('Asigna un centro al trabajador primero')
    const nuevos = turnos
      .filter((t) => {
        const dw = diaSemanaIso(t.fecha)
        return dw >= 1 && dw <= 5 && !festivos.has(t.fecha)
      })
      .map((t) => ({
        ...t,
        situacion: 'trabaja' as SituacionDia,
        centro_id: centroId,
        entrada1: patron.e1 || null,
        salida1: patron.s1 || null,
        entrada2: patron.e2 || null,
        salida2: patron.s2 || null,
        descanso_min: Number(patron.descanso) || 0
      }))
    setTurnos((prev) => {
      const map = new Map(nuevos.map((t) => [t.id, t]))
      return prev.map((t) => map.get(t.id) ?? t)
    })
    await window.api.cuadrante.guardarTurnos(nuevos)
    toast('Patrón aplicado a los días laborables')
  }

  if (!trabajadores.length) return <Vacio>No hay trabajadores en esta empresa.</Vacio>

  return (
    <>
      <div className="card">
        <div className="row" style={{ alignItems: 'center' }}>
          <label className="field" style={{ minWidth: 260 }}>
            <span>Trabajador/a</span>
            <select value={trabId ?? ''} onChange={(e) => setTrabId(Number(e.target.value))}>
              {trabajadores.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.apellidos}, {t.nombre} {t.tipo === 'autonomo' ? '(autónomo)' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="spacer" />
          <button className="btn small" onClick={copiarSemanaAnterior}>
            ↻ Copiar semana anterior
          </button>
        </div>

        <div className="row" style={{ marginTop: 12, alignItems: 'flex-end', background: 'var(--panel-2)', padding: 12, borderRadius: 10 }}>
          <span style={{ fontSize: 12, alignSelf: 'center' }} className="muted">
            Patrón rápido (L–V):
          </span>
          <select className="mini" value={patron.centro} onChange={(e) => setPatron({ ...patron, centro: e.target.value })}>
            <option value="">Centro principal</option>
            {centrosAsig.map((cid) => (
              <option key={cid} value={cid}>
                {centrosPorId[cid]?.nombre}
              </option>
            ))}
          </select>
          <input className="mini" type="time" value={patron.e1} onChange={(e) => setPatron({ ...patron, e1: e.target.value })} />
          <input className="mini" type="time" value={patron.s1} onChange={(e) => setPatron({ ...patron, s1: e.target.value })} />
          <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>tarde:</span>
          <input className="mini" type="time" value={patron.e2} onChange={(e) => setPatron({ ...patron, e2: e.target.value })} />
          <input className="mini" type="time" value={patron.s2} onChange={(e) => setPatron({ ...patron, s2: e.target.value })} />
          <button className="btn small primary" onClick={aplicarPatronLaborables}>
            Aplicar
          </button>
        </div>
      </div>

      {resumen && trabajador && (
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="kpi">
            <div className="n">{numEs(resumen.horasRealizadas)} h</div>
            <div className="l">Horas del mes</div>
          </div>
          <div className="kpi">
            <div className="n">{numEs(resumen.mediaMensualTeorica)} h</div>
            <div className="l">Media mensual teórica</div>
          </div>
          <div className="kpi">
            <div className="n" style={{ color: resumen.desviacionVsContrato > 0 ? 'var(--warn)' : 'inherit' }}>
              {resumen.desviacionVsContrato > 0 ? '+' : ''}
              {numEs(resumen.desviacionVsContrato)} h
            </div>
            <div className="l">Desviación vs. contrato</div>
          </div>
          {trabajador.tipo === 'ajena' && (
            <div className="kpi">
              <div className="n" style={{ color: resumen.horasComplementarias > 0 ? 'var(--warn)' : 'inherit' }}>
                {numEs(resumen.horasComplementarias)} h
              </div>
              <div className="l">Complementarias ({numEs(resumen.valorComplementarias)} €)</div>
            </div>
          )}
        </div>
      )}

      {avisos.length > 0 && (
        <div className="card">
          <h3>Avisos ({avisos.length})</h3>
          {avisos.map((a, i) => (
            <div key={i} className={'aviso ' + a.nivel}>
              <span>{a.nivel === 'error' ? '⛔' : a.nivel === 'aviso' ? '⚠️' : 'ℹ️'}</span>
              <span>{a.mensaje}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
          Rellena <b>solo Mañana</b> o <b>solo Tarde</b> para media jornada o turno de mañana/tarde; usa
          <b> ambos</b> para turno partido. El botón <b>×</b> vacía un tramo.
        </p>
        <table className="tbl">
          <thead>
            <tr>
              <th>Día</th>
              <th>Situación</th>
              <th>Centro</th>
              <th>Mañana (opcional)</th>
              <th>Tarde (opcional)</th>
              <th>Descanso</th>
              <th>Horas</th>
            </tr>
          </thead>
          <tbody>
            {turnos.map((t) => (
              <FilaTurno
                key={t.id}
                turno={t}
                centrosAsig={centrosAsig}
                centrosPorId={centrosPorId}
                esFestivo={festivos.has(t.fecha)}
                onChange={guardarTurno}
                soloAuto={trabajador?.tipo === 'autonomo'}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function FilaTurno(props: {
  turno: Turno
  centrosAsig: number[]
  centrosPorId: Record<number, Centro>
  esFestivo: boolean
  soloAuto: boolean
  onChange: (t: Turno) => void
}): React.JSX.Element {
  const { turno, centrosAsig, centrosPorId, esFestivo } = props
  const dw = turno.dia_semana
  const finde = dw === 0 || dw === 6
  const trabaja = turno.situacion === 'trabaja'
  const set = (patch: Partial<Turno>): void => props.onChange({ ...turno, ...patch })
  const centro = turno.centro_id ? centrosPorId[turno.centro_id] : null

  return (
    <tr className={finde || esFestivo ? 'finde' : ''}>
      <td>
        <span className="dia-num">{Number(turno.fecha.slice(-2))}</span>{' '}
        <span className="muted">{DIAS_SEMANA_CORTO[dw]}</span>
        {esFestivo && <span className="muted"> · fest.</span>}
      </td>
      <td>
        <select className="mini" value={turno.situacion} onChange={(e) => set({ situacion: e.target.value as SituacionDia })}>
          {SITUACIONES.map((s) => (
            <option key={s.v} value={s.v}>
              {s.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        {trabaja ? (
          <select
            className="mini"
            value={turno.centro_id ?? ''}
            onChange={(e) => set({ centro_id: e.target.value ? Number(e.target.value) : null })}
            style={centro ? { borderLeft: `4px solid ${centro.color}` } : undefined}
          >
            <option value="">— centro —</option>
            {centrosAsig.map((cid) => (
              <option key={cid} value={cid}>
                {centrosPorId[cid]?.nombre}
              </option>
            ))}
          </select>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        {trabaja ? (
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input className="mini" type="time" value={turno.entrada1 ?? ''} onChange={(e) => set({ entrada1: e.target.value || null })} />
            <input className="mini" type="time" value={turno.salida1 ?? ''} onChange={(e) => set({ salida1: e.target.value || null })} />
            {(turno.entrada1 || turno.salida1) && (
              <button className="btn-x" title="Vaciar mañana" onClick={() => set({ entrada1: null, salida1: null })}>
                ×
              </button>
            )}
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        {trabaja ? (
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input className="mini" type="time" value={turno.entrada2 ?? ''} onChange={(e) => set({ entrada2: e.target.value || null })} />
            <input className="mini" type="time" value={turno.salida2 ?? ''} onChange={(e) => set({ salida2: e.target.value || null })} />
            {(turno.entrada2 || turno.salida2) && (
              <button className="btn-x" title="Vaciar tarde" onClick={() => set({ entrada2: null, salida2: null })}>
                ×
              </button>
            )}
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        {trabaja ? (
          <input className="mini" type="number" style={{ width: 64 }} value={turno.descanso_min} onChange={(e) => set({ descanso_min: Number(e.target.value) || 0 })} />
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        <b>{trabaja ? numEs(horasDia(turno)) : ''}</b>
      </td>
    </tr>
  )
}

// ------------------------------------------------------------- Vista por centro
function VistaCentro(props: {
  empresaId: number
  anio: number
  mes: number
  centros: Centro[]
  trabajadores: Trabajador[]
}): React.JSX.Element {
  const { empresaId, anio, mes, centros, trabajadores } = props
  const [turnos, setTurnos] = useState<Array<Turno & { trabajador_id: number }>>([])

  useEffect(() => {
    window.api.cuadrante.turnosMesEmpresa(empresaId, anio, mes).then(setTurnos)
  }, [empresaId, anio, mes])

  const nombrePorTrab = useMemo(() => {
    const m: Record<number, string> = {}
    for (const t of trabajadores) m[t.id] = t.apellidos || t.nombre
    return m
  }, [trabajadores])

  const dias = useMemo(() => {
    const total = new Date(anio, mes, 0).getDate()
    return Array.from({ length: total }, (_, i) => i + 1)
  }, [anio, mes])

  const turnosPorDiaCentro = useMemo(() => {
    const m = new Map<string, Array<Turno & { trabajador_id: number }>>()
    for (const t of turnos) {
      if (t.situacion !== 'trabaja' || t.centro_id == null) continue
      const key = `${t.fecha}|${t.centro_id}`
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(t)
    }
    return m
  }, [turnos])

  if (!centros.length) return <Vacio>No hay centros en esta empresa.</Vacio>

  const mm = String(mes).padStart(2, '0')

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table className="cal">
        <thead>
          <tr>
            <th>Día</th>
            {centros.map((c) => (
              <th key={c.id}>
                <span className="swatch" style={{ background: c.color }} /> {c.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => {
            const fecha = `${anio}-${mm}-${String(d).padStart(2, '0')}`
            const dw = diaSemanaIso(fecha)
            const finde = dw === 0 || dw === 6
            return (
              <tr key={d}>
                <td className={finde ? 'finde' : ''}>
                  <span className="dia-num">{d}</span> {DIAS_SEMANA_CORTO[dw]}
                </td>
                {centros.map((c) => {
                  const lst = turnosPorDiaCentro.get(`${fecha}|${c.id}`) ?? []
                  return (
                    <td key={c.id} className={finde ? 'finde' : ''}>
                      {lst.map((t) => (
                        <div key={t.id} style={{ marginBottom: 2 }}>
                          <span className="pill" style={{ background: c.color }}>
                            {nombrePorTrab[t.trabajador_id] ?? '?'}
                          </span>{' '}
                          <span className="muted" style={{ fontSize: 11 }}>
                            {t.entrada1}–{t.salida1}
                            {t.entrada2 ? ` / ${t.entrada2}–${t.salida2}` : ''}
                          </span>
                        </div>
                      ))}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 10 }}>
        Vista de solo lectura para comprobar la cobertura de apertura. Edita los turnos en la vista por trabajador.
      </p>
    </div>
  )
}
