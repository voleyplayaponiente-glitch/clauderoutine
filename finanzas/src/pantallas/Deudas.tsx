import { Fragment, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../componentes/ui'
import { Campo, CampoNumero, Select, Toggle, Modal } from '../componentes/formularios'
import { TramosBarra } from '../componentes/TramosBarra'
import { hoyISO, formatearFecha } from '../lib/fechas'
import { nuevoId } from '../dominio/id'
import { formatearEuro, formatearPorcentaje } from '../dominio/dinero'
import { generarCuadro, resumenCuadro } from '../dominio/amortizacion'
import { agruparPorTramo, type ItemVencimiento } from '../dominio/vencimientos'
import { leerPrestamo, fusionarPrestamos, type DatosPrestamo } from '../dominio/prestamo-archivo'
import { esFichaRenting, leerRenting, type DatosRenting } from '../dominio/renting-archivo'
import { esFichaPoliza, leerPoliza, type DatosPoliza } from '../dominio/poliza-archivo'
import { filasDePrestamo } from '../lib/extracto'
import { SeccionRentings, rentingNuevo } from './deudas/SeccionRentings'
import { SeccionPolizas, polizaNueva } from './deudas/SeccionPolizas'
import type { Deuda, Poliza, Renting, TipoDeuda } from '../dominio/tipos'

const TIPOS: { valor: TipoDeuda; texto: string; grupo: 'financiera' | 'comercial' | 'fiscal' | 'otra' }[] = [
  { valor: 'PRESTAMO', texto: 'Préstamo bancario', grupo: 'financiera' },
  { valor: 'POLIZA', texto: 'Póliza de crédito (usa la sección de Pólizas)', grupo: 'financiera' },
  { valor: 'LEASING', texto: 'Leasing', grupo: 'financiera' },
  // El renting tiene su propia sección (no es deuda); se deja el tipo para no
  // romper lo ya guardado, pero se avisa de dónde va lo nuevo.
  { valor: 'RENTING', texto: 'Renting (usa la sección de Rentings)', grupo: 'financiera' },
  { valor: 'PROVEEDOR', texto: 'Proveedor', grupo: 'comercial' },
  { valor: 'ACREEDOR', texto: 'Acreedor diverso', grupo: 'comercial' },
  { valor: 'SOCIOS', texto: 'Socios y administradores', grupo: 'otra' },
  { valor: 'GRUPO', texto: 'Empresas del grupo', grupo: 'otra' },
  { valor: 'HACIENDA', texto: 'Hacienda', grupo: 'fiscal' },
  { valor: 'SEG_SOCIAL', texto: 'Seguridad Social', grupo: 'fiscal' },
  { valor: 'DIVIDENDO', texto: 'Dividendo pendiente', grupo: 'otra' },
]
const grupoDe = (t: TipoDeuda) => TIPOS.find((x) => x.valor === t)?.grupo ?? 'otra'

function deudaNueva(): Deuda {
  return { id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL', tipo: 'PRESTAMO', acreedor: '', importeOriginal: 0, tipoInteres: 0, periodicidad: 'MENSUAL', nPeriodos: 12, sistema: 'FRANCES', fechaInicio: hoyISO(), esVinculada: false }
}

function cuadroDe(d: Deuda) {
  return generarCuadro({ principal: d.importeOriginal, tipoAnual: d.tipoInteres, nPeriodos: d.nPeriodos, periodicidad: d.periodicidad, fechaInicio: d.fechaInicio, sistema: d.sistema })
}

export function Deudas() {
  const deudas = useStore((s) => s.datos.deudas).filter((d) => !d.anuladoEn)
  const guardar = useStore((s) => s.guardarDeuda)
  const anular = useStore((s) => s.anularDeuda)
  const hoy = hoyISO()
  const [edit, setEdit] = useState<Deuda | null>(null)
  const [expandida, setExpandida] = useState<string | null>(null)
  const refArchivo = useRef<HTMLInputElement>(null)
  const [lectura, setLectura] = useState<DatosPrestamo | null>(null)
  const [lecturaRenting, setLecturaRenting] = useState<DatosRenting | null>(null)
  const [lecturaPoliza, setLecturaPoliza] = useState<DatosPoliza | null>(null)
  // Alta de renting o póliza pedida desde la cabecera o desde el modal de deuda.
  const [nuevoRenting, setNuevoRenting] = useState<Renting | null>(null)
  const [nuevaPoliza, setNuevaPoliza] = useState<Poliza | null>(null)
  const ivaDefecto = useStore((s) => s.config.tiposIva).find((t) => t.porDefecto)?.tipo ?? 21
  const [leyendo, setLeyendo] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)

  /**
   * Lee uno o varios ficheros del banco. Un renting y una póliza no son
   * préstamos y no traen cuadro, así que primero se mira **qué es** el
   * documento y se manda a su lector; si no, se combinan como préstamo (el
   * banco lo parte en dos descargas).
   */
  const leerArchivos = async (ficheros: File[]) => {
    setLeyendo(true)
    setErrorArchivo(null)
    try {
      const filas = []
      for (const f of ficheros) filas.push(await filasDePrestamo(f))

      const renting = filas.find(esFichaRenting)
      if (renting) {
        setLecturaRenting(leerRenting(renting))
        return
      }
      const poliza = filas.find(esFichaPoliza)
      if (poliza) {
        setLecturaPoliza(leerPoliza(poliza))
        return
      }

      const fusion = fusionarPrestamos(filas.map(leerPrestamo))
      if (fusion.cuotas.length === 0 && fusion.encontrados.length === 0) {
        setErrorArchivo(fusion.avisos[0] ?? 'No se ha podido leer el fichero.')
      } else {
        setLectura(fusion)
      }
    } catch (e) {
      setErrorArchivo(`No se ha podido leer el fichero: ${e instanceof Error ? e.message : 'error desconocido'}`)
    } finally {
      setLeyendo(false)
      if (refArchivo.current) refArchivo.current.value = ''
    }
  }

  const conCuadro = useMemo(() => deudas.map((d) => {
    const cuadro = cuadroDe(d)
    const pendiente = resumenCuadro(cuadro).pendienteA(hoy)
    return { deuda: d, cuadro, pendiente }
  }), [deudas, hoy])

  const totalPendiente = conCuadro.reduce((s, x) => s + x.pendiente, 0)
  const porGrupo = { financiera: 0, comercial: 0, fiscal: 0, otra: 0 }
  for (const x of conCuadro) porGrupo[grupoDe(x.deuda.tipo)] += x.pendiente

  const itemsTramos: ItemVencimiento[] = useMemo(() => {
    const items: ItemVencimiento[] = []
    for (const x of conCuadro) for (const c of x.cuadro) if (c.fecha > hoy) items.push({ importe: c.capital, fechaVencimiento: c.fecha })
    return items
  }, [conCuadro, hoy])
  const tramos = agruparPorTramo(itemsTramos, hoy)

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <CabeceraPantalla titulo="Deudas y financiación" descripcion="Préstamos con cuadro, rentings (que son gasto, no deuda) y pólizas de crédito." />
        <div className="flex gap-2">
          {/* El banco parte el préstamo en dos descargas; se admiten las dos a la vez.
              El mismo botón reconoce la ficha de un renting o de una póliza. */}
          <Boton variante="secundario" onClick={() => refArchivo.current?.click()}>
            {leyendo ? 'Leyendo…' : 'Subir fichero del banco'}
          </Boton>
          <input
            ref={refArchivo}
            type="file"
            multiple
            accept=".xlsx,.xls,.xlsm,.pdf,.csv,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files; if (f?.length) void leerArchivos([...f]) }}
          />
          <Boton variante="secundario" onClick={() => setNuevoRenting(rentingNuevo(ivaDefecto))}>+ Renting</Boton>
          <Boton variante="secundario" onClick={() => setNuevaPoliza(polizaNueva())}>+ Póliza</Boton>
          <Boton onClick={() => setEdit(deudaNueva())}>+ Deuda</Boton>
        </div>
      </div>

      {errorArchivo && (
        <div className="mb-4"><Semaforo estado="negativo" texto={errorArchivo} /></div>
      )}

      {lectura && (
        <RevisarPrestamo
          datos={lectura}
          onCancelar={() => setLectura(null)}
          onAceptar={(d) => { guardar(d); setLectura(null) }}
        />
      )}

      {deudas.length === 0 ? (
        <Tarjeta><EstadoVacio icono="deuda" titulo="Aún no hay deudas registradas" descripcion="Da de alta préstamos, pólizas, leasing y acreedores. Verás su cuadro de amortización, el capital pendiente y los vencimientos por tramos." accion={<Boton onClick={() => setEdit(deudaNueva())}>Añadir la primera</Boton>} /></Tarjeta>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Deuda total</div><div className="text-lg font-semibold"><ImporteEuro valor={totalPendiente} /></div></Tarjeta>
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Financiera</div><div className="text-lg font-semibold"><ImporteEuro valor={porGrupo.financiera} /></div></Tarjeta>
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Comercial</div><div className="text-lg font-semibold"><ImporteEuro valor={porGrupo.comercial} /></div></Tarjeta>
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Fiscal</div><div className="text-lg font-semibold"><ImporteEuro valor={porGrupo.fiscal} /></div></Tarjeta>
          </div>

          <Tarjeta>
            <h3 className="font-semibold mb-3">Vencimientos por tramos</h3>
            <TramosBarra tramos={tramos} />
          </Tarjeta>

          <Tarjeta className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left"><th className="px-4 py-2.5 font-medium">Acreedor</th><th className="px-4 py-2.5 font-medium">Tipo</th><th className="px-4 py-2.5 font-medium text-right">Pendiente</th><th className="px-4 py-2.5 font-medium text-right hidden sm:table-cell">Interés</th><th className="px-4 py-2.5"></th></tr></thead>
              <tbody>
                {conCuadro.map((x) => (
                  <Fragment key={x.deuda.id}>
                    <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2.5">{x.deuda.acreedor || '(sin nombre)'}{x.deuda.esVinculada && <span className="ml-2"><Semaforo estado="atencion" texto="Vinculada" /></span>}</td>
                      <td className="px-4 py-2.5">{TIPOS.find((t) => t.valor === x.deuda.tipo)?.texto}</td>
                      <td className="px-4 py-2.5 text-right"><ImporteEuro valor={x.pendiente} /></td>
                      <td className="px-4 py-2.5 text-right tabular hidden sm:table-cell">{formatearPorcentaje(x.deuda.tipoInteres, 2)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button className="underline text-xs mr-3" onClick={() => setExpandida(expandida === x.deuda.id ? null : x.deuda.id)}>{expandida === x.deuda.id ? 'Ocultar' : 'Cuadro'}</button>
                        <button className="underline text-xs mr-3" onClick={() => setEdit({ ...x.deuda })}>Editar</button>
                        <button className="underline text-xs" style={{ color: 'var(--neg)' }} onClick={() => anular(x.deuda.id)}>Anular</button>
                      </td>
                    </tr>
                    {expandida === x.deuda.id && (
                      <tr style={{ background: 'var(--surface-2)' }}>
                        <td colSpan={5} className="px-4 py-3">
                          <div className="overflow-x-auto max-h-72">
                            <table className="w-full text-xs">
                              <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left"><th className="px-2 py-1">#</th><th className="px-2 py-1">Fecha</th><th className="px-2 py-1 text-right">Cuota</th><th className="px-2 py-1 text-right">Interés</th><th className="px-2 py-1 text-right">Capital</th><th className="px-2 py-1 text-right">Pendiente</th></tr></thead>
                              <tbody>
                                {x.cuadro.map((c) => (
                                  <tr key={c.numero} style={{ opacity: c.fecha <= hoy ? 0.5 : 1 }}>
                                    <td className="px-2 py-1 tabular">{c.numero}</td>
                                    <td className="px-2 py-1 tabular">{formatearFecha(c.fecha)}</td>
                                    <td className="px-2 py-1 text-right tabular">{formatearEuro(c.cuota)}</td>
                                    <td className="px-2 py-1 text-right tabular">{formatearEuro(c.interes)}</td>
                                    <td className="px-2 py-1 text-right tabular">{formatearEuro(c.capital)}</td>
                                    <td className="px-2 py-1 text-right tabular">{formatearEuro(c.pendiente)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        </div>
      )}

      {/* Renting y póliza viven aquí porque es donde se mira «qué pago cada mes»,
          pero se presentan aparte: ninguno de los dos es deuda con cuadro. */}
      <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <SeccionRentings
          lectura={lecturaRenting}
          onCerrarLectura={() => setLecturaRenting(null)}
          plantilla={nuevoRenting}
          onCerrarPlantilla={() => setNuevoRenting(null)}
        />
      </div>
      <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <SeccionPolizas
          lectura={lecturaPoliza}
          onCerrarLectura={() => setLecturaPoliza(null)}
          plantilla={nuevaPoliza}
          onCerrarPlantilla={() => setNuevaPoliza(null)}
        />
      </div>

      {edit && (
        <ModalDeuda
          deuda={edit}
          setDeuda={setEdit}
          onGuardar={(d) => { if (d.acreedor.trim()) { guardar(d); setEdit(null) } }}
          onLlevarASeccion={(d) => {
            // Ni el renting ni la póliza se reparten en cuotas: se llevan a su
            // sección con lo poco que ya se haya tecleado, no se pierde nada.
            if (d.tipo === 'RENTING') {
              setNuevoRenting({ ...rentingNuevo(ivaDefecto), arrendador: d.acreedor, fechaInicio: d.fechaInicio })
            } else {
              setNuevaPoliza({
                ...polizaNueva(),
                entidad: d.acreedor,
                limiteConcedido: d.importeOriginal,
                limiteActual: d.importeOriginal,
                tipoInteresDispuesto: d.tipoInteres,
                fechaConstitucion: d.fechaInicio,
              })
            }
            setEdit(null)
          }}
        />
      )}
    </>
  )
}

function ModalDeuda({
  deuda,
  setDeuda,
  onGuardar,
  onLlevarASeccion,
}: {
  deuda: Deuda
  setDeuda: (d: Deuda | null) => void
  onGuardar: (d: Deuda) => void
  onLlevarASeccion: (d: Deuda) => void
}) {
  const cuadro = cuadroDe(deuda)
  const resumen = resumenCuadro(cuadro)
  const financiera = ['PRESTAMO', 'POLIZA', 'LEASING', 'RENTING'].includes(deuda.tipo)
  // Un renting y una póliza NO se reparten en cuotas: registrarlos aquí daría un
  // cuadro de amortización que no existe. Se avisa y se lleva a su sección.
  const otraSeccion = deuda.tipo === 'RENTING' || deuda.tipo === 'POLIZA'
  return (
    <Modal titulo={deuda.acreedor ? 'Editar deuda' : 'Nueva deuda'} onCerrar={() => setDeuda(null)}>
      <div className="space-y-4">
        {otraSeccion && (
          <div className="rounded-xl p-3 text-sm space-y-2" style={{ background: 'var(--surface-2)' }}>
            <p style={{ color: 'var(--warn)' }}>
              {deuda.tipo === 'RENTING'
                ? 'Un renting no es una deuda con cuotas: es un gasto mensual y al final se devuelve el bien.'
                : 'Una póliza de crédito no tiene cuadro de cuotas: se dispone y se devuelve hasta un límite, y se liquidan intereses cada periodo.'}{' '}
              Aquí saldría un cuadro de amortización que no existe.
            </p>
            <Boton variante="secundario" onClick={() => onLlevarASeccion(deuda)}>
              {deuda.tipo === 'RENTING' ? 'Darlo de alta como renting' : 'Darla de alta como póliza de crédito'}
            </Boton>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Select etiqueta="Tipo" valor={deuda.tipo} onChange={(v) => setDeuda({ ...deuda, tipo: v })} opciones={TIPOS.map((t) => ({ valor: t.valor, texto: t.texto }))} />
          <Campo etiqueta="Acreedor" valor={deuda.acreedor} onChange={(v) => setDeuda({ ...deuda, acreedor: v })} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CampoNumero etiqueta="Importe original" valor={deuda.importeOriginal} onChange={(v) => setDeuda({ ...deuda, importeOriginal: v })} sufijo="€" />
          <CampoNumero etiqueta="Tipo de interés anual" valor={deuda.tipoInteres} onChange={(v) => setDeuda({ ...deuda, tipoInteres: v })} sufijo="%" paso="0.01" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <CampoNumero etiqueta="Nº de cuotas" valor={deuda.nPeriodos} onChange={(v) => setDeuda({ ...deuda, nPeriodos: Math.max(1, v) })} />
          <Select etiqueta="Periodicidad" valor={deuda.periodicidad} onChange={(v) => setDeuda({ ...deuda, periodicidad: v })} opciones={[{ valor: 'MENSUAL', texto: 'Mensual' }, { valor: 'TRIMESTRAL', texto: 'Trimestral' }, { valor: 'ANUAL', texto: 'Anual' }]} />
          <Select etiqueta="Sistema" valor={deuda.sistema} onChange={(v) => setDeuda({ ...deuda, sistema: v })} opciones={[{ valor: 'FRANCES', texto: 'Francés' }, { valor: 'LINEAL', texto: 'Lineal' }]} />
        </div>
        <Campo etiqueta="Fecha de inicio" valor={deuda.fechaInicio} onChange={(v) => setDeuda({ ...deuda, fechaInicio: v })} tipo="date" />
        <Campo etiqueta="Garantías" valor={deuda.garantias ?? ''} onChange={(v) => setDeuda({ ...deuda, garantias: v })} />
        <Toggle etiqueta="Operación vinculada (socios o grupo)" valor={deuda.esVinculada} onChange={(v) => setDeuda({ ...deuda, esVinculada: v })} />
        {deuda.esVinculada && <p className="text-xs" style={{ color: 'var(--warn)' }}>Recuerda documentar la operación vinculada y valorarla a mercado.</p>}

        {deuda.importeOriginal > 0 && cuadro.length > 0 && (
          <div className="rounded-xl p-3 text-sm flex justify-between" style={{ background: 'var(--surface-2)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{financiera ? `Cuota ${formatearEuro(cuadro[0].cuota)}` : `Vence el ${formatearFecha(cuadro[cuadro.length - 1].fecha)}`}</span>
            <span>Intereses totales <span className="tabular font-medium">{formatearEuro(resumen.totalIntereses)}</span></span>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1"><Boton variante="secundario" onClick={() => setDeuda(null)}>Cancelar</Boton><Boton onClick={() => onGuardar(deuda)}>Guardar</Boton></div>
      </div>
    </Modal>
  )
}

/**
 * Revisión de lo leído del fichero del banco antes de dar de alta la deuda.
 * Se enseña qué se ha encontrado y qué no, y los campos siguen siendo
 * editables: la app propone, la persona confirma.
 */
function RevisarPrestamo({
  datos,
  onCancelar,
  onAceptar,
}: {
  datos: DatosPrestamo
  onCancelar: () => void
  onAceptar: (d: Deuda) => void
}) {
  const [deuda, setDeuda] = useState<Deuda>(() => ({
    id: nuevoId(),
    creadoEn: new Date().toISOString(),
    creadoPor: 'sistema',
    origen: 'EXCEL',
    tipo: 'PRESTAMO',
    acreedor: [datos.entidad, datos.nombreProducto].filter(Boolean).join(' · ') || '',
    importeOriginal: datos.importeOriginal ?? 0,
    tipoInteres: datos.tipoInteres ?? 0,
    comisiones: datos.comisionApertura,
    periodicidad: datos.periodicidad ?? 'MENSUAL',
    nPeriodos: datos.nPeriodos ?? datos.cuotas.length ?? 12,
    sistema: datos.sistema ?? 'FRANCES',
    fechaInicio: datos.fechaInicio ?? hoyISO(),
    esVinculada: false,
    notas: datos.numeroContrato ? `Contrato ${datos.numeroContrato}` : undefined,
  }))

  const falta = (campo: string) => !datos.encontrados.includes(campo)
  const cuadro = cuadroDe(deuda)
  const cuotaApp = cuadro[0]?.cuota
  // Si la cuota que calcula la app se aparta de la del banco, algo no encaja.
  const desvia = cuotaApp !== undefined && datos.cuota !== undefined && Math.abs(cuotaApp - datos.cuota) > 1

  return (
    <Modal titulo="Alta de préstamo desde el fichero del banco" onCerrar={onCancelar}>
      <div className="space-y-4">
        <div className="rounded-xl p-3 text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
          <p className="font-medium">
            Leído: {datos.encontrados.length > 0 ? datos.encontrados.join(', ') : 'nada aprovechable'}. Revísalo antes de guardar.
          </p>
          {datos.numeroContrato && (
            <p style={{ color: 'var(--text-muted)' }}>
              Contrato {datos.numeroContrato}
              {datos.nombreProducto ? ` · ${datos.nombreProducto}` : ''}
            </p>
          )}
          {datos.cuotas.length > 0 && (
            <p style={{ color: 'var(--text-muted)' }}>
              {datos.cuotas.length} cuotas en el fichero ({datos.nPagadas ?? 0} pagadas, {datos.nPendientes ?? 0} pendientes)
              {datos.capitalPendiente !== undefined ? ` · capital vivo ${formatearEuro(datos.capitalPendiente)}` : ''}
            </p>
          )}
          {datos.avisos.map((a) => (
            <p key={a} style={{ color: 'var(--warn)' }}>· {a}</p>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select etiqueta="Tipo" valor={deuda.tipo} onChange={(v) => setDeuda({ ...deuda, tipo: v })} opciones={TIPOS.map((t) => ({ valor: t.valor, texto: t.texto }))} />
          <Campo etiqueta="Acreedor" valor={deuda.acreedor} onChange={(v) => setDeuda({ ...deuda, acreedor: v })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CampoNumero etiqueta={`Importe original${falta('importeOriginal') ? ' (no leído)' : ''}`} valor={deuda.importeOriginal} onChange={(v) => setDeuda({ ...deuda, importeOriginal: v })} sufijo="€" />
          <CampoNumero etiqueta={`Tipo de interés anual${falta('tipoInteres') ? ' (no leído)' : ''}`} valor={deuda.tipoInteres} onChange={(v) => setDeuda({ ...deuda, tipoInteres: v })} sufijo="%" paso="0.001" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <CampoNumero etiqueta="Nº de cuotas" valor={deuda.nPeriodos} onChange={(v) => setDeuda({ ...deuda, nPeriodos: Math.max(1, v) })} />
          <Select etiqueta="Periodicidad" valor={deuda.periodicidad} onChange={(v) => setDeuda({ ...deuda, periodicidad: v })} opciones={[{ valor: 'MENSUAL', texto: 'Mensual' }, { valor: 'TRIMESTRAL', texto: 'Trimestral' }, { valor: 'ANUAL', texto: 'Anual' }]} />
          <Select etiqueta="Sistema" valor={deuda.sistema} onChange={(v) => setDeuda({ ...deuda, sistema: v })} opciones={[{ valor: 'FRANCES', texto: 'Francés' }, { valor: 'LINEAL', texto: 'Lineal' }]} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta={`Fecha de inicio${falta('fechaInicio') ? ' (no leída)' : ''}`} valor={deuda.fechaInicio} onChange={(v) => setDeuda({ ...deuda, fechaInicio: v })} tipo="date" />
          <CampoNumero etiqueta="Comisión de apertura" valor={deuda.comisiones ?? 0} onChange={(v) => setDeuda({ ...deuda, comisiones: v || undefined })} sufijo="€" />
        </div>

        {/* Comprobación de que lo registrado reproduce el cuadro del banco. */}
        <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--surface-2)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Cuota del banco</span>
            <span className="tabular">{datos.cuota !== undefined ? formatearEuro(datos.cuota) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Cuota que calcula la app</span>
            <span className="tabular">{cuotaApp !== undefined ? formatearEuro(cuotaApp) : '—'}</span>
          </div>
          {desvia && (
            <p className="text-xs mt-1" style={{ color: 'var(--warn)' }}>
              No coinciden. Ajusta el nº de cuotas, el tipo o el sistema hasta que cuadren: si no, el cuadro de la app no será el
              del banco.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onCancelar}>Cancelar</Boton>
          <Boton onClick={() => onAceptar(deuda)}>Dar de alta el préstamo</Boton>
        </div>
        {!deuda.acreedor.trim() && <p className="text-xs text-right" style={{ color: 'var(--warn)' }}>Indica el acreedor.</p>}
      </div>
    </Modal>
  )
}
