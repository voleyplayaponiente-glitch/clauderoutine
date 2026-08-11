import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, Semaforo } from '../componentes/ui'
import { Modal } from '../componentes/formularios'
import { hoyISO, formatearFecha } from '../lib/fechas'
import { descargarBackupJson, descargarBackupExcel, leerBackup, listarSnapshots } from '../lib/copias'
import { resumenBackup, mismaEmpresa } from '../dominio/backup'
import type { Backup } from '../dominio/backup'

export function Copias() {
  const config = useStore((s) => s.config)
  const datos = useStore((s) => s.datos)
  const grupo = useStore((s) => s.grupo)
  const restaurarTodo = useStore((s) => s.restaurarTodo)
  const hoy = hoyISO()
  const fileRef = useRef<HTMLInputElement>(null)
  const [snapshots, setSnapshots] = useState<Backup[]>([])
  const [candidato, setCandidato] = useState<{ backup: Backup; origen: string } | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'positivo' | 'negativo'; texto: string } | null>(null)

  const recargarSnapshots = () => listarSnapshots().then(setSnapshots)
  useEffect(() => { void recargarSnapshots() }, [datos])

  const onFichero = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const backup = await leerBackup(f)
      setCandidato({ backup, origen: f.name })
    } catch (err) {
      setMensaje({ tipo: 'negativo', texto: err instanceof Error ? err.message : 'No se pudo leer el backup' })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const confirmarRestauracion = () => {
    if (!candidato) return
    // Backup previo de seguridad de los datos actuales antes de sobrescribir.
    descargarBackupJson(config, datos, `previo-${hoy}`, grupo)
    restaurarTodo(candidato.backup.config, candidato.backup.datos)
    setMensaje({ tipo: 'positivo', texto: `Restaurado desde ${candidato.origen}. Se descargó un backup previo de seguridad.` })
    setCandidato(null)
  }

  return (
    <>
      <CabeceraPantalla titulo="Copias de seguridad" descripcion="Backup completo, restauración verificada y snapshots automáticos diarios." />

      <QueHayGuardado />

      {mensaje && <div className="mb-4"><Semaforo estado={mensaje.tipo} texto={mensaje.texto} /></div>}

      <div className="grid md:grid-cols-2 gap-4">
        <Tarjeta>
          <h3 className="font-semibold mb-1">Copia manual</h3>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Descarga todos tus datos en formato abierto. El JSON incluye un checksum de integridad.</p>
          {/* Decirlo claro: es la diferencia entre creerse a salvo y estarlo. */}
          <p className="text-xs mb-4" style={{ color: 'var(--warn)' }}>
            Los PDF de las facturas <strong>no van dentro del JSON</strong> (lo harían enorme). Para llevarte también los
            documentos, descarga la «Carpeta para la gestoría» de cada mes desde Compras.
          </p>
          <div className="flex gap-2">
            <Boton onClick={() => descargarBackupJson(config, datos, hoy, grupo)}>Descargar JSON</Boton>
            <Boton variante="secundario" onClick={() => void descargarBackupExcel(datos, hoy)}>Descargar Excel</Boton>
          </div>
        </Tarjeta>

        <Tarjeta>
          <h3 className="font-semibold mb-1">Restaurar</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Restaura desde un backup JSON. Se verifica la integridad y se crea un backup previo antes de sobrescribir.</p>
          <Boton variante="secundario" onClick={() => fileRef.current?.click()}>Elegir backup…</Boton>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFichero} />
        </Tarjeta>
      </div>

      <Tarjeta className="mt-4">
        <h3 className="font-semibold mb-1">Snapshots automáticos</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Se guarda una copia diaria en este dispositivo (retención: 7 días). Para copias en la nube o disco externo hará falta el módulo de servidor.</p>
        {snapshots.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aún no hay snapshots. Se creará uno automáticamente.</p>
        ) : (
          <div className="space-y-2">
            {snapshots.map((s) => {
              const total = resumenBackup(s.datos).reduce((a, r) => a + r.n, 0)
              return (
                <div key={s.fecha} className="flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                  <span>{formatearFecha(s.fecha.slice(0, 10))} · {total} registros · <span className="tabular" style={{ color: 'var(--text-muted)' }}>checksum {s.checksum}</span></span>
                  <button className="underline text-xs" style={{ color: 'var(--color-brand-500)' }} onClick={() => setCandidato({ backup: s, origen: `snapshot ${formatearFecha(s.fecha.slice(0, 10))}` })}>Restaurar</button>
                </div>
              )
            })}
          </div>
        )}
      </Tarjeta>

      {candidato && (
        <Modal titulo="Confirmar restauración" onCerrar={() => setCandidato(null)}>
          <div className="space-y-4">
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,159,10,.12)', border: '1px solid var(--warn)' }}>
              <p className="text-sm" style={{ color: 'var(--text)' }}>Vas a <strong>sobrescribir los datos de «{config.empresa.razonSocial || 'la empresa activa'}»</strong> con «{candidato.origen}». Se descargará antes un backup previo de seguridad.</p>
            </div>
            {!mismaEmpresa(
              { cif: candidato.backup.config?.empresa?.cif, razonSocial: candidato.backup.config?.empresa?.razonSocial },
              { cif: config.empresa.cif, razonSocial: config.empresa.razonSocial },
            ) && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,69,58,.12)', border: '1px solid var(--neg)' }}>
                <p className="text-sm" style={{ color: 'var(--text)' }}>
                  <strong>Atención: el backup es de otra sociedad.</strong> Contiene «{candidato.backup.config?.empresa?.razonSocial || 'sin nombre'}»
                  {candidato.backup.config?.empresa?.cif ? ` (${candidato.backup.config.empresa.cif})` : ''} y la empresa activa es
                  «{config.empresa.razonSocial || 'sin nombre'}»{config.empresa.cif ? ` (${config.empresa.cif})` : ''}.
                  Si continúas, la contabilidad de la empresa activa quedará reemplazada por la de otra entidad jurídica.
                  Cambia antes de empresa en la cabecera si no es lo que quieres.
                </p>
              </div>
            )}
            <div>
              <div className="text-sm font-medium mb-2">Contenido del backup</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {resumenBackup(candidato.backup.datos).filter((r) => r.n > 0).map((r) => (
                  <div key={r.clave} className="flex justify-between rounded px-2 py-1" style={{ background: 'var(--surface-2)' }}><span style={{ color: 'var(--text-muted)' }}>{r.etiqueta}</span><span className="tabular font-medium">{r.n}</span></div>
                ))}
              </div>
              <div className="mt-3"><Semaforo estado="positivo" texto={`Integridad verificada · checksum ${candidato.backup.checksum}`} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Boton variante="secundario" onClick={() => setCandidato(null)}>Cancelar</Boton>
              <Boton onClick={confirmarRestauracion}>Restaurar y sobrescribir</Boton>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

