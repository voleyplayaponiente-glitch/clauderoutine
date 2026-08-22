import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, Semaforo, ImporteEuro } from '../componentes/ui'
import { Select } from '../componentes/formularios'
import { formatearEuro, formatearPorcentaje } from '../dominio/dinero'
import { formatearFecha } from '../lib/fechas'
import { generarAsientos } from '../lib/contabilidad'
import { sumasYSaldos, cuentaPyG, balanceSituacion } from '../dominio/libros'
import { libroRepercutido, libroSoportado, resumen303, modelo347 } from '../dominio/registros-fiscales'
import { exportarCSV, exportarExcel, exportarPDF, type SeccionPDF } from '../lib/exportar'
import { calcularDashboard } from '../lib/dashboard'
import { listadoDeudas, type FilaDeuda, type ListadoGrupo } from '../dominio/listado-deudas'
import { deudasDelGrupo } from '../lib/grupo'
import { hoyISO } from '../lib/fechas'

const TABS = [
  { id: 'iva', texto: 'Libro IVA y 303' },
  { id: '347', texto: 'Modelo 347' },
  { id: 'sumas', texto: 'Sumas y saldos' },
  { id: 'balance', texto: 'Balance' },
  { id: 'pyg', texto: 'Pérdidas y Ganancias' },
  { id: 'deudas', texto: 'Deudas' },
  { id: 'ejecutivo', texto: 'Informe ejecutivo' },
] as const

const fmt = (n: number) => formatearEuro(n)

