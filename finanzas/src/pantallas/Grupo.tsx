/**
 * Pantalla de Grupo: alta de empresas, organigrama de participaciones y vista
 * agregada. Cada empresa mantiene su contabilidad separada; aquí solo se
 * describe la estructura societaria y se suman cifras para dirección.
 */
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { Tarjeta, Boton, ImporteEuro, Esqueleto, formatearEuro } from '../componentes/ui'
import { Campo, CampoNumero, Select, Toggle, Modal } from '../componentes/formularios'
import { Icono } from '../componentes/Icono'
import { nuevoId } from '../dominio/id'
import {
  filasOrganigrama,
  porcentajeEfectivo,
  porcentajeAsignado,
  ETIQUETA_RELACION,
  relacionPorPorcentaje,
  type Participacion,
} from '../dominio/grupo'
import { agregadoDelGrupo } from '../lib/grupo'
import type { AgregadoGrupo } from '../dominio/grupo'
import { validarNifCif } from '../dominio/validacion'

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 rounded-xl p-3 text-sm"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
    >
      <span className="shrink-0 mt-0.5" style={{ color: 'var(--warn)' }}>
        <Icono nombre="alerta" className="w-[18px] h-[18px]" />
      </span>
      <p>{children}</p>
    </div>
  )
}

