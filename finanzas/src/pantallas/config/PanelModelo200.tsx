import { useRef, useState } from 'react'
import { useStore } from '../../store/store'
import { Tarjeta, Boton, Semaforo } from '../../componentes/ui'
import { formatearEuro, formatearPorcentaje } from '../../dominio/dinero'
import { filasDePrestamo } from '../../lib/extracto'
import { esModelo200, leerModelo200, type DatosModelo200 } from '../../dominio/modelo200'
import { nuevoId } from '../../dominio/id'
import type { EjercicioAnterior } from '../../dominio/tipos'

/**
 * Subir el **Impuesto sobre Sociedades (Modelo 200)** del año anterior.
 *
 * Es el atajo para arrancar: un solo PDF trae la sociedad, sus socios, sus
 * participaciones, el balance, la cuenta de resultados y la liquidación, ya
 * cerrados y presentados. Teclear todo eso a mano son horas y errores.
 *
 * Como el resto de lectores de la app, **propone y no aplica nada solo**: se ve
 * lo leído, y cada bloque se lleva a su sitio con un botón.
 */
export function PanelModelo200() {
  const config = useStore((s) => s.config)
  const actualizarConfig = useStore((s) => s.actualizarConfig)
  const grupo = useStore((s) => s.grupo)
  const guardarSocio = useStore((s) => s.guardarSocio)
  const inputRef = useRef<HTMLInputElement>(null)

  const [datos, setDatos] = useState<DatosModelo200 | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'positivo' | 'negativo' | 'atencion'; texto: string } | null>(null)

  const anterior = config.ejercicioAnterior

  const onFichero = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setLeyendo(true)
    setMensaje(null)
    setDatos(null)
    try {
      const filas = await filasDePrestamo(f)
      if (!esModelo200(filas)) {
        setMensaje({
          tipo: 'negativo',
          texto:
            'Este documento no parece un Modelo 200. Si es un PDF escaneado (sin capa de texto) no se puede leer: ' +
            'descarga el justificante desde la Sede Electrónica de la AEAT.',
        })
        return
      }
      setDatos(leerModelo200(filas))
    } catch (err) {
      setMensaje({ tipo: 'negativo', texto: err instanceof Error ? err.message : 'No se pudo leer el fichero' })
    } finally {
      setLeyendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const aplicarEmpresa = () => {
    if (!datos) return
    actualizarConfig({
      empresa: {
        ...config.empresa,
        razonSocial: datos.razonSocial || config.empresa.razonSocial,
        cif: datos.nif || config.empresa.cif,
        // El ejercicio en curso es el SIGUIENTE al declarado.
        ejercicioActual: datos.ejercicio ? datos.ejercicio + 1 : config.empresa.ejercicioActual,
      },
    })
    setMensaje({ tipo: 'positivo', texto: 'Datos de la empresa rellenados. Revísalos en la pestaña «Empresa».' })
  }

  const guardarEjercicio = () => {
    if (!datos?.ejercicio) return
    const e: EjercicioAnterior = {
      ejercicio: datos.ejercicio,
      origen: 'MODELO_200',
      importadoEn: new Date().toISOString().slice(0, 10),
      totalActivo: datos.balance.totalActivo,
      patrimonioNeto: datos.balance.patrimonioNeto,
      capital: datos.balance.capital,
      reservas: datos.balance.reservas,
      pasivoNoCorriente: datos.balance.pasivoNoCorriente,
      pasivoCorriente: datos.balance.pasivoCorriente,
      resultado: datos.perdidasYGanancias.resultado,
      resultadoAntesImpuestos: datos.perdidasYGanancias.resultadoAntesImpuestos,
      ingresosFinancieros: datos.perdidasYGanancias.ingresosFinancieros,
      gastosFinancieros: datos.perdidasYGanancias.gastosFinancieros,
      baseImponible: datos.liquidacion.baseImponible,
      tipoGravamen: datos.liquidacion.tipoGravamen,
      cuotaLiquida: datos.liquidacion.cuotaLiquida,
      binPendiente: datos.binPendiente,
    }
    actualizarConfig({ ejercicioAnterior: e })
    setMensaje({ tipo: 'positivo', texto: `Guardadas las cifras del ejercicio ${e.ejercicio}.` })
  }

  const crearSocios = () => {
    if (!datos || datos.socios.length === 0) return
    const empresaId = grupo?.empresaActivaId
    if (!empresaId) {
      setMensaje({ tipo: 'negativo', texto: 'No hay empresa activa a la que asignar los socios.' })
      return
    }
    let creados = 0
    let repetidos = 0
    for (const s of datos.socios) {
      // No se duplica a nadie: si ese NIF ya está de alta, se deja como está.
      const ya = (grupo?.socios ?? []).some((x) => x.empresaId === empresaId && x.nifCif === s.nif)
      if (ya) { repetidos++; continue }
      const r = guardarSocio({
        id: nuevoId(),
        empresaId,
        nombre: s.nombre ?? '(sin nombre)',
        nifCif: s.nif ?? '',
        tipo: (s.nif ?? '').match(/^\d/) ? 'PERSONA_FISICA' : 'PERSONA_JURIDICA',
        capitalNominal: s.nominal ?? 0,
      })
      if (r.ok) creados++
    }
    setMensaje({
      tipo: creados > 0 ? 'positivo' : 'atencion',
      texto:
        `${creados} socio(s) creados` +
        (repetidos > 0 ? `, ${repetidos} ya estaban de alta y no se han tocado` : '') +
        '. El porcentaje se calcula solo desde el capital, no se teclea.',
    })
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Tarjeta>
        <h3 className="font-semibold mb-1">Partir del Impuesto sobre Sociedades del año anterior</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Sube el <strong>Modelo 200</strong> presentado (el justificante en PDF de la Sede Electrónica). De ahí salen la
          sociedad, sus socios, sus participaciones, el balance, la cuenta de resultados y la liquidación del ejercicio:
          la foto de partida del año en curso. <strong>No se aplica nada solo</strong>: verás lo leído y decides qué llevar
          a su sitio.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <Boton onClick={() => inputRef.current?.click()} disabled={leyendo}>
            {leyendo ? 'Leyendo…' : 'Subir Modelo 200 en PDF'}
          </Boton>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf,.xlsx,.xls,.csv"
            className="hidden"
            onChange={onFichero}
          />
        </div>
        {mensaje && (
          <div className="mt-4">
            <Semaforo estado={mensaje.tipo} texto={mensaje.texto} />
          </div>
        )}
      </Tarjeta>

      {anterior && !datos && (
        <Tarjeta>
          <h3 className="font-semibold mb-3">Ejercicio {anterior.ejercicio} guardado</h3>
          <Cifras
            filas={[
              ['Total activo', anterior.totalActivo],
              ['Patrimonio neto', anterior.patrimonioNeto],
              ['Resultado del ejercicio', anterior.resultado],
              ['Base imponible', anterior.baseImponible],
            ]}
          />
          {anterior.binPendiente ? (
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              Quedan <strong>{formatearEuro(anterior.binPendiente)}</strong> de bases imponibles negativas por compensar.
            </p>
          ) : null}
        </Tarjeta>
      )}

      {datos && (
        <>
          <Tarjeta>
            <h3 className="font-semibold mb-3">Lo que dice el documento</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              <Dato rotulo="Sociedad" valor={datos.razonSocial} />
              <Dato rotulo="NIF" valor={datos.nif} />
              <Dato rotulo="Ejercicio" valor={datos.ejercicio ? String(datos.ejercicio) : undefined} />
              <Dato
                rotulo="Periodo"
                valor={datos.periodo ? `${datos.periodo.desde} a ${datos.periodo.hasta}` : undefined}
              />
              <Dato rotulo="CNAE" valor={datos.cnae} />
            </dl>
            <div className="mt-3">
              <Boton onClick={aplicarEmpresa} disabled={!datos.nif && !datos.razonSocial}>
                Rellenar los datos de la empresa
              </Boton>
            </div>
          </Tarjeta>

          <Tarjeta>
            <h3 className="font-semibold mb-3">Balance a cierre</h3>
            <Cifras
              filas={[
                ['Activo no corriente', datos.balance.activoNoCorriente],
                ['Activo corriente', datos.balance.activoCorriente],
                ['TOTAL ACTIVO', datos.balance.totalActivo],
                ['Patrimonio neto', datos.balance.patrimonioNeto],
                ['· Capital', datos.balance.capital],
                ['· Reservas', datos.balance.reservas],
                ['· Resultado del ejercicio', datos.balance.resultadoEjercicio],
                ['Pasivo no corriente', datos.balance.pasivoNoCorriente],
                ['Pasivo corriente', datos.balance.pasivoCorriente],
                ['TOTAL PATRIMONIO NETO Y PASIVO', datos.balance.totalPasivo],
              ]}
            />
          </Tarjeta>

          <Tarjeta>
            <h3 className="font-semibold mb-3">Resultado del ejercicio</h3>
            <Cifras
              filas={[
                ['Resultado de explotación', datos.perdidasYGanancias.resultadoExplotacion],
                ['Ingresos financieros', datos.perdidasYGanancias.ingresosFinancieros],
                ['Gastos financieros', datos.perdidasYGanancias.gastosFinancieros],
                ['Resultado financiero', datos.perdidasYGanancias.resultadoFinanciero],
                ['Resultado antes de impuestos', datos.perdidasYGanancias.resultadoAntesImpuestos],
                ['Impuesto sobre sociedades', datos.perdidasYGanancias.impuestoSociedades],
                ['RESULTADO', datos.perdidasYGanancias.resultado],
              ]}
            />
          </Tarjeta>

          <Tarjeta>
            <h3 className="font-semibold mb-3">Liquidación del impuesto</h3>
            <Cifras
              filas={[
                ['Base imponible', datos.liquidacion.baseImponible],
                ['Cuota íntegra', datos.liquidacion.cuotaIntegra],
                ['Cuota líquida', datos.liquidacion.cuotaLiquida],
                ['A ingresar o devolver', datos.liquidacion.resultadoDeclaracion],
              ]}
            />
            {datos.liquidacion.tipoGravamen !== undefined && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Tipo de gravamen: {formatearPorcentaje(datos.liquidacion.tipoGravamen)}
              </p>
            )}
            {datos.binPendiente ? (
              <p className="text-sm mt-3">
                <strong>{formatearEuro(datos.binPendiente)}</strong> de bases imponibles negativas pendientes de
                compensar en ejercicios futuros. Reducen el impuesto de los años siguientes: conviene no perderlas de
                vista.
              </p>
            ) : null}
            <div className="mt-3">
              <Boton onClick={guardarEjercicio} disabled={!datos.ejercicio}>
                Guardar las cifras del ejercicio {datos.ejercicio ?? ''}
              </Boton>
            </div>
          </Tarjeta>

          {datos.socios.length > 0 && (
            <Tarjeta>
              <h3 className="font-semibold mb-3">Socios ({datos.socios.length})</h3>
              <table className="w-full text-sm">
                <tbody>
                  {datos.socios.map((s) => (
                    <tr key={s.nif}>
                      <td className="py-1">{s.nombre}</td>
                      <td className="py-1" style={{ color: 'var(--text-muted)' }}>{s.nif}</td>
                      <td className="py-1 text-right tabular-nums">{formatearEuro(s.nominal ?? 0)}</td>
                      <td className="py-1 text-right tabular-nums">{formatearPorcentaje(s.porcentaje ?? 0, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3">
                <Boton onClick={crearSocios}>Dar de alta estos socios</Boton>
              </div>
            </Tarjeta>
          )}

          {datos.participadas.length > 0 && (
            <Tarjeta>
              <h3 className="font-semibold mb-3">Participaciones en otras sociedades</h3>
              {datos.participadas.map((p) => (
                <div key={p.nif ?? p.nombre} className="text-sm">
                  <div className="font-medium">{p.nombre}</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {p.nif} · {formatearPorcentaje(p.porcentaje ?? 0, 2)} · en libros {formatearEuro(p.valorLibros ?? 0)}
                    {p.dividendos ? ` · dividendos ${formatearEuro(p.dividendos)}` : ''}
                  </div>
                </div>
              ))}
              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                Para que cuenten en el organigrama, la sociedad participada tiene que existir en{' '}
                <strong>Grupo de empresas</strong>; la participación se registra allí. No se crea sola: dar de alta una
                sociedad implica un espacio de datos propio, y esa decisión es tuya.
              </p>
            </Tarjeta>
          )}

          {datos.avisos.length > 0 && (
            <Tarjeta>
              <h3 className="font-semibold mb-2">Avisos</h3>
              <ul className="text-sm space-y-2 list-disc pl-5">
                {datos.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </>
      )}
    </div>
  )
}

function Dato({ rotulo, valor }: { rotulo: string; valor?: string }) {
  return (
    <>
      <dt style={{ color: 'var(--text-muted)' }}>{rotulo}</dt>
      <dd>{valor ?? <span style={{ color: 'var(--text-muted)' }}>— no leído</span>}</dd>
    </>
  )
}

/** Filas de cifras. Lo que no venga en el documento se deja vacío, no a cero. */
function Cifras({ filas }: { filas: [string, number | undefined][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {filas.map(([rotulo, valor]) => (
          <tr key={rotulo}>
            <td className="py-1">{rotulo}</td>
            <td className="py-1 text-right tabular-nums">
              {valor === undefined ? <span style={{ color: 'var(--text-muted)' }}>—</span> : formatearEuro(valor)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