export function Informes() {
  const config = useStore((s) => s.config)
  const datos = useStore((s) => s.datos)
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('iva')
  const [ejercicio, setEjercicio] = useState(config.empresa.ejercicioActual)
  const anios = Array.from({ length: 6 }, (_, i) => config.empresa.ejercicioActual - 4 + i)

  const nombreTercero = (id: string) => datos.terceros.find((t) => t.id === id)?.nombre ?? '—'
  const del = (f: string) => Number(f.slice(0, 4)) === ejercicio
  const ventasEj = datos.ventas.filter((v) => !v.anuladoEn && del(v.fecha))
  const comprasEj = datos.compras.filter((c) => !c.anuladoEn && del(c.fechaFactura))

  const { sumas, pyg, balance } = useMemo(() => {
    const asientos = generarAsientos(datos, ejercicio)
    const s = sumasYSaldos(asientos)
    return { sumas: s, pyg: cuentaPyG(s.cuentas), balance: balanceSituacion(s.cuentas) }
  }, [datos, ejercicio])

  const repercutido = libroRepercutido(ventasEj)
  const soportado = libroSoportado(comprasEj, nombreTercero)
  const r303 = resumen303(repercutido, soportado)
  const reg347 = modelo347(comprasEj, {}, datos.terceros, ejercicio)

  // El listado es «a día de hoy», no del ejercicio elegido: el capital vivo y
  // la cuota que toca son cifras del momento, no de un año cerrado.
  const deudas = useMemo(() => listadoDeudas(datos, hoyISO()), [datos])

  // Vista de grupo: los datos de las otras sociedades viven en otros espacios
  // de IndexedDB, así que hay que ir a buscarlos (asíncrono). Solo se cargan si
  // se pide, para no leer tres bases de datos cada vez que se abre Informes.
  const grupo = useStore((s) => s.grupo)
  const [ambito, setAmbito] = useState<'EMPRESA' | 'GRUPO'>('EMPRESA')
  const [deudasGrupo, setDeudasGrupo] = useState<ListadoGrupo | null>(null)
  useEffect(() => {
    if (ambito !== 'GRUPO' || !grupo) return
    let vigente = true
    void deudasDelGrupo(grupo, hoyISO()).then((r) => { if (vigente) setDeudasGrupo(r) })
    return () => { vigente = false }
  }, [ambito, grupo, datos])
  const filasDeudaExport = deudas.grupos.flatMap((g) =>
    g.filas.map((f) => [
      g.titulo,
      f.tipo,
      f.acreedor,
      f.detalle ?? '',
      f.importeInicial === undefined ? '' : fmt(f.importeInicial),
      fmt(f.capitalPendiente),
      f.cuota === undefined ? '' : fmt(f.cuota),
      f.periodicidad ?? '',
      f.tipoInteres === undefined ? '' : formatearPorcentaje(f.tipoInteres, 2),
    ]),
  )

  const filasGrupoExport = (deudasGrupo?.empresas ?? []).flatMap((e) =>
    e.listado.grupos.flatMap((g) =>
      g.filas.map((f) => [
        e.razonSocial,
        g.titulo,
        f.tipo,
        f.acreedor,
        f.detalle ?? '',
        f.importeInicial === undefined ? '' : fmt(f.importeInicial),
        fmt(f.capitalPendiente),
        f.cuota === undefined ? '' : fmt(f.cuota),
        f.periodicidad ?? '',
        f.tipoInteres === undefined ? '' : formatearPorcentaje(f.tipoInteres, 2),
      ]),
    ),
  )

  const metaPDF = { empresa: config.empresa.razonSocial || 'Empresa', cif: config.empresa.cif, logoDataUrl: config.empresa.logoDataUrl }

  const informeEjecutivo = async () => {
    const d = calcularDashboard(datos, config, hoyISO())
    const secciones: SeccionPDF[] = [
      { titulo: 'Resumen ejecutivo', cabeceras: ['Indicador', 'Valor'], filas: [
        ['Tesorería', fmt(d.tesoreria)], ['Venta del mes', fmt(d.ventaMes)], ['Margen bruto', formatearPorcentaje(d.margenBrutoPct)],
        ['Resultado del mes', fmt(d.resultadoMes)], ['Deuda total', fmt(d.deudaTotal)], ['Stock valorado', fmt(d.stockValorado)],
      ] },
      { titulo: `IVA (modelo 303) · ${ejercicio}`, cabeceras: ['Concepto', 'Importe'], filas: [
        ['IVA repercutido', fmt(r303.ivaRepercutido)], ['IVA soportado', fmt(r303.ivaSoportado)], ['Resultado 303', fmt(r303.resultado)],
      ] },
      { titulo: `Cuenta de Pérdidas y Ganancias · ${ejercicio}`, cabeceras: ['Concepto', 'Importe'], filas: [
        ['Ingresos', fmt(pyg.ingresos)], ['Gastos', fmt(pyg.gastos)], ['Resultado', fmt(pyg.resultado)],
      ] },
      { titulo: `Balance de Situación · ${ejercicio}`, cabeceras: ['Masa', 'Importe'], filas: [
        ['Total Activo', fmt(balance.totalActivo)], ['Total Pasivo + PN', fmt(balance.totalPasivoPN)], ['Cuadra', balance.cuadra ? 'Sí' : 'NO'],
      ] },
    ]
    await exportarPDF(`informe-ejecutivo-${ejercicio}`, { titulo: 'Informe ejecutivo mensual', subtitulo: formatearFecha(hoyISO()), ...metaPDF }, secciones)
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <CabeceraPantalla titulo="Listados e informes" descripcion="Libros de IVA, modelo 347, balance, P&G e informe ejecutivo, exportables a CSV, Excel y PDF." />
        <div className="w-28"><Select etiqueta="" valor={String(ejercicio)} onChange={(v) => setEjercicio(Number(v))} opciones={anios.map((a) => ({ valor: String(a), texto: String(a) }))} /></div>
      </div>

      <div className="flex gap-1 mb-6 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }} role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="px-3.5 py-2 text-sm whitespace-nowrap rounded-t-lg" style={{ color: tab === t.id ? 'var(--text)' : 'var(--text-muted)', fontWeight: tab === t.id ? 600 : 400, borderBottom: tab === t.id ? '2px solid var(--color-brand-500)' : '2px solid transparent' }}>{t.texto}</button>
        ))}
      </div>

      {tab === 'iva' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>IVA repercutido</div><div className="text-lg font-semibold"><ImporteEuro valor={r303.ivaRepercutido} /></div></Tarjeta>
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>IVA soportado</div><div className="text-lg font-semibold"><ImporteEuro valor={r303.ivaSoportado} /></div></Tarjeta>
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Resultado 303</div><div className="text-lg font-semibold"><ImporteEuro valor={r303.resultado} color /></div><div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r303.resultado >= 0 ? 'A ingresar' : 'A compensar'}</div></Tarjeta>
            <Tarjeta className="!p-4 flex items-center"><ExportBotones nombre={`libro-iva-${ejercicio}`} tituloPDF="Libro registro de IVA" meta={metaPDF} cabeceras={['Tipo', 'Fecha', 'Concepto', 'Base', 'IVA %', 'Cuota']} filas={[...repercutido.map((l) => ['Repercutido', formatearFecha(l.fecha), l.concepto, fmt(l.base), formatearPorcentaje(l.tipo), fmt(l.cuota)]), ...soportado.map((l) => ['Soportado', formatearFecha(l.fecha), l.concepto, fmt(l.base), formatearPorcentaje(l.tipo), fmt(l.cuota)])]} /></Tarjeta>
          </div>
          <TablaLibro titulo="IVA repercutido" filas={repercutido} />
          <TablaLibro titulo="IVA soportado (deducible)" filas={soportado} />
        </div>
      )}

      {tab === '347' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Operaciones con terceros que superan 3.005,06 € en {ejercicio}.</p>
            <ExportBotones nombre={`modelo-347-${ejercicio}`} tituloPDF={`Modelo 347 · ${ejercicio}`} meta={metaPDF} cabeceras={['Tercero', 'Compras', 'Ventas', 'Total']} filas={reg347.map((r) => [r.nombre, fmt(r.compras), fmt(r.ventas), fmt(r.total)])} />
          </div>
          <TablaSimple cabeceras={['Tercero', 'Compras', 'Ventas', 'Total']} filas={reg347.map((r) => [r.nombre, fmt(r.compras), fmt(r.ventas), fmt(r.total)])} alinearDerecha={[1, 2, 3]} vacio="Ninguna operación supera el umbral en el ejercicio." />
        </div>
      )}

      {tab === 'sumas' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Semaforo estado={sumas.cuadra ? 'positivo' : 'negativo'} texto={sumas.cuadra ? `Cuadra · ${fmt(sumas.totalDebe)}` : 'DESCUADRE'} />
            <ExportBotones nombre={`sumas-saldos-${ejercicio}`} tituloPDF={`Balance de sumas y saldos · ${ejercicio}`} meta={metaPDF} cabeceras={['Cuenta', 'Debe', 'Haber', 'Saldo']} filas={sumas.cuentas.map((c) => [c.cuenta, fmt(c.debe), fmt(c.haber), fmt(c.saldo)])} />
          </div>
          <TablaSimple cabeceras={['Cuenta', 'Debe', 'Haber', 'Saldo']} filas={sumas.cuentas.map((c) => [c.cuenta, fmt(c.debe), fmt(c.haber), fmt(c.saldo)])} alinearDerecha={[1, 2, 3]} total={['Total', fmt(sumas.totalDebe), fmt(sumas.totalHaber), '']} vacio="Sin asientos en el ejercicio." />
        </div>
      )}

      {tab === 'balance' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Semaforo estado={balance.cuadra ? 'positivo' : 'negativo'} texto={balance.cuadra ? 'Activo = Pasivo + PN' : 'DESCUADRE'} />
            <ExportBotones nombre={`balance-situacion-${ejercicio}`} tituloPDF={`Balance de Situación · ${ejercicio}`} meta={metaPDF} cabeceras={['Masa', 'Cuenta', 'Importe']} filas={[...balance.activo.map((m) => ['Activo', m.cuenta, fmt(m.importe)]), ...balance.pasivo.map((m) => ['Pasivo', m.cuenta, fmt(m.importe)]), ...balance.patrimonioNeto.map((m) => ['PN', m.cuenta, fmt(m.importe)])]} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Tarjeta><h3 className="font-semibold mb-2">Activo <span className="float-right"><ImporteEuro valor={balance.totalActivo} /></span></h3><Masas filas={balance.activo} /></Tarjeta>
            <Tarjeta>
              <h3 className="font-semibold mb-2">Pasivo + Patrimonio Neto <span className="float-right"><ImporteEuro valor={balance.totalPasivoPN} /></span></h3>
              <Masas filas={balance.pasivo} />
              <div className="my-2 border-t" style={{ borderColor: 'var(--border)' }} />
              <Masas filas={balance.patrimonioNeto} />
            </Tarjeta>
          </div>
        </div>
      )}

      {tab === 'pyg' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-lg font-semibold">Resultado del ejercicio: <ImporteEuro valor={pyg.resultado} color /></div>
            <ExportBotones nombre={`pyg-${ejercicio}`} tituloPDF={`Cuenta de Pérdidas y Ganancias · ${ejercicio}`} meta={metaPDF} cabeceras={['Tipo', 'Cuenta', 'Importe']} filas={[...pyg.lineasIngreso.map((l) => ['Ingreso', l.cuenta, fmt(l.importe)]), ...pyg.lineasGasto.map((l) => ['Gasto', l.cuenta, fmt(l.importe)])]} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Tarjeta><h3 className="font-semibold mb-2">Ingresos <span className="float-right"><ImporteEuro valor={pyg.ingresos} /></span></h3><Masas filas={pyg.lineasIngreso} /></Tarjeta>
            <Tarjeta><h3 className="font-semibold mb-2">Gastos <span className="float-right"><ImporteEuro valor={pyg.gastos} /></span></h3><Masas filas={pyg.lineasGasto} /></Tarjeta>
          </div>
        </div>
      )}

      {tab === 'deudas' && (
        <div className="space-y-5">
          {(grupo?.empresas.length ?? 0) > 1 && (
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)' }} role="tablist">
              {([['EMPRESA', config.empresa.razonSocial || 'Esta empresa'], ['GRUPO', 'Todas las empresas']] as const).map(([id, texto]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={ambito === id}
                  onClick={() => setAmbito(id)}
                  className="px-3 py-1.5 text-sm rounded-lg"
                  style={{
                    background: ambito === id ? 'var(--surface)' : 'transparent',
                    fontWeight: ambito === id ? 600 : 400,
                    border: ambito === id ? '1px solid var(--border)' : '1px solid transparent',
                  }}
                >
                  {texto}
                </button>
              ))}
            </div>
          )}

          {ambito === 'GRUPO' ? (
            <DeudasDeGrupo datos={deudasGrupo} filasExport={filasGrupoExport} meta={metaPDF} />
          ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <div className="text-lg font-semibold">
                Total pendiente: <ImporteEuro valor={deudas.totalPendiente} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                A día de hoy, no del ejercicio elegido: el capital vivo y la cuota que toca son cifras del momento.
                Cuota mensual equivalente: {fmt(deudas.totalCuotaMensual)}.
              </p>
            </div>
            <ExportBotones
              nombre={`deudas-${config.empresa.razonSocial || 'empresa'}`}
              tituloPDF="Detalle de deudas"
              meta={metaPDF}
              cabeceras={['Bloque', 'Tipo', 'Acreedor', 'Detalle', 'Importe inicial', 'Capital pendiente', 'Cuota', 'Periodicidad', 'Tipo interés']}
              filas={filasDeudaExport}
            />
          </div>

          {deudas.grupos.map((g) => (
            <div key={g.grupo}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <h3 className="font-semibold">{g.titulo}</h3>
                <div className="text-sm">
                  <ImporteEuro valor={g.totalPendiente} />
                  {g.totalCuotaMensual > 0 && (
                    <span style={{ color: 'var(--text-muted)' }}> · {fmt(g.totalCuotaMensual)}/mes</span>
                  )}
                </div>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{g.descripcion}</p>
              <TablaDeudas filas={g.filas} />
            </div>
          ))}
        </div>
          )}
        </div>
      )}

      {tab === 'ejecutivo' && (
        <Tarjeta>
          <h3 className="font-semibold mb-1">Informe ejecutivo mensual</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Un PDF con portada, resumen de indicadores, IVA (303), P&G y balance, listo para presentar a dirección, asesoría o banco.</p>
          <Boton onClick={informeEjecutivo}>Generar PDF</Boton>
        </Tarjeta>
      )}
    </>
  )
}

