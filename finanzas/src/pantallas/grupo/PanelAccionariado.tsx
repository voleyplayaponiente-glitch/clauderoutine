/**
 * Libro registro de socios de una empresa del grupo: propietarios, porcentaje e
 * importe de capital. El porcentaje NO se teclea: se calcula desde el capital
 * nominal de cada socio, así el reparto no puede descuadrarse por un dedazo.
 */
import { useMemo, useState } from 'react'
import { useStore } from '../../store/store'
import { Tarjeta, Boton, ImporteEuro, formatearEuro } from '../../componentes/ui'
import { Campo, CampoNumero, Select, Toggle, Modal } from '../../componentes/formularios'
import { nuevoId } from '../../dominio/id'
import { validarNifCif } from '../../dominio/validacion'
import {
  capTable,
  resumenAccionariado,
  avisosAccionariado,
  sociosDeBaja,
  valorNominalUnitario,
  ETIQUETA_TIPO_SOCIO,
  type Socio,
} from '../../dominio/socios'

function socioNuevo(empresaId: string): Socio {
  return {
    id: nuevoId(),
    empresaId,
    nombre: '',
    nifCif: '',
    tipo: 'PERSONA_FISICA',
    capitalNominal: 0,
    fechaAlta: new Date().toISOString().slice(0, 10),
  }
}

