import { useRef } from 'react'
import { useStore } from '@/store/store'
import { Card, PageHeader, useToast, useConfirm } from '@/components/ui'
import { IconDownload, IconDatabase, IconTrash } from '@/components/icons'
import { makeBackup, parseBackup, downloadJSON } from '@/lib/backup'
import { clearState } from '@/lib/persist'

export function Backup() {
  const tournaments = useStore((s) => s.tournaments)
  const replaceAll = useStore((s) => s.replaceAll)
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = () => {
    downloadJSON(`copia-torneos-${new Date().toISOString().slice(0, 10)}.json`, makeBackup(tournaments))
    toast('Copia de seguridad descargada')
  }

  const doImport = async (file: File) => {
    try {
      const text = await file.text()
      const imported = parseBackup(text)
      const ok = await confirm({
        title: 'Restaurar copia',
        message: `Se importarán ${imported.length} torneo(s). Esto reemplazará todos los datos actuales. ¿Continuar?`,
        danger: true,
        confirmLabel: 'Restaurar',
      })
      if (!ok) return
      replaceAll({ tournaments: imported, activeTournamentId: imported[0]?.id ?? null })
      toast('Copia restaurada correctamente')
    } catch (e) {
      toast((e as Error).message || 'Archivo no válido')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <PageHeader title="Copia de seguridad y restauración" subtitle="Guarda y recupera todos los datos en un archivo JSON" />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        <Card>
          <div className="flex items-center gap-2 mb-2"><IconDatabase size={20} /><h3 className="font-bold">Exportar copia</h3></div>
          <p className="text-muted text-sm mb-4">Descarga un archivo JSON con todos los torneos, categorías, equipos y resultados. Guárdalo en un lugar seguro.</p>
          <button className="btn btn-primary" onClick={doExport} disabled={tournaments.length === 0}>
            <IconDownload size={18} /> Descargar copia ({tournaments.length})
          </button>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2"><IconDatabase size={20} /><h3 className="font-bold">Restaurar copia</h3></div>
          <p className="text-muted text-sm mb-4">Carga un archivo JSON previamente exportado. Reemplaza los datos actuales.</p>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f) }} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>Seleccionar archivo JSON</button>
        </Card>

        <Card style={{ borderColor: '#ff3b3055' }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: '#ff3b30' }}><IconTrash size={20} /><h3 className="font-bold">Reiniciar datos</h3></div>
          <p className="text-muted text-sm mb-4">Borra todos los torneos de este dispositivo. Exporta una copia antes si quieres conservarlos.</p>
          <button className="btn btn-danger" onClick={async () => {
            const ok = await confirm({ title: 'Reiniciar todos los datos', message: 'Se eliminarán todos los torneos de forma permanente. ¿Continuar?', danger: true, confirmLabel: 'Borrar todo' })
            if (ok) { await clearState(); replaceAll({ tournaments: [], activeTournamentId: null }); toast('Datos reiniciados') }
          }}>
            <IconTrash size={18} /> Borrar todos los datos
          </button>
        </Card>
      </div>
    </>
  )
}