export function Grupo() {
  const grupo = useStore((s) => s.grupo)
  const crearEmpresa = useStore((s) => s.crearEmpresa)
  const cambiarEmpresa = useStore((s) => s.cambiarEmpresa)
  const eliminarEmpresa = useStore((s) => s.eliminarEmpresa)
  const renombrarGrupo = useStore((s) => s.renombrarGrupo)
  const guardarParticipacion = useStore((s) => s.guardarParticipacion)
  const eliminarParticipacion = useStore((s) => s.eliminarParticipacion)

  const [modalEmpresa, setModalEmpresa] = useState(false)
  const [modalPart, setModalPart] = useState<Participacion | undefined>()
  const [agregado, setAgregado] = useState<AgregadoGrupo | undefined>()
  const [cargandoAgregado, setCargandoAgregado] = useState(true)

  // Recalcula el agregado cuando cambia la composición del grupo.
  const firmaEmpresas = grupo.empresas.map((e) => e.id).join(',')
  useEffect(() => {
    let vigente = true
    setCargandoAgregado(true)
    agregadoDelGrupo(grupo, new Date().toISOString().slice(0, 10))
      .then((a) => {
        if (vigente) {
          setAgregado(a)
          setCargandoAgregado(false)
        }
      })
      .catch(() => vigente && setCargandoAgregado(false))
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaEmpresas, grupo.empresaActivaId])

  const filas = useMemo(() => filasOrganigrama(grupo), [grupo])
  const holding = grupo.empresas.find((e) => e.esHolding)

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Grupo de empresas</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Cada sociedad lleva su propia contabilidad, su CIF y sus modelos. Aquí solo se define quién participa en
            quién.
          </p>
        </div>
        <Boton onClick={() => setModalEmpresa(true)}>+ Nueva empresa</Boton>
      </header>

      <Tarjeta>
        <Campo etiqueta="Denominación del grupo" valor={grupo.nombre} onChange={renombrarGrupo} />
      </Tarjeta>

      {/* ── Empresas ── */}
      <Tarjeta>
        <h2 className="text-base font-semibold mb-3">Empresas ({grupo.empresas.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                <th className="py-2 pr-3 font-medium">Razón social</th>
                <th className="py-2 pr-3 font-medium">CIF</th>
                <th className="py-2 pr-3 font-medium">Papel</th>
                <th className="py-2 pr-3 font-medium text-right">% efectivo del holding</th>
                <th className="py-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {grupo.empresas.map((e) => {
                const activa = e.id === grupo.empresaActivaId
                const efectivo = holding && holding.id !== e.id ? porcentajeEfectivo(grupo, holding.id, e.id) : undefined
                return (
                  <tr key={e.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{e.razonSocial || <em style={{ color: 'var(--text-muted)' }}>Sin nombre</em>}</span>
                      {activa && (
                        <span
                          className="ml-2 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                          style={{ background: 'var(--color-brand-500)', color: '#fff' }}
                        >
                          Activa
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{e.cif}</td>
                    <td className="py-2.5 pr-3">{e.esHolding ? 'Holding (cabecera)' : 'Operativa'}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {efectivo === undefined ? '—' : efectivo > 0 ? `${efectivo} %` : '—'}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {!activa && (
                        <button
                          className="text-sm underline mr-3"
                          onClick={() => void cambiarEmpresa(e.id)}
                          style={{ color: 'var(--color-brand-500)' }}
                        >
                          Abrir
                        </button>
                      )}
                      {grupo.empresas.length > 1 && (
                        <button
                          className="text-sm underline"
                          style={{ color: 'var(--neg)' }}
                          onClick={() => {
                            const ok = window.confirm(
                              `Se va a borrar "${e.razonSocial || 'Sin nombre'}" y TODA su contabilidad de este dispositivo.\n\nEsto no se puede deshacer. Descarga antes una copia de seguridad si la quieres conservar.\n\n¿Continuar?`,
                            )
                            if (ok) void eliminarEmpresa(e.id)
                          }}
                        >
                          Borrar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {/* ── Organigrama ── */}
      <Tarjeta>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold">Organigrama del grupo</h2>
          {grupo.empresas.length > 1 && (
            <Boton
              variante="secundario"
              onClick={() =>
                setModalPart({ id: nuevoId(), matrizId: grupo.empresas[0].id, participadaId: grupo.empresas[1].id, porcentaje: 100 })
              }
            >
              + Participación
            </Boton>
          )}
        </div>
        {grupo.empresas.length === 1 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Da de alta al menos dos empresas para poder enlazarlas.
          </p>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-1">
              {filas.map((f) => (
                <li
                  key={f.empresa.id}
                  className="flex items-center gap-2 py-1.5 text-sm"
                  style={{ paddingLeft: `${f.nivel * 24}px` }}
                >
                  {f.nivel > 0 && <span style={{ color: 'var(--text-muted)' }}>└</span>}
                  <span className="font-medium">{f.empresa.razonSocial || 'Sin nombre'}</span>
                  {f.empresa.esHolding && (
                    <span className="rounded-md px-1.5 py-0.5 text-[11px]" style={{ background: 'var(--surface-2)' }}>
                      holding
                    </span>
                  )}
                  {f.porcentaje !== undefined && (
                    <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      · {f.porcentaje} % · {ETIQUETA_RELACION[f.relacion!]}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {grupo.participaciones.length > 0 && (
              <div className="overflow-x-auto border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                      <th className="py-2 pr-3 font-medium">Matriz</th>
                      <th className="py-2 pr-3 font-medium">Participada</th>
                      <th className="py-2 pr-3 font-medium text-right">%</th>
                      <th className="py-2 pr-3 font-medium">Relación</th>
                      <th className="py-2 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.participaciones.map((p) => {
                      const m = grupo.empresas.find((e) => e.id === p.matrizId)
                      const h = grupo.empresas.find((e) => e.id === p.participadaId)
                      return (
                        <tr key={p.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                          <td className="py-2 pr-3">{m?.razonSocial || '—'}</td>
                          <td className="py-2 pr-3">{h?.razonSocial || '—'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{p.porcentaje} %</td>
                          <td className="py-2 pr-3">{ETIQUETA_RELACION[relacionPorPorcentaje(p.porcentaje)]}</td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <button className="text-sm underline mr-3" onClick={() => setModalPart(p)} style={{ color: 'var(--color-brand-500)' }}>
                              Editar
                            </button>
                            <button
                              className="text-sm underline"
                              style={{ color: 'var(--neg)' }}
                              onClick={() => eliminarParticipacion(p.id)}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Tarjeta>

      {/* ── Vista agregada ── */}
      <Tarjeta>
        <h2 className="text-base font-semibold mb-3">Cifras agregadas del grupo</h2>
        <div className="space-y-4">
          <Aviso>
            <strong>Esto es una suma, no una consolidación contable.</strong> No se eliminan las operaciones entre
            empresas del grupo (ventas internas, dividendos, préstamos), así que estas cifras pueden estar infladas.
            Sirven para ver el conjunto de un vistazo, <strong>no para depositar cuentas consolidadas</strong>.
          </Aviso>

          {cargandoAgregado || !agregado ? (
            <Esqueleto className="h-40 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Metrica etiqueta="Tesorería" valor={agregado.tesoreria} />
                <Metrica etiqueta="Venta del mes" valor={agregado.ventaMes} />
                <Metrica etiqueta="Resultado del mes" valor={agregado.resultadoMes} />
                <Metrica etiqueta="Deuda total" valor={agregado.deudaTotal} />
                <Metrica etiqueta="Stock valorado" valor={agregado.stockValorado} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                      <th className="py-2 pr-3 font-medium">Empresa</th>
                      <th className="py-2 pr-3 font-medium text-right">Tesorería</th>
                      <th className="py-2 pr-3 font-medium text-right">Venta mes</th>
                      <th className="py-2 pr-3 font-medium text-right">Resultado mes</th>
                      <th className="py-2 pr-3 font-medium text-right">Deuda</th>
                      <th className="py-2 font-medium text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agregado.empresas.map((c) => (
                      <tr key={c.empresaId} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="py-2 pr-3">{c.razonSocial}</td>
                        <td className="py-2 pr-3 text-right"><ImporteEuro valor={c.tesoreria} /></td>
                        <td className="py-2 pr-3 text-right"><ImporteEuro valor={c.ventaMes} /></td>
                        <td className="py-2 pr-3 text-right"><ImporteEuro valor={c.resultadoMes} color /></td>
                        <td className="py-2 pr-3 text-right"><ImporteEuro valor={c.deudaTotal} /></td>
                        <td className="py-2 text-right"><ImporteEuro valor={c.stockValorado} /></td>
                      </tr>
                    ))}
                    <tr className="border-t font-semibold" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2 pr-3">Total (suma)</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatearEuro(agregado.tesoreria)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatearEuro(agregado.ventaMes)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatearEuro(agregado.resultadoMes)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatearEuro(agregado.deudaTotal)}</td>
                      <td className="py-2 text-right tabular-nums">{formatearEuro(agregado.stockValorado)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Tarjeta>

      {modalEmpresa && <ModalNuevaEmpresa onCerrar={() => setModalEmpresa(false)} onCrear={crearEmpresa} />}
      {modalPart && (
        <ModalParticipacion
          participacion={modalPart}
          onCerrar={() => setModalPart(undefined)}
          onGuardar={guardarParticipacion}
        />
      )}
    </div>
  )
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
      <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
        {etiqueta}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{formatearEuro(valor)}</div>
    </div>
  )
}

function ModalNuevaEmpresa({
  onCerrar,
  onCrear,
}: {
  onCerrar: () => void
  onCrear: (d: { razonSocial: string; cif: string; esHolding: boolean }) => Promise<string>
}) {
  const [razonSocial, setRazonSocial] = useState('')
  const [cif, setCif] = useState('')
  const [esHolding, setEsHolding] = useState(false)
  const [error, setError] = useState('')

  const guardar = () => {
    if (razonSocial.trim() === '') return setError('Indica la razón social')
    if (cif.trim() !== '' && !validarNifCif(cif).valido) return setError('El CIF no es válido')
    void onCrear({ razonSocial: razonSocial.trim(), cif: cif.trim().toUpperCase(), esHolding }).then(onCerrar)
  }

  return (
    <Modal titulo="Nueva empresa del grupo" onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Se crea un espacio contable nuevo y vacío, con su plan contable e impuestos por defecto. No comparte ningún
          dato con las demás empresas.
        </p>
        <Campo etiqueta="Razón social" valor={razonSocial} onChange={setRazonSocial} />
        <Campo etiqueta="CIF" valor={cif} onChange={setCif} />
        <Toggle
          etiqueta="Es la sociedad holding (cabecera del grupo)"
          valor={esHolding}
          onChange={setEsHolding}
        />
        {error !== '' && (
          <p className="text-sm" style={{ color: 'var(--neg)' }}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar}>Crear empresa</Boton>
        </div>
      </div>
    </Modal>
  )
}

function ModalParticipacion({
  participacion,
  onCerrar,
  onGuardar,
}: {
  participacion: Participacion
  onCerrar: () => void
  onGuardar: (p: Participacion) => { ok: boolean; motivo?: string }
}) {
  const grupo = useStore((s) => s.grupo)
  const [p, setP] = useState<Participacion>(participacion)
  const [error, setError] = useState('')

  const opciones = grupo.empresas.map((e) => ({ valor: e.id, texto: e.razonSocial || 'Sin nombre' }))
  const libre = 100 - porcentajeAsignado(grupo, p.participadaId, p.id)

  const guardar = () => {
    const r = onGuardar(p)
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar')
    onCerrar()
  }

  return (
    <Modal titulo="Participación entre empresas" onCerrar={onCerrar}>
      <div className="space-y-4">
        <Select
          etiqueta="Empresa matriz (la que participa)"
          valor={p.matrizId}
          opciones={opciones}
          onChange={(v) => setP({ ...p, matrizId: v })}
        />
        <Select
          etiqueta="Empresa participada"
          valor={p.participadaId}
          opciones={opciones}
          onChange={(v) => setP({ ...p, participadaId: v })}
        />
        <CampoNumero
          etiqueta="Porcentaje del capital"
          sufijo="%"
          valor={p.porcentaje}
          onChange={(v) => setP({ ...p, porcentaje: v })}
        />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Queda libre un {Math.max(0, Math.round(libre * 100) / 100)} % del capital de esa participada.
          {p.porcentaje > 0 && ` Con un ${p.porcentaje} % sería: ${ETIQUETA_RELACION[relacionPorPorcentaje(p.porcentaje)]}.`}
        </p>
        {error !== '' && (
          <p className="text-sm" style={{ color: 'var(--neg)' }}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar}>Guardar</Boton>
        </div>
      </div>
    </Modal>
  )
}
