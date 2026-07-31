import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { useStore, useActiveCategory, useActiveTournament } from '@/store/store'
import { Card, PageHeader, useToast } from '@/components/ui'
import { IconShare, IconEye } from '@/components/icons'
import { RequireCategory } from '@/components/Guards'
import { StandingsTable } from './Standings'
import { BracketView } from '@/components/BracketView'
import { categoryStandings } from '@/lib/category'

export function PublicView() {
  const role = useStore((s) => s.role)
  const setRole = useStore((s) => s.setRole)
  const tournament = useActiveTournament()
  const activeCat = useActiveCategory()
  const toast = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shareUrl] = useState(() => {
    const base = window.location.href.split('#')[0]
    return `${base}#/publico`
  })

  useEffect(() => {
    if (canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, shareUrl, { width: 168, margin: 1 }, () => {})
    }
  }, [shareUrl, activeCat?.id])

  return (
    <RequireCategory>
      {(_t, cat) => {
        const standings = categoryStandings(cat)
        return (
          <>
            <PageHeader
              title={`Vista pública · ${tournament?.nombre ?? ''}`}
              subtitle="Consulta de horarios, resultados, clasificaciones y cuadros (solo lectura)"
              actions={
                role === 'admin' ? (
                  <button className="btn btn-ghost" onClick={() => setRole('public')}><IconEye size={17} /> Ver como público</button>
                ) : (
                  <button className="btn btn-primary" onClick={() => setRole('admin')}>Volver a administración</button>
                )
              }
            />

            <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)' }}>
              <Card>
                <h3 className="font-bold mb-1">Compartir torneo</h3>
                <p className="text-muted text-sm mb-3">Comparte este enlace o el código QR para consultar el torneo en modo público.</p>
                <div className="flex gap-2 flex-wrap">
                  <input className="input" readOnly value={shareUrl} style={{ flex: 1, minWidth: 180 }} />
                  <button className="btn btn-primary" onClick={async () => {
                    try { await navigator.clipboard.writeText(shareUrl); toast('Enlace copiado') } catch { toast('Copia manualmente el enlace') }
                  }}><IconShare size={17} /> Copiar</button>
                </div>
                <p className="text-xs text-muted mt-3">Nota: los datos se guardan en este dispositivo. Para compartir entre dispositivos sin conexión, usa «Copia de seguridad» (JSON) o activa una base de datos remota.</p>
              </Card>
              <Card className="flex flex-col items-center justify-center">
                <canvas ref={canvasRef} style={{ borderRadius: 12 }} />
                <p className="text-xs text-muted mt-2">Escanea para abrir</p>
              </Card>
            </div>

            <h2 className="text-xl font-bold mb-3">Clasificaciones</h2>
            <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
              {standings.map(({ group, rows }) => <StandingsTable key={group.id} cat={cat} nombre={group.nombre} rows={rows} />)}
            </div>

            <h2 className="text-xl font-bold mb-3">Cuadro eliminatorio</h2>
            <BracketView cat={cat} />
          </>
        )
      }}
    </RequireCategory>
  )
}
