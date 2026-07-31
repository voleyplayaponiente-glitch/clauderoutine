import { useStore, useActiveCategory } from '@/store/store'
import { Card, PageHeader } from '@/components/ui'
import { IconDownload, IconPrint } from '@/components/icons'
import { RequireTournament } from '@/components/Guards'
import { teamsPDF, groupsPDF, schedulePDF, standingsPDF, resultsSheetPDF, bracketPDF, fullReportPDF } from '@/lib/pdf'
import { teamsToCSV, downloadText } from '@/lib/csv'
import type { Category, Tournament } from '@/types'

export function ExportScreen() {
  const activeCat = useActiveCategory()

  return (
    <RequireTournament>
      {(t) => {
        const cat = t.categories.find((c) => c.id === activeCat?.id) ?? t.categories[0]
        const docs: { label: string; make: () => void }[] = cat
          ? [
              { label: 'Listado de equipos', make: () => teamsPDF(t, cat).save(`equipos-${cat.nombre}.pdf`) },
              { label: 'Composición de grupos', make: () => groupsPDF(t, cat).save(`grupos-${cat.nombre}.pdf`) },
              { label: 'Clasificación de grupos', make: () => standingsPDF(t, cat).save(`clasificacion-${cat.nombre}.pdf`) },
              { label: 'Hoja de resultados', make: () => resultsSheetPDF(t, cat).save(`resultados-${cat.nombre}.pdf`) },
              { label: 'Cuadro eliminatorio', make: () => bracketPDF(t, cat).save(`cuadro-${cat.nombre}.pdf`) },
            ]
          : []

        return (
          <>
            <PageHeader title="Impresión y exportación" subtitle={`Documentos en PDF, CSV e impresión A4 · ${cat?.nombre ?? ''}`} />

            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              <Card>
                <h3 className="font-bold mb-3">PDF por categoría ({cat?.nombre})</h3>
                <div className="flex flex-col gap-2">
                  {docs.map((d) => (
                    <button key={d.label} className="btn btn-ghost justify-between" onClick={d.make}>
                      {d.label} <IconDownload size={17} />
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="font-bold mb-3">Documentos del torneo</h3>
                <div className="flex flex-col gap-2">
                  <button className="btn btn-ghost justify-between" onClick={() => schedulePDF(t, t.categories).save(`horario-${t.nombre}.pdf`)}>
                    Horario completo (todas las categorías) <IconDownload size={17} />
                  </button>
                  <button className="btn btn-primary justify-between" onClick={() => fullReportPDF(t).save(`informe-${t.nombre}.pdf`)}>
                    Informe completo del torneo <IconDownload size={17} />
                  </button>
                </div>
              </Card>

              <Card>
                <h3 className="font-bold mb-3">CSV / Excel</h3>
                <div className="flex flex-col gap-2">
                  {cat && (
                    <button className="btn btn-ghost justify-between" onClick={() => downloadText(`equipos-${cat.nombre}.csv`, teamsToCSV(cat.teams))}>
                      Equipos {cat.nombre} (CSV) <IconDownload size={17} />
                    </button>
                  )}
                  <p className="text-xs text-muted">El CSV se abre directamente en Excel o Google Sheets.</p>
                </div>
              </Card>

              <Card>
                <h3 className="font-bold mb-3">Impresión A4</h3>
                <p className="text-muted text-sm mb-3">Abre el diálogo de impresión del navegador. El diseño se adapta a A4 (vista simplificada, sin menús).</p>
                <button className="btn btn-primary" onClick={() => window.print()}>
                  <IconPrint size={18} /> Imprimir vista actual
                </button>
                <p className="text-xs text-muted mt-2">Sugerencia: ve a «Clasificaciones» o «Vista pública» y pulsa imprimir para una hoja limpia.</p>
              </Card>
            </div>
          </>
        )
      }}
    </RequireTournament>
  )
}

export type { Category, Tournament }