function ExportBotones({ nombre, cabeceras, filas, tituloPDF, meta }: { nombre: string; cabeceras: string[]; filas: (string | number)[][]; tituloPDF: string; meta: { empresa?: string; cif?: string; logoDataUrl?: string } }) {
  return (
    <div className="flex gap-1.5">
      <button className="text-xs rounded-lg px-2.5 py-1.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} onClick={() => exportarCSV(nombre, cabeceras, filas)}>CSV</button>
      <button className="text-xs rounded-lg px-2.5 py-1.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} onClick={() => void exportarExcel(nombre, cabeceras, filas)}>Excel</button>
      <button className="text-xs rounded-lg px-2.5 py-1.5" style={{ background: 'var(--color-brand-500)', color: '#fff' }} onClick={() => void exportarPDF(nombre, { titulo: tituloPDF, ...meta }, [{ titulo: tituloPDF, cabeceras, filas }])}>PDF</button>
    </div>
  )
}

function TablaLibro({ titulo, filas }: { titulo: string; filas: { fecha: string; concepto: string; base: number; tipo: number; cuota: number }[] }) {
  return (
    <div>
      <h3 className="font-semibold mb-2">{titulo}</h3>
      <TablaSimple cabeceras={['Fecha', 'Concepto', 'Base', 'IVA %', 'Cuota']} alinearDerecha={[2, 3, 4]} filas={filas.map((l) => [formatearFecha(l.fecha), l.concepto, fmt(l.base), formatearPorcentaje(l.tipo), fmt(l.cuota)])} vacio="Sin registros en el ejercicio." />
    </div>
  )
}

