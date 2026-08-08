/**
 * Importación de extractos con previsualización obligatoria: se enseña lo leído
 * y lo descartado ANTES de tocar los datos. Nada entra sin que el usuario lo vea.
 */
import { useState } from 'react'
import { Boton, ImporteEuro, Semaforo, formatearEuro } from '../../componentes/ui'
import { Modal } from '../../componentes/formularios'
import { formatearFecha } from '../../lib/fechas'
import { totalExtracto } from '../../dominio/extracto'
import type { LecturaExtracto } from '../../lib/extracto'

const ETIQUETA_FORMATO: Record<string, string> = {
  N43: 'Norma 43',
  EXCEL: 'Excel',
  CSV: 'CSV',
  PDF: 'PDF',
  DESCONOCIDO: 'Desconocido',
}

export function ModalImportarExtracto({
  lectura,
  nombreFichero,
  nombreCuenta,
  onCerrar,
  onAplicar,
}: {
  lectura: LecturaExtracto
  nombreFichero: string
  nombreCuenta: string
  onCerrar: () => void
  onAplicar: () => void
}) {
  const [verDescartadas, setVerDescartadas] = useState(false)
  const total = totalExtracto(lectura.movimientos)
  const hayMovimientos = lectura.movimientos.length > 0

  return (
    <Modal titulo="Revisar el extracto antes de importar" onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <span className="rounded-md px-2 py-0.5" style={{ background: 'var(--surface-2)' }}>
            {ETIQUETA_FORMATO[lectura.formato] ?? lectura.formato}
          </span>
          <span className="truncate">{nombreFichero}</span>
          <span>→</span>
          <span className="font-medium" style={{ color: 'var(--text)' }}>{nombreCuenta}</span>
        </div>

        {/* Avisos del propio fichero: descuadres del N43, PDF escaneado… */}
        {lectura.errores.length > 0 && (
          <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(255,159,10,.12)', border: '1px solid var(--warn)' }}>
            {lectura.errores.map((e) => (
              <p key={e} className="text-sm">{e}</p>
            ))}
          </div>
        )}

        {hayMovimientos && (
          <div className="grid grid-cols-3 gap-3">
            <Resumen etiqueta="Movimientos" texto={String(lectura.movimientos.length)} />
            <Resumen etiqueta="Suma" texto={formatearEuro(total)} />
            <Resumen etiqueta="Descartados" texto={String(lectura.descartadas.length)} alerta={lectura.descartadas.length > 0} />
          </div>
        )}

        {hayMovimientos ? (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: 'var(--surface-2)' }}>
                  <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                    <th className="py-2 px-3 font-medium">Fecha</th>
                    <th className="py-2 px-3 font-medium">Concepto</th>
                    <th className="py-2 px-3 font-medium text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {lectura.movimientos.map((m, i) => (
                    <tr key={`${m.fecha}-${i}`} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-1.5 px-3 whitespace-nowrap tabular">{formatearFecha(m.fecha)}</td>
                      <td className="py-1.5 px-3">{m.concepto}</td>
                      <td className="py-1.5 px-3 text-right"><ImporteEuro valor={m.importe} color /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No se ha podido leer ningún movimiento de este fichero.
          </p>
        )}

        {lectura.descartadas.length > 0 && (
          <div>
            <button className="text-sm underline" style={{ color: 'var(--color-brand-500)' }} onClick={() => setVerDescartadas((v) => !v)}>
              {verDescartadas ? 'Ocultar' : 'Ver'} las {lectura.descartadas.length} líneas descartadas
            </button>
            {verDescartadas && (
              <ul className="mt-2 space-y-1 text-xs rounded-xl p-3 max-h-40 overflow-y-auto" style={{ background: 'var(--surface-2)' }}>
                {lectura.descartadas.map((d, i) => (
                  <li key={i}>
                    <span style={{ color: 'var(--warn)' }}>{d.motivo}</span>
                    <span style={{ color: 'var(--text-muted)' }}> — {d.origen}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {hayMovimientos && (
          <Semaforo
            estado="neutro"
            texto="Al importar se omiten los movimientos que ya existan con la misma fecha, concepto e importe."
          />
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          {hayMovimientos && <Boton onClick={onAplicar}>Importar {lectura.movimientos.length} movimientos</Boton>}
        </div>
      </div>
    </Modal>
  )
}

function Resumen({ etiqueta, texto, alerta }: { etiqueta: string; texto: string; alerta?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
      <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
        {etiqueta}
      </div>
      <div className="mt-1 font-semibold tabular" style={{ color: alerta ? 'var(--warn)' : undefined }}>
        {texto}
      </div>
    </div>
  )
}
