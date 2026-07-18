import React, { useEffect, useState } from 'react'
import { useUI } from '../components'

export function PantallaAjustes(): React.JSX.Element {
  const { toast, confirmar } = useUI()
  const [ruta, setRuta] = useState('')

  useEffect(() => {
    window.api.app.rutaBaseDatos().then(setRuta)
  }, [])

  const exportar = async (): Promise<void> => {
    const r = await window.api.backup.exportar()
    if (r.ok) toast('Copia de seguridad guardada')
    else if (r.error) toast('Error: ' + r.error)
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
        <div className="row">
          <button className="btn primary" onClick={exportar}>
            ⬇️ Exportar copia (.db)
          </button>
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