export function PanelAccionariado() {
  const grupo = useStore((s) => s.grupo)
  const guardarSocio = useStore((s) => s.guardarSocio)
  const eliminarSocio = useStore((s) => s.eliminarSocio)
  const actualizarFichaEmpresa = useStore((s) => s.actualizarFichaEmpresa)

  // Por defecto se mira la sociedad cabecera; si no hay holding, la activa.
  const porDefecto = grupo.empresas.find((e) => e.esHolding)?.id ?? grupo.empresaActivaId
  const [empresaId, setEmpresaId] = useState(porDefecto)
  const empresa = grupo.empresas.find((e) => e.id === empresaId) ?? grupo.empresas.find((e) => e.id === porDefecto)
  const idVigente = empresa?.id ?? porDefecto

  const [edit, setEdit] = useState<Socio | null>(null)

  const filas = useMemo(() => capTable(grupo, idVigente, grupo.socios), [grupo, idVigente])
  const resumen = useMemo(() => resumenAccionariado(grupo, idVigente, grupo.socios), [grupo, idVigente])
  const avisos = useMemo(() => avisosAccionariado(grupo, idVigente, grupo.socios), [grupo, idVigente])
  const bajas = useMemo(() => sociosDeBaja(grupo.socios, idVigente), [grupo, idVigente])

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold">Accionariado (libro registro de socios)</h2>
        <Boton onClick={() => setEdit(socioNuevo(idVigente))}>+ Nuevo socio</Boton>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <Select
          etiqueta="Sociedad"
          valor={idVigente}
          onChange={setEmpresaId}
          opciones={grupo.empresas.map((e) => ({
            valor: e.id,
            texto: `${e.razonSocial || 'Sin nombre'}${e.esHolding ? ' · holding' : ''}`,
          }))}
        />
        <CampoNumero
          etiqueta="Capital social escriturado"
          sufijo="€"
          valor={empresa?.capitalSocial ?? 0}
          onChange={(v) => actualizarFichaEmpresa(idVigente, { capitalSocial: v })}
          ayuda="El que consta en el Registro Mercantil. Si lo dejas a 0, el % se calcula sobre lo aportado."
        />
      </div>

      {/* ── Resumen ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Metrica etiqueta="Capital repartido" valor={resumen.capitalRepartido} />
        <Metrica etiqueta="Titulares" texto={String(resumen.numTitulares)} />
        <Metrica etiqueta="Prima de emisión" valor={resumen.primaEmision} />
        <Metrica etiqueta="Pendiente desembolso" valor={resumen.pendienteDesembolso} />
      </div>

      {!resumen.cuadra && (
        <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(255,69,58,.12)', border: '1px solid var(--neg)' }}>
          <p className="text-sm">
            <strong>El capital no cuadra.</strong> Escriturado {formatearEuro(resumen.capitalEscriturado)} frente a{' '}
            {formatearEuro(resumen.capitalRepartido)} repartidos:{' '}
            {resumen.descuadre > 0 ? 'faltan' : 'sobran'} {formatearEuro(Math.abs(resumen.descuadre))}.
          </p>
        </div>
      )}

      {avisos.length > 0 && filas.length > 0 && (
        <ul className="rounded-xl p-3 mb-4 space-y-1 text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
          {avisos.map((a) => (
            <li key={a}>· {a}</li>
          ))}
        </ul>
      )}

      {/* ── Cuadro de propiedad ── */}
      {filas.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no hay socios registrados en esta sociedad. Añade los propietarios con el capital que aporta cada uno.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                <th className="py-2 pr-3 font-medium">Socio</th>
                <th className="py-2 pr-3 font-medium">NIF / CIF</th>
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 font-medium text-right">Capital</th>
                <th className="py-2 pr-3 font-medium text-right">Participaciones</th>
                <th className="py-2 pr-3 font-medium text-right">%</th>
                <th className="py-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const socio = grupo.socios.find((s) => s.id === f.id)
                return (
                  <tr key={f.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{f.nombre}</span>
                      {f.origen === 'EMPRESA_GRUPO' && (
                        <span className="ml-2 rounded-md px-1.5 py-0.5 text-[11px]" style={{ background: 'var(--surface-2)' }}>
                          empresa del grupo
                        </span>
                      )}
                      {f.esAdministrador && (
                        <span className="ml-2 rounded-md px-1.5 py-0.5 text-[11px]" style={{ background: 'var(--surface-2)' }}>
                          administrador
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 tabular">{f.nifCif || '—'}</td>
                    <td className="py-2.5 pr-3">{ETIQUETA_TIPO_SOCIO[f.tipo]}</td>
                    <td className="py-2.5 pr-3 text-right"><ImporteEuro valor={f.capitalNominal} /></td>
                    <td className="py-2.5 pr-3 text-right tabular">{f.numParticipaciones ?? '—'}</td>
                    <td className="py-2.5 pr-3 text-right tabular font-medium">{f.porcentaje} %</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {f.origen === 'SOCIO' && socio ? (
                        <>
                          <button className="text-sm underline mr-3" style={{ color: 'var(--color-brand-500)' }} onClick={() => setEdit(socio)}>
                            Editar
                          </button>
                          <button
                            className="text-sm underline"
                            style={{ color: 'var(--neg)' }}
                            onClick={() => {
                              if (window.confirm(`¿Borrar a "${socio.nombre}" del libro registro?\n\nSi lo que ha hecho es vender su participación, es mejor darle de baja con fecha desde Editar: así queda el histórico.`)) {
                                eliminarSocio(socio.id)
                              }
                            }}
                          >
                            Borrar
                          </button>
                        </>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>desde el organigrama</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t font-semibold" style={{ borderColor: 'var(--border)' }}>
                <td className="py-2.5 pr-3" colSpan={3}>Total</td>
                <td className="py-2.5 pr-3 text-right tabular">{formatearEuro(resumen.capitalRepartido)}</td>
                <td className="py-2.5 pr-3" />
                <td className="py-2.5 pr-3 text-right tabular" style={{ color: Math.abs(resumen.porcentajeCubierto - 100) > 0.01 ? 'var(--neg)' : undefined }}>
                  {resumen.porcentajeCubierto} %
                </td>
                <td className="py-2.5" />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Histórico de bajas ── */}
      {bajas.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            Histórico: {bajas.length} socio{bajas.length > 1 ? 's' : ''} que causaron baja
          </summary>
          <ul className="mt-2 space-y-1 text-sm">
            {bajas.map((s) => (
              <li key={s.id} className="flex justify-between gap-3">
                <span>
                  {s.nombre} · baja el {s.fechaBaja}
                </span>
                <span className="flex gap-3">
                  <span className="tabular" style={{ color: 'var(--text-muted)' }}>{formatearEuro(s.capitalNominal)}</span>
                  <button className="underline" style={{ color: 'var(--color-brand-500)' }} onClick={() => setEdit(s)}>
                    Editar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {edit && (
        <ModalSocio
          socio={edit}
          onCerrar={() => setEdit(null)}
          onGuardar={(s) => {
            const r = guardarSocio(s)
            if (r.ok) setEdit(null)
            return r
          }}
        />
      )}
    </Tarjeta>
  )
}

function Metrica({ etiqueta, valor, texto }: { etiqueta: string; valor?: number; texto?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
      <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
        {etiqueta}
      </div>
      <div className="mt-1 text-lg font-semibold tabular">{texto ?? formatearEuro(valor ?? 0)}</div>
    </div>
  )
}

function ModalSocio({
  socio,
  onCerrar,
  onGuardar,
}: {
  socio: Socio
  onCerrar: () => void
  onGuardar: (s: Socio) => { ok: boolean; motivo?: string }
}) {
  const [s, setS] = useState<Socio>(socio)
  const [error, setError] = useState('')
  const nominalUnitario = valorNominalUnitario(s)
  const nifAviso = s.nifCif.trim() !== '' && !validarNifCif(s.nifCif).valido ? 'El NIF/CIF no supera la letra de control' : undefined

  return (
    <Modal titulo={socio.nombre ? 'Editar socio' : 'Nuevo socio'} onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etiqueta="Nombre o razón social" valor={s.nombre} onChange={(v) => setS({ ...s, nombre: v })} autoFocus />
          <Campo etiqueta="NIF / CIF" valor={s.nifCif} onChange={(v) => setS({ ...s, nifCif: v.toUpperCase() })} aviso={nifAviso} />
        </div>

        <Select
          etiqueta="Tipo de socio"
          valor={s.tipo}
          onChange={(v) => setS({ ...s, tipo: v })}
          opciones={[
            { valor: 'PERSONA_FISICA' as const, texto: 'Persona física' },
            { valor: 'PERSONA_JURIDICA' as const, texto: 'Persona jurídica' },
          ]}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <CampoNumero
            etiqueta="Capital nominal"
            sufijo="€"
            valor={s.capitalNominal}
            onChange={(v) => setS({ ...s, capitalNominal: v })}
            ayuda="De aquí sale su porcentaje. No se teclea el %."
          />
          <CampoNumero
            etiqueta="Nº de participaciones"
            valor={s.numParticipaciones ?? 0}
            onChange={(v) => setS({ ...s, numParticipaciones: v })}
            ayuda={nominalUnitario !== undefined ? `${formatearEuro(nominalUnitario)} por participación` : 'Opcional'}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <CampoNumero
            etiqueta="Prima de emisión"
            sufijo="€"
            valor={s.primaEmision ?? 0}
            onChange={(v) => setS({ ...s, primaEmision: v })}
            ayuda="Aportado por encima del nominal. No da más porcentaje."
          />
          <CampoNumero
            etiqueta="Pendiente de desembolso"
            sufijo="€"
            valor={s.pendienteDesembolso ?? 0}
            onChange={(v) => setS({ ...s, pendienteDesembolso: v })}
            ayuda="Capital suscrito que aún no ha puesto."
          />
        </div>

        <Toggle etiqueta="Es administrador de la sociedad" valor={!!s.esAdministrador} onChange={(v) => setS({ ...s, esAdministrador: v })} />

        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etiqueta="Fecha de alta" tipo="date" valor={s.fechaAlta ?? ''} onChange={(v) => setS({ ...s, fechaAlta: v })} />
          <Campo
            etiqueta="Fecha de baja"
            tipo="date"
            valor={s.fechaBaja ?? ''}
            onChange={(v) => setS({ ...s, fechaBaja: v || undefined })}
            ayuda="Rellénala si vendió: sale del reparto pero queda en el histórico."
          />
        </div>

        <Campo etiqueta="Notas" valor={s.notas ?? ''} onChange={(v) => setS({ ...s, notas: v })} />

        {error !== '' && (
          <p className="text-sm" style={{ color: 'var(--neg)' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            onClick={() => {
              const r = onGuardar(s)
              if (!r.ok) setError(r.motivo ?? 'No se pudo guardar')
            }}
          >
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
