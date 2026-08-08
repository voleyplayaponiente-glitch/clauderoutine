import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, EstadoVacio, ImporteEuro } from '../componentes/ui'
import { Campo, CampoNumero, Select, Modal } from '../componentes/formularios'
import { nuevoId } from '../dominio/id'
import { cuotasDeudaPorMes, gastosBancariosPorMes } from '../dominio/resumen-compras'
import { aCentimos, aEuros, formatearEuro } from '../dominio/dinero'
import { brutoVenta } from '../dominio/ventas'
import { totalesCompra } from '../dominio/compras'
import type { Presupuesto as TPresupuesto, LineaPresupuesto, TipoLineaPresupuesto } from '../dominio/tipos'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const TIPOS: { valor: TipoLineaPresupuesto; texto: string; signo: 1 | -1 }[] = [
  { valor: 'INGRESO', texto: 'Ingreso', signo: 1 },
  { valor: 'COSTE_VENTAS', texto: 'Coste de ventas', signo: -1 },
  { valor: 'GASTO', texto: 'Gasto', signo: -1 },
  { valor: 'INVERSION', texto: 'Inversión', signo: -1 },
  { valor: 'FINANCIACION', texto: 'Financiación', signo: -1 },
]

function presupuestoNuevo(ejercicio: number): TPresupuesto {
  const linea = (concepto: string, tipo: TipoLineaPresupuesto): LineaPresupuesto => ({ id: nuevoId(), concepto, tipo, meses: Array(12).fill(0) })
  return { id: nuevoId(), ejercicio, factorCrecimiento: 0, lineas: [linea('Ventas', 'INGRESO'), linea('Coste de ventas', 'COSTE_VENTAS'), linea('Gastos generales', 'GASTO')] }
}