/**
 * Qué hay realmente guardado en este navegador.
 *
 * Cuando la app aparece vacía, la primera pregunta es si los datos se han
 * perdido o simplemente no se están viendo. Esto lo responde sin abrir las
 * herramientas de desarrollo: lista los espacios de empresa que hay en
 * IndexedDB, tengan o no ficha en el índice del grupo.
 */
function QueHayGuardado() {
  const [espacios, setEspacios] = useState<{ empresaId: string; razonSocial: string; cif: string; tieneDatos: boolean }[] | null>(null)

  useEffect(() => {
    void import('../lib/db').then((m) => m.espaciosGuardados().then(setEspacios))
  }, [])

  if (!espacios) return null

  const conDatos = espacios.filter((e) => e.tieneDatos)
  return (
    <Tarjeta className="mb-4">
      <h3 className="font-semibold mb-1">Qué hay guardado en este navegador</h3>
      {espacios.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--neg)' }}>
          No hay ningún espacio de empresa en este navegador. O es la primera vez que abres la app aquí, o el navegador ha
          limpiado los datos del sitio. Restaura desde un backup JSON o desde un snapshot con registros.
        </p>
      ) : (
        <>
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            {espacios.length} espacio(s) de empresa, {conDatos.length} con datos dentro. Se leen directamente del almacén del
            navegador, aunque no aparezcan en el selector de empresa.
          </p>
          <ul className="text-sm space-y-1">
            {espacios.map((e) => (
              <li key={e.empresaId} className="flex justify-between gap-4">
                <span>{e.razonSocial || '(sin razón social)'}{e.cif ? ` · ${e.cif}` : ''}</span>
                <span style={{ color: e.tieneDatos ? 'var(--pos)' : 'var(--text-muted)' }}>
                  {e.tieneDatos ? 'con datos' : 'vacío'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Tarjeta>
  )
}