function TablaSimple({ cabeceras, filas, alinearDerecha = [], total, vacio }: { cabeceras: string[]; filas: (string | number)[][]; alinearDerecha?: number[]; total?: (string | number)[]; vacio?: string }) {
  if (filas.length === 0) return <Tarjeta><p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>{vacio ?? 'Sin datos.'}</p></Tarjeta>
  return (
    <Tarjeta className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left">{cabeceras.map((c, i) => <th key={i} className={`px-4 py-2.5 font-medium ${alinearDerecha.includes(i) ? 'text-right' : ''}`}>{c}</th>)}</tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                {f.map((c, j) => <td key={j} className={`px-4 py-2 ${alinearDerecha.includes(j) ? 'text-right tabular' : ''} ${j === 0 ? 'tabular font-medium' : ''}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
          {total && <tfoot><tr className="border-t-2" style={{ borderColor: 'var(--border)' }}>{total.map((c, i) => <td key={i} className={`px-4 py-2.5 font-semibold ${alinearDerecha.includes(i) ? 'text-right tabular' : ''}`}>{c}</td>)}</tr></tfoot>}
        </table>
      </div>
    </Tarjeta>
  )
}

function Masas({ filas }: { filas: { cuenta: string; importe: number }[] }) {
  if (filas.length === 0) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>—</p>
  return (
    <div className="space-y-1 text-sm">
      {filas.map((m, i) => (
        <div key={i} className="flex justify-between"><span className="tabular">{m.cuenta}</span><ImporteEuro valor={m.importe} /></div>
      ))}
    </div>
  )
}

