import React, { useEffect, useState } from 'react'
import { useUI } from '../components'
import { numEs } from '@shared/fechas'

// Tramos de la carga de esta página, medidos por el propio navegador.
interface TramosCarga {
  dns: number // resolver el nombre (umbrel.local / IP)
  conexion: number // abrir la conexión con el servidor
  espera: number // lo que tarda el Umbrel en responder (TTFB)
  descarga: number // descargar la página
  total: number // hasta que la página está lista
}

function leerTramos(): TramosCarga | null {
  const e = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined
  if (!e) return null
  return {
    dns: Math.max(0, e.domainLookupEnd - e.domainLookupStart),
    conexion: Math.max(0, e.connectEnd - e.connectStart),
    espera: Math.max(0, e.responseStart - e.requestStart),
    descarga: Math.max(0, e.responseEnd - e.responseStart),
    total: Math.max(0, e.duration)
  }
}

const ms = (n: number): string => `${numEs(n, 0)} ms`

export function PantallaAjustes(): React.JSX.Element {
  const { toast, confirmar } = useUI()
  const [ruta, setRuta] = useState('')
  const [tramos, setTramos] = useState<TramosCarga | null>(null)
  const [ping, setPing] = useState('')
  const [midiendo, setMidiendo] = useState(false)

  useEffect(() => {
    window.api.app.rutaBaseDatos().then(setRuta)
    setTramos(leerTramos())
  }, [])

  // 5 peticiones seguidas al servidor para medir su velocidad de respuesta actual.
  const medirServidor = async (): Promise<void> => {
    setMidiendo(true)
    try {
      const tiempos: number[] = []
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now()
        await fetch('/api/session', { cache: 'no-store' })
        tiempos.push(performance.now() - t0)
      }
      const media = tiempos.reduce((a, b) => a + b, 0) / tiempos.length
      setPing(`mínimo ${ms(Math.min(...tiempos))} · media ${ms(media)} (5 peticiones)`)
    } catch (e) {
      setPing('Error midiendo: ' + (e as Error).message)
    } finally {
      setMidiendo(false)
    }
  }

  // Interpretación en lenguaje claro de dónde se pierde el tiempo.
  const diagnostico = (t: TramosCarga): Array<{ texto: string; mal: boolean }> => {
    const avisos: Array<{ texto: string; mal: boolean }> = []
    if (t.dns > 500) {
      avisos.push({
        mal: true,
        texto: `⚠️ Resolver el nombre del servidor tardó ${ms(t.dns)}: el retraso es del nombre (p. ej. «umbrel.local»), no de la aplicación. Prueba a entrar por la IP del Umbrel.`
      })
    }
    if (t.conexion > 1000) {
      avisos.push({
        mal: true,
        texto: `⚠️ Abrir la conexión tardó ${ms(t.conexion)}: red lenta hasta el Umbrel (WiFi débil o Tailscale despertando).`
      })
    }
    if (t.espera > 500) {
      avisos.push({
        mal: true,
        texto: `⚠️ El Umbrel tardó ${ms(t.espera)} en responder: la máquina está ocupada (otras apps consumiendo CPU/disco).`
      })
    }
    if (!avisos.length) {
      avisos.push({
        mal: false,
        texto:
          t.total < 1500
            ? '✅ Esta carga fue normal. Si otras veces va lenta, entra en esta pantalla justo después de una carga lenta y mira estos números.'
            : `El total fue de ${ms(t.total)} pero ningún tramo destaca; vuelve a esta pantalla tras una carga lenta para ver el desglose de ese momento.`
      })
    }
    return avisos
  }

  const exportar = async (): Promise<void> => {
    const r = await window.api.backup.exportar()
    if (r.ok) toast('Copia de seguridad guardada')
    else if (r.error) toast('Error: ' + r.error)
  }

  // Solo disponible en la versión web (el servidor cifra con la contraseña de acceso).
  const exportarCifrado = async (): Promise<void> => {
    const r = await window.api.backup.exportarCifrado?.()
    if (r?.ok) toast('Copia cifrada guardada')
    else if (r?.error) toast('Error: ' + r.error)
  }

  const importar = async (): Promise<void> => {
    const ok = await confirmar(
      'Restaurar una copia SOBRESCRIBIRÁ todos los datos actuales. ¿Seguro que quieres continuar?'
    )
    if (!ok) return
    const r = await window.api.backup.importar()
    if (r.ok) {
      toast('Copia restaurada. Reinicia la aplicación para ver los cambios.')
    } else if (r.error) {
      toast('Error: ' + r.error)
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">Ajustes</div>
      </div>

      <div className="card">
        <h3>Copia de seguridad</h3>
        <p className="muted">
          Todos los datos se guardan en un único fichero SQLite en tu ordenador. Haz copias con
          frecuencia y guárdalas en un lugar seguro. La restauración sobrescribe los datos actuales.
        </p>
        {window.api.backup.exportarCifrado && (
          <p className="muted">
            La <b>copia cifrada</b> protege los datos con tu contraseña de acceso: es la opción
            recomendada si vas a guardarla fuera de este equipo (otro disco, la nube…). Solo podrá
            restaurarse con la misma contraseña. Además, el servidor guarda automáticamente una
            copia diaria (se conservan las últimas 30) en la carpeta <code>datos/backups</code>.
          </p>
        )}
        <div className="row">
          <button className="btn primary" onClick={exportar}>
            ⬇️ Exportar copia (.db)
          </button>
          {window.api.backup.exportarCifrado && (
            <button className="btn primary" onClick={exportarCifrado}>
              🔒 Exportar copia cifrada
            </button>
          )}
          <button className="btn danger" onClick={importar}>
            ⬆️ Restaurar copia…
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Ubicación de los datos</h3>
        <p className="muted">Fichero de base de datos actual:</p>
        <code style={{ wordBreak: 'break-all', fontSize: 12 }}>{ruta}</code>
      </div>

      {window.api.fichaAlta && (
        <div className="card">
          <h3>Diagnóstico de velocidad</h3>
          <p className="muted">
            Si la aplicación tarda en abrir, entra aquí <b>justo después</b> de esa carga lenta:
            estos números dicen en qué tramo se perdió el tiempo.
          </p>
          {tramos ? (
            <>
              <table className="tbl" style={{ maxWidth: 560 }}>
                <tbody>
                  <tr>
                    <td>Resolver el nombre del servidor (DNS)</td>
                    <td style={{ textAlign: 'right', fontWeight: tramos.dns > 500 ? 700 : 400 }}>{ms(tramos.dns)}</td>
                  </tr>
                  <tr>
                    <td>Abrir la conexión</td>
                    <td style={{ textAlign: 'right', fontWeight: tramos.conexion > 1000 ? 700 : 400 }}>{ms(tramos.conexion)}</td>
                  </tr>
                  <tr>
                    <td>Espera hasta que el Umbrel responde</td>
                    <td style={{ textAlign: 'right', fontWeight: tramos.espera > 500 ? 700 : 400 }}>{ms(tramos.espera)}</td>
                  </tr>
                  <tr>
                    <td>Descarga de la página</td>
                    <td style={{ textAlign: 'right' }}>{ms(tramos.descarga)}</td>
                  </tr>
                  <tr>
                    <td><b>Total de esta carga</b></td>
                    <td style={{ textAlign: 'right' }}><b>{ms(tramos.total)}</b></td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: 10 }}>
                {diagnostico(tramos).map((a, i) => (
                  <div key={i} className={'aviso ' + (a.mal ? 'aviso' : 'info')}>{a.texto}</div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">El navegador no ha facilitado los tiempos de esta carga.</p>
          )}
          <div className="row" style={{ alignItems: 'center', marginTop: 8 }}>
            <button className="btn" disabled={midiendo} onClick={medirServidor}>
              {midiendo ? 'Midiendo…' : '⏱️ Medir velocidad del servidor ahora'}
            </button>
            {ping && <span className="muted">{ping}</span>}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Protección de datos (RGPD)</h3>
        <p className="muted">
          Esta aplicación funciona 100 % en local. Ningún dato personal (DNI/NIE, nº de Seguridad
          Social, IBAN, dirección) se envía a servidores externos ni a la nube. Eres responsable de
          custodiar el fichero de datos y sus copias.
        </p>
      </div>
    </>
  )
}