export function Presupuesto() {
  const config = useStore((s) => s.config)
  const datos = useStore((s) => s.datos)
  const guardar = useStore((s) => s.guardarPresupuesto)
  const [ejercicio, setEjercicio] = useState(config.empresa.ejercicioActual)
  const [vista, setVista] = useState<'presupuesto' | 'real' | 'desviacion'>('presupuesto')
  const [nuevaLinea, setNuevaLinea] = useState<{ concepto: string; tipo: TipoLineaPresupuesto } | null>(null)

  const presupuesto = datos.presupuestos.find((p) => p.ejercicio === ejercicio)

  /**
   * Trae al presupuesto lo que ya está registrado en la app: las cuotas de la
   * deuda aplazada (del cuadro de amortización de cada préstamo o aplazamiento)
   * y los gastos que nacen en las cuentas bancarias. No se estima nada; si una
   * línea ya existe se actualizan sus importes en vez de duplicarla.
   */
  const traerDeudaYBanco = () => {
    if (!presupuesto) return
    const deuda = cuotasDeudaPorMes(datos.deudas, ejercicio)
    const banco = gastosBancariosPorMes(datos.movimientos, config.categoriasGasto, ejercicio)
    if (deuda.length === 0 && banco.length === 0) {
      window.alert(
        'No hay nada que traer todavía.\n\n· Las cuotas salen de las deudas registradas en la pantalla de Deudas.\n· Los gastos bancarios salen de los movimientos marcados con una categoría bancaria en Bancos.',
      )
      return
    }

    const nuevas = [
      ...deuda.map((d) => ({ concepto: `Deuda: ${d.concepto}`, tipo: 'FINANCIACION' as const, meses: d.meses })),
      ...banco.map((b) => ({ concepto: `Banco: ${b.categoria}`, tipo: 'GASTO' as const, meses: b.meses })),
    ]

    let lineas = [...presupuesto.lineas]
    for (const n of nuevas) {
      const i = lineas.findIndex((l) => l.concepto === n.concepto)
      if (i === -1) lineas = [...lineas, { id: nuevoId(), concepto: n.concepto, tipo: n.tipo, meses: n.meses }]
      else lineas[i] = { ...lineas[i], meses: n.meses }
    }
    guardar({ ...presupuesto, lineas })
  }

  // Real por mes y tipo (del ejercicio seleccionado).
  const real = useMemo(() => {
    const ingreso = Array(12).fill(0)
    const coste = Array(12).fill(0)
    const gasto = Array(12).fill(0)
    for (const v of datos.ventas) {
      if (v.anuladoEn || Number(v.fecha.slice(0, 4)) !== ejercicio) continue
      const m = Number(v.fecha.slice(5, 7)) - 1
      ingreso[m] = aEuros(aCentimos(ingreso[m]) + aCentimos(brutoVenta(v)))
    }
    for (const c of datos.compras) {
      if (c.anuladoEn || Number(c.fechaFactura.slice(0, 4)) !== ejercicio) continue
      const m = Number(c.fechaFactura.slice(5, 7)) - 1
      const tot = totalesCompra(c).base
      if (c.naturaleza === 'MERCADERIA') coste[m] = aEuros(aCentimos(coste[m]) + aCentimos(tot))
      else gasto[m] = aEuros(aCentimos(gasto[m]) + aCentimos(tot))
    }
    return { INGRESO: ingreso, COSTE_VENTAS: coste, GASTO: gasto, INVERSION: Array(12).fill(0), FINANCIACION: Array(12).fill(0) } as Record<TipoLineaPresupuesto, number[]>
  }, [datos.ventas, datos.compras, ejercicio])

  const realLinea = (l: LineaPresupuesto): number[] => real[l.tipo]

  const setCelda = (lineaId: string, mes: number, valor: number) => {
    if (!presupuesto) return
    const lineas = presupuesto.lineas.map((l) => l.id === lineaId ? { ...l, meses: l.meses.map((v, i) => (i === mes ? valor : v)) } : l)
    guardar({ ...presupuesto, lineas })
  }
  const generarDesdeHistorico = () => {
    if (!presupuesto) return
    const f = 1 + presupuesto.factorCrecimiento / 100
    const lineas = presupuesto.lineas.map((l) => ({ ...l, meses: realLinea(l).map((v) => aEuros(Math.round(aCentimos(v) * f))) }))
    guardar({ ...presupuesto, lineas })
  }
  const anadirLinea = () => {
    if (!presupuesto || !nuevaLinea?.concepto.trim()) return
    guardar({ ...presupuesto, lineas: [...presupuesto.lineas, { id: nuevoId(), concepto: nuevaLinea.concepto, tipo: nuevaLinea.tipo, meses: Array(12).fill(0) }] })
    setNuevaLinea(null)
  }

  const anios = Array.from({ length: 6 }, (_, i) => config.empresa.ejercicioActual - 2 + i)

  const valorMostrado = (l: LineaPresupuesto, mes: number): number => {
    if (vista === 'presupuesto') return l.meses[mes]
    if (vista === 'real') return realLinea(l)[mes]
    return aEuros(aCentimos(realLinea(l)[mes]) - aCentimos(l.meses[mes]))
  }
  const totalLinea = (l: LineaPresupuesto): number => {
    let c = 0
    for (let m = 0; m < 12; m++) c += aCentimos(valorMostrado(l, m))
    return aEuros(c)
  }

  // Resumen anual (presupuesto): margen y resultado.
  const totalTipo = (tipo: TipoLineaPresupuesto, fuente: 'pre' | 'real') => {
    let c = 0
    for (const l of (presupuesto?.lineas ?? [])) if (l.tipo === tipo) for (let m = 0; m < 12; m++) c += aCentimos(fuente === 'pre' ? l.meses[m] : realLinea(l)[m])
    return aEuros(c)
  }
  const resumen = (fuente: 'pre' | 'real') => {
    const ing = totalTipo('INGRESO', fuente)
    const cv = totalTipo('COSTE_VENTAS', fuente)
    const ga = totalTipo('GASTO', fuente)
    const margen = aEuros(aCentimos(ing) - aCentimos(cv))
    const resultado = aEuros(aCentimos(margen) - aCentimos(ga))
    return { ing, cv, ga, margen, resultado }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <CabeceraPantalla titulo="Presupuesto y cash flow" descripcion="Presupuesto anual por línea, comparado con el real y su desviación." />
        <div className="w-32"><Select etiqueta="" valor={String(ejercicio)} onChange={(v) => setEjercicio(Number(v))} opciones={anios.map((a) => ({ valor: String(a), texto: String(a) }))} /></div>
      </div>

      {!presupuesto ? (
        <Tarjeta><EstadoVacio icono="presupuesto" titulo={`Sin presupuesto para ${ejercicio}`} descripcion="Crea el presupuesto anual con líneas por ingreso, coste de ventas y gastos. Podrás compararlo con el real mes a mes y generarlo desde el histórico." accion={<Boton onClick={() => guardar(presupuestoNuevo(ejercicio))}>Crear presupuesto {ejercicio}</Boton>} /></Tarjeta>
      ) : (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(() => { const r = resumen('pre'); const rr = resumen('real'); return [
              { t: 'Ingresos', v: r.ing, real: rr.ing },
              { t: 'Margen bruto', v: r.margen, real: rr.margen },
              { t: 'Gastos', v: r.ga, real: rr.ga },
              { t: 'Resultado', v: r.resultado, real: rr.resultado },
            ].map((x) => (
              <Tarjeta key={x.t} className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{x.t}</div><div className="text-lg font-semibold"><ImporteEuro valor={x.v} /></div><div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Real <ImporteEuro valor={x.real} /></div></Tarjeta>
            )) })()}
          </div>

          {/* Controles */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {(['presupuesto', 'real', 'desviacion'] as const).map((v) => (
                <button key={v} onClick={() => setVista(v)} className="rounded-lg px-3 py-1.5 text-sm capitalize" style={{ background: vista === v ? 'var(--color-brand-500)' : 'var(--surface)', color: vista === v ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>{v === 'desviacion' ? 'Desviación' : v}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-28"><CampoNumero etiqueta="" valor={presupuesto.factorCrecimiento} onChange={(v) => guardar({ ...presupuesto, factorCrecimiento: v })} sufijo="% crec." /></div>
              <Boton variante="secundario" onClick={generarDesdeHistorico}>Generar desde histórico</Boton>
              <Boton variante="secundario" onClick={traerDeudaYBanco}>Traer deuda y gastos del banco</Boton>
              <Boton onClick={() => setNuevaLinea({ concepto: '', tipo: 'GASTO' })}>+ Línea</Boton>
            </div>
          </div>

          <Tarjeta className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-sm" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                    <th className="px-3 py-2 font-medium sticky left-0" style={{ background: 'var(--surface)' }}>Línea</th>
                    {MESES.map((m) => <th key={m} className="px-2 py-2 font-medium text-right">{m}</th>)}
                    <th className="px-3 py-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {presupuesto.lineas.map((l) => (
                    <tr key={l.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-3 py-1.5 sticky left-0" style={{ background: 'var(--surface)' }}>
                        <div className="font-medium">{l.concepto}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{TIPOS.find((t) => t.valor === l.tipo)?.texto}</div>
                      </td>
                      {Array.from({ length: 12 }, (_, m) => (
                        <td key={m} className="px-1 py-1 text-right">
                          {vista === 'presupuesto' ? (
                            <input type="number" value={l.meses[m] || ''} onChange={(e) => setCelda(l.id, m, Number(e.target.value))} className="w-16 rounded px-1 py-0.5 text-xs tabular text-right" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                          ) : (
                            <span className="tabular text-xs" style={{ color: vista === 'desviacion' ? (valorMostrado(l, m) >= 0 ? 'var(--pos)' : 'var(--neg)') : 'var(--text)' }}>{formatearEuro(valorMostrado(l, m), { conSimbolo: false, decimales: 0 })}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-medium tabular">{formatearEuro(totalLinea(l), { decimales: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Los importes de línea son base (sin IVA). El «real» se calcula de ventas y compras del ejercicio. Reforecast: combina meses cerrados a real con los futuros a presupuesto.</p>
        </div>
      )}

      {nuevaLinea && (
        <Modal titulo="Nueva línea de presupuesto" onCerrar={() => setNuevaLinea(null)}>
          <div className="space-y-4">
            <Campo etiqueta="Concepto" valor={nuevaLinea.concepto} onChange={(v) => setNuevaLinea({ ...nuevaLinea, concepto: v })} autoFocus />
            <Select etiqueta="Tipo" valor={nuevaLinea.tipo} onChange={(v) => setNuevaLinea({ ...nuevaLinea, tipo: v })} opciones={TIPOS.map((t) => ({ valor: t.valor, texto: t.texto }))} />
            <div className="flex justify-end gap-2 pt-1"><Boton variante="secundario" onClick={() => setNuevaLinea(null)}>Cancelar</Boton><Boton onClick={anadirLinea}>Añadir</Boton></div>
          </div>
        </Modal>
      )}
    </>
  )
}
