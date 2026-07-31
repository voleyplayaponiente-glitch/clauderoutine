import { useRef, useState } from 'react'
import { useStore } from '../../store/store'
import { Tarjeta, Boton, Semaforo } from '../../componentes/ui'
import { exportarConfigJson, importarConfigJson } from '../../lib/backup'

export function PanelDatos() {
  const config = useStore((s) => s.config)
  const reemplazar = useStore((s) => s.reemplazarConfig)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'positivo' | 'negativo'; texto: string } | null>(null)

  const onImportar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const nueva = await importarConfigJson(f)
      reemplazar(nueva)
      setMensaje({ tipo: 'positivo', texto: 'Configuración importada correctamente.' })
    } catch (err) {
      setMensaje({ tipo: 'negativo', texto: err instanceof Error ? err.message : 'No se pudo importar' })
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <Tarjeta>
        <h3 className="font-semibold mb-1">Exportar / importar configuración</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Formato JSON abierto: nunca hay dependencia del proveedor. El backup completo de todos los datos llegará en la Fase 10.
        </p>
        <div className="flex flex-wrap gap-2">
          <Boton onClick={() => exportarConfigJson(config)}>Exportar a JSON</Boton>
          <Boton variante="secundario" onClick={() => inputRef.current?.click()}>Importar desde JSON</Boton>
          <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportar} />
        </div>
        {mensaje && (
          <div className="mt-4">
            <Semaforo estado={mensaje.tipo} texto={mensaje.texto} />
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