/**
 * Tabla del listado de deudas.
 *
 * **Una casilla vacía se pinta como «—», nunca como 0.** Una póliza no tiene
 * cuota y un renting no tiene tipo de interés: un cero ahí se leería como «al
 * 0 %», que es un dato distinto y falso. La explicación va debajo de la fila.
 */
function TablaDeudas({ filas }: { filas: FilaDeuda[] }) {
  if (filas.length === 0) {
    return (
      <Tarjeta>
        <p className="text-sm text-center py-5" style={{ color: 'var(--text-muted)' }}>Sin deudas en este bloque.</p>
      </Tarjeta>
    )
  }
  const vacio = <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <Tarjeta className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--text-muted)' }} className="text-left">
              <th className="px-4 py-2.5 font-medium">Tipo</th>
              <th className="px-4 py-2.5 font-medium">Acreedor</th>
              <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Importe inicial</th>
              <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Capital pendiente</th>
              <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Cuota</th>
              <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Interés</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className="border-t align-top" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-2.5">
                  {f.tipo}
                  {f.esCompromiso && (
                    <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>(compromiso)</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {f.acreedor}
                  {f.detalle && (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{f.detalle}</div>
                  )}
                  {f.nota && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.nota}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {f.importeInicial === undefined ? vacio : <ImporteEuro valor={f.importeInicial} />}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                  <ImporteEuro valor={f.capitalPendiente} />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {f.cuota === undefined ? vacio : <ImporteEuro valor={f.cuota} />}
                  {f.periodicidad && f.periodicidad !== 'MENSUAL' && (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{f.periodicidad.toLowerCase()}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {f.tipoInteres === undefined ? vacio : formatearPorcentaje(f.tipoInteres, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  )
}

/**
 * Deudas de TODAS las sociedades, una sección por empresa.
 *
 * **Sumar no es consolidar**: lo que unas empresas se deben a otras aparece dos
 * veces (pasivo aquí, activo allí). No se resta por nuestra cuenta —eso es una
 * consolidación contable de verdad— pero se dice cuánto hay, que es lo honesto.
 */
function DeudasDeGrupo({
  datos,
  filasExport,
  meta,
}: {
  datos: ListadoGrupo | null
  filasExport: (string | number)[][]
  meta: { empresa?: string; cif?: string; logoDataUrl?: string }
}) {
  if (!datos) {
    return (
      <Tarjeta>
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>Leyendo las sociedades del grupo…</p>
      </Tarjeta>
    )
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="text-lg font-semibold">
            Total del grupo: <ImporteEuro valor={datos.totalPendiente} />
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {datos.empresas.length} sociedades · cuota mensual equivalente {fmt(datos.totalCuotaMensual)}. Es una{' '}
            <strong>suma, no una consolidación</strong>: no elimina lo que las empresas se deben entre sí.
          </p>
          {datos.totalIntragrupo > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--warn)' }}>
              De ese total, {fmt(datos.totalIntragrupo)} son deudas entre empresas del grupo: contadas dos veces desde
              fuera, porque son pasivo en una sociedad y activo en otra.
            </p>
          )}
        </div>
        <ExportBotones
          nombre="deudas-grupo"
          tituloPDF="Detalle de deudas del grupo"
          meta={meta}
          cabeceras={['Empresa', 'Bloque', 'Tipo', 'Acreedor', 'Detalle', 'Importe inicial', 'Capital pendiente', 'Cuota', 'Periodicidad', 'Tipo interés']}
          filas={filasExport}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {datos.porBloque.map((b) => (
          <Tarjeta key={b.grupo} className="!p-4">
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{b.titulo}</div>
            <div className="text-lg font-semibold"><ImporteEuro valor={b.totalPendiente} /></div>
            {b.totalCuotaMensual > 0 && (
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{fmt(b.totalCuotaMensual)}/mes</div>
            )}
          </Tarjeta>
        ))}
      </div>

      {datos.empresas.map((e) => {
        const conDeuda = e.listado.grupos.filter((g) => g.filas.length > 0)
        return (
          <div key={e.empresaId}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2 pb-1 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-semibold">{e.razonSocial}</h3>
              <div className="text-sm">
                <ImporteEuro valor={e.listado.totalPendiente} />
                {e.listado.totalCuotaMensual > 0 && (
                  <span style={{ color: 'var(--text-muted)' }}> · {fmt(e.listado.totalCuotaMensual)}/mes</span>
                )}
              </div>
            </div>
            {conDeuda.length === 0 ? (
              <p className="text-sm py-3" style={{ color: 'var(--text-muted)' }}>Sin deudas registradas.</p>
            ) : (
              <div className="space-y-3">
                {conDeuda.map((g) => (
                  <div key={g.grupo}>
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <h4 className="text-sm font-medium">{g.titulo}</h4>
                      <span className="text-sm"><ImporteEuro valor={g.totalPendiente} /></span>
                    </div>
                    <TablaDeudas filas={g.filas} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
