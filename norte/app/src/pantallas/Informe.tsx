import { formatearDinero } from '@norte/dominio'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Boton, Esqueleto } from '../componentes/ui.js'
import { api, type EspacioResumen } from '../lib/api.js'

/**
 * El informe del mes, pensado para imprimirse.
 *
 * **El PDF lo genera el navegador, no Norte.** Es una decisión, no una
 * dejadez: una librería de PDF obligaría a repintar todo el diseño con
 * primitivas —tipografía, saltos de página, tildes— y el resultado se parecería
 * a un listado de los noventa. Con una hoja de estilos de impresión, el motor
 * del navegador hace la maquetación que ya sabe hacer, el resultado sale igual
 * en cualquier sistema, y no entra ni una dependencia más en una aplicación
 * que procesa ficheros de fuera.
 *
 * Se imprime **siempre en claro**, aunque estés en modo oscuro: un informe en
 * negro se lleva medio cartucho y en papel se lee peor.
 */
export function Informe({ espacio }: { espacio: EspacioResumen }) {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))

  const presupuesto = useQuery({
    queryKey: ['presupuesto', espacio.id, mes],
    queryFn: () => api.presupuesto(espacio.id, mes),
  })
  const cuadro = useQuery({ queryKey: ['cuadro', espacio.id], queryFn: () => api.cuadro(espacio.id) })

  if (presupuesto.isLoading || cuadro.isLoading) {
    return <Esqueleto className="mx-auto mt-8 h-96 max-w-3xl" />
  }
  const datos = presupuesto.data
  const patrimonio = cuadro.data
  if (!datos || !patrimonio) return null

  const gastados = datos.sobres
    .filter((sobre) => sobre.padreId === null && sobre.gastado > 0)
    .sort((a, b) => b.gastado - a.gastado)
  const totalGastado = datos.resumen.gastado + datos.sinClasificar.gastado
  const ingresos = datos.ingresos.confirmado
  const ahorro = ingresos - totalGastado
  const tasa = ingresos > 0 ? Math.round((ahorro / ingresos) * 100) : null

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 print:max-w-none print:px-0 print:py-0">
      {/* La barra de mandos no se imprime: en el papel sobra. */}
      <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Mes</span>
          <input
            type="month"
            value={mes}
            onChange={(evento) => setMes(evento.target.value)}
            className="h-11 rounded-campo border border-linea bg-sup-2 px-3.5 text-sm text-texto-1"
          />
        </label>
        <Boton type="button" onClick={() => window.print()}>
          Guardar como PDF
        </Boton>
        <p className="text-xs text-texto-3">
          Se abre el diálogo de impresión de tu navegador. Elige «Guardar como PDF».
        </p>
      </div>

      <article className="informe rounded-tarjeta bg-sup-1 p-8 ring-1 ring-linea/60 print:rounded-none print:p-0 print:ring-0">
        <header className="border-b border-linea pb-4">
          <p className="text-xs uppercase tracking-[0.14em] text-texto-3">Informe mensual</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">
            {espacio.nombre} · {nombreDeMes(mes)}
          </h1>
          <p className="mt-1 text-sm text-texto-3">
            Generado el {new Date().toLocaleDateString('es-ES', { dateStyle: 'long' })} con Norte.
          </p>
        </header>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-texto-3">
            El mes en cuatro cifras
          </h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Dato titulo="Ingresos" valor={ingresos} />
            <Dato titulo="Gastos" valor={-totalGastado} />
            <Dato titulo="Ahorro" valor={ahorro} colorear />
            <div>
              <dt className="text-xs uppercase tracking-wide text-texto-3">Tasa de ahorro</dt>
              <dd className="cifra mt-0.5 text-lg font-medium">
                {tasa === null ? '—' : `${tasa} %`}
              </dd>
            </div>
          </dl>
          {ingresos === 0 && (
            <p className="mt-2 text-xs text-texto-3">
              No hay ingresos clasificados como tales este mes, así que la tasa de ahorro no se
              puede calcular. No es un cero: es que falta el dato.
            </p>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-texto-3">
            En qué se ha ido
          </h2>
          {gastados.length === 0 ? (
            <p className="text-sm text-texto-2">No hay gastos apuntados en este mes.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-linea text-left text-xs uppercase tracking-wide text-texto-3">
                  <th scope="col" className="pb-2 font-medium">Categoría</th>
                  <th scope="col" className="pb-2 text-right font-medium">Gastado</th>
                  <th scope="col" className="pb-2 text-right font-medium">Presupuesto</th>
                  <th scope="col" className="pb-2 text-right font-medium">% del gasto</th>
                </tr>
              </thead>
              <tbody>
                {gastados.map((sobre) => (
                  <tr key={sobre.categoriaId} className="border-b border-linea/60 last:border-0">
                    <th scope="row" className="py-1.5 text-left font-normal">{sobre.categoria}</th>
                    <td className="cifra py-1.5 text-right">{formatearDinero(sobre.gastado)}</td>
                    <td className="cifra py-1.5 text-right text-texto-3">
                      {sobre.presupuesto > 0 ? formatearDinero(sobre.presupuesto) : '—'}
                    </td>
                    <td className="cifra py-1.5 text-right text-texto-2">
                      {totalGastado > 0 ? `${Math.round((sobre.gastado / totalGastado) * 100)} %` : '—'}
                    </td>
                  </tr>
                ))}
                {datos.sinClasificar.gastado > 0 && (
                  <tr className="border-b border-linea/60 last:border-0">
                    <th scope="row" className="py-1.5 text-left font-normal italic text-texto-2">
                      Sin clasificar
                    </th>
                    <td className="cifra py-1.5 text-right">
                      {formatearDinero(datos.sinClasificar.gastado)}
                    </td>
                    <td className="py-1.5 text-right text-texto-3">—</td>
                    <td className="cifra py-1.5 text-right text-texto-2">
                      {Math.round((datos.sinClasificar.gastado / totalGastado) * 100)} %
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-6 break-inside-avoid">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-texto-3">
            Dónde estás
          </h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Dato titulo="Patrimonio neto" valor={patrimonio.patrimonio.neto} />
            <Dato titulo="Activos" valor={patrimonio.patrimonio.activos} />
            <Dato titulo="Deudas" valor={-patrimonio.patrimonio.pasivos} />
            <Dato titulo="Líquido" valor={patrimonio.liquido} />
          </dl>
        </section>

        <footer className="mt-8 border-t border-linea pt-4 text-xs leading-relaxed text-texto-3">
          Informe generado por Norte a partir de lo que hay apuntado en{' '}
          <strong>{espacio.nombre}</strong>. <strong>No es un documento contable</strong> ni sirve
          para presentar nada ante nadie: es tu foto del mes.
        </footer>
      </article>
    </div>
  )
}

function Dato({ titulo, valor, colorear }: { titulo: string; valor: number; colorear?: boolean }) {
  const color = colorear ? (valor < 0 ? 'text-negativo' : 'text-positivo') : ''
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-texto-3">{titulo}</dt>
      <dd className={`cifra mt-0.5 text-lg font-medium ${color}`}>{formatearDinero(valor)}</dd>
    </div>
  )
}

function nombreDeMes(mes: string): string {
  const nombre = new Date(`${mes}-01T00:00:00`).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  })
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}
