import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, Semaforo } from '../componentes/ui'
import { Modal } from '../componentes/formularios'
import { hoyISO, formatearFecha } from '../lib/fechas'
import { descargarBackupJson, descargarBackupExcel, leerBackup, listarSnapshots } from '../lib/copias'
import { descargarCopiaRemota, empresasConCopia, listarCopiasRemotas, probarServidorCopias, type CopiaRemota, type EmpresaConCopia } from '../lib/copias-remotas'
import { Campo, Select, Toggle } from '../componentes/formularios'
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

      <ServidorDeCopias onRestaurar={(backup, origen) => setCandidato({ backup, origen })} />

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

/**
 * Copias contra un servidor propio (el Umbrel).
 *
 * Es la única protección real: la copia automática diaria vive en el mismo
 * IndexedDB que los datos, así que el día que el navegador limpia el sitio se
 * va todo junto. Aquí se sacan a un disco que es tuyo.
 */
function ServidorDeCopias({ onRestaurar }: { onRestaurar: (backup: Backup, origen: string) => void }) {
  const config = useStore((s) => s.config)
  const grupo = useStore((s) => s.grupo)
  const actualizarConfig = useStore((s) => s.actualizarConfig)
  const subirCopiaAhora = useStore((s) => s.subirCopiaAhora)
  const ultimaCopia = useStore((s) => s.ultimaCopiaRemota)
  const servidor = useStore((s) => s.servidorCopias)
  const actualizarServidorCopias = useStore((s) => s.actualizarServidorCopias)
  const errorCopia = useStore((s) => s.errorCopiaRemota)

  // La configuración del servidor es del GRUPO, no de la empresa activa: si
  // fuera por empresa, cada sociedad nueva arrancaría sin copias.
  const cfg = servidor ?? { activo: false, automatico: true }
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [copias, setCopias] = useState<CopiaRemota[] | null>(null)
  const [empresas, setEmpresas] = useState<EmpresaConCopia[]>([])
  // Cuál de las empresas DEL SERVIDOR se está mirando. Tras un borrado del
  // navegador no coincide con la de aquí: la app tiene un id nuevo.
  const [elegida, setElegida] = useState('')

  const guardar = (parcial: Partial<typeof cfg>) => actualizarServidorCopias(parcial)

  const conMensaje = async (accion: () => Promise<{ ok: boolean; mensaje: string }>) => {
    setOcupado(true)
    try {
      const r = await accion()
      setMensaje({ ok: r.ok, texto: r.mensaje })
    } finally {
      setOcupado(false)
    }
  }

  const verCopiasDe = async (empresaId: string) => {
    setElegida(empresaId)
    try {
      setCopias(await listarCopiasRemotas(cfg, empresaId))
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof Error ? e.message : 'No se han podido listar las copias' })
    }
  }

  const refrescar = async () => {
    try {
      const lista = await empresasConCopia(cfg)
      setEmpresas(lista)
      if (lista.length === 0) {
        setCopias([])
        setMensaje({ ok: false, texto: 'El servidor no tiene ninguna copia todavía.' })
        return
      }
      // Se preselecciona la de esta empresa si está; si no, la más reciente.
      const propia = lista.find((e) => e.empresaId === grupo.empresaActivaId)
      await verCopiasDe((propia ?? lista[0]).empresaId)
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof Error ? e.message : 'No se han podido listar las copias' })
    }
  }

  return (
    <Tarjeta className="mb-4">
      <h3 className="font-semibold mb-1">Copias en tu servidor</h3>
      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        La copia automática diaria vive en este mismo navegador, así que no salva si el navegador limpia los datos del sitio.
        Esto las guarda en tu servidor (Umbrel), fuera del navegador.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <Campo
          etiqueta="URL del servidor"
          valor={cfg.url ?? ''}
          onChange={(v) => guardar({ url: v || undefined })}
          placeholder="https://umbrel.local:3001"
        />
        <Campo
          etiqueta="Secreto compartido"
          valor={cfg.secreto ?? ''}
          onChange={(v) => guardar({ secreto: v || undefined })}
          tipo="password"
        />
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Solo se admite HTTPS, o HTTP si el servidor está en tu red local: el secreto viaja en la cabecera de la petición. El
        secreto <strong>no se guarda dentro de los backups</strong>.
      </p>

      <div className="flex flex-wrap items-center gap-4 mb-3">
        <Toggle etiqueta="Usar el servidor para las copias" valor={cfg.activo} onChange={(v) => guardar({ activo: v })} />
        <Toggle
          etiqueta="Subir sola tras cada cambio"
          valor={cfg.automatico}
          onChange={(v) => guardar({ automatico: v })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Boton variante="secundario" onClick={() => void conMensaje(() => probarServidorCopias(cfg))}>
          {ocupado ? 'Probando…' : 'Probar conexión'}
        </Boton>
        <Boton onClick={() => void conMensaje(subirCopiaAhora)}>Copiar ahora</Boton>
        <Boton variante="secundario" onClick={() => void refrescar()}>Ver copias del servidor</Boton>
      </div>

      {mensaje && (
        <p className="text-sm mt-3" style={{ color: mensaje.ok ? 'var(--pos)' : 'var(--neg)' }}>{mensaje.texto}</p>
      )}
      {ultimaCopia && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Última copia subida: {formatearFecha(ultimaCopia.slice(0, 10))}.
        </p>
      )}
      {errorCopia && (
        <p className="text-xs mt-1" style={{ color: 'var(--warn)' }}>La última subida automática falló: {errorCopia}</p>
      )}

      {copias && (
        <div className="mt-3">
          {empresas.length > 0 && (
            <div className="mb-2 max-w-md">
              <Select
                etiqueta="Empresa guardada en el servidor"
                valor={elegida}
                onChange={(v) => void verCopiasDe(v)}
                opciones={empresas.map((e) => ({
                  valor: e.empresaId,
                  texto: `${e.razonSocial || '(sin nombre)'}${e.cif ? ` · ${e.cif}` : ''} — ${e.copias} copia(s)`,
                }))}
              />
              {elegida !== grupo.empresaActivaId && (
                <p className="text-xs mt-1" style={{ color: 'var(--warn)' }}>
                  Esta copia se guardó con otro identificador de empresa (pasa siempre que el navegador se ha limpiado). Al
                  restaurarla, sus datos entran en la empresa que tengas activa ahora.
                </p>
              )}
            </div>
          )}
          <p className="text-sm font-medium mb-1">Copias guardadas</p>
          {copias.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Todavía no hay ninguna. Pulsa «Copiar ahora».</p>
          ) : (
            <ul className="text-sm space-y-1">
              {copias.map((c) => (
                <li key={c.fecha} className="flex justify-between gap-4">
                  <span>{formatearFecha(c.fecha)} · {Math.round(c.bytes / 1024)} KB</span>
                  <button
                    className="underline text-xs"
                    style={{ color: 'var(--color-brand-500)' }}
                    onClick={() =>
                      void descargarCopiaRemota(cfg, elegida || grupo.empresaActivaId, c.fecha)
                        .then((b) => onRestaurar(b, `servidor ${formatearFecha(c.fecha)}`))
                        .catch((e) => setMensaje({ ok: false, texto: e instanceof Error ? e.message : 'No se ha podido descargar' }))
                    }
                  >
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}

        </div>
      )}
    </Tarjeta>
  )
}
