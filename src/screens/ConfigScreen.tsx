import { useStore } from '@/store/store'
import { Card, PageHeader, Field, Select, Toggle } from '@/components/ui'
import { RequireCategory } from '@/components/Guards'
import { TIEBREAK_LABEL } from '@/lib/labels'
import type { CompetitionConfig, TiebreakCriterion } from '@/types'

export function ConfigScreen() {
  const updateCategoryConfig = useStore((s) => s.updateCategoryConfig)

  return (
    <RequireCategory>
      {(t, cat) => {
        const cfg = cat.config
        const set = (patch: Partial<CompetitionConfig>) => updateCategoryConfig(t.id, cat.id, { ...cfg, ...patch })
        const moveCriterion = (idx: number, dir: -1 | 1) => {
          const order = [...cfg.tiebreakOrder]
          const j = idx + dir
          if (j < 0 || j >= order.length) return
          ;[order[idx], order[j]] = [order[j], order[idx]]
          set({ tiebreakOrder: order })
        }

        return (
          <>
            <PageHeader title={`Sistema de competición · ${cat.nombre}`} subtitle="Configura el formato de esta categoría. Los cambios estructurales requieren regenerar el sorteo." />

            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
              <Card>
                <h3 className="font-bold mb-4">Estructura de grupos</h3>
                <div className="grid gap-3">
                  <Field label="Número de equipos">
                    <Select value={String(cfg.numEquipos)} onChange={(v) => { const n = Number(v) as 8 | 16 | 32; set({ numEquipos: n, numGrupos: n / 4, equiposPorGrupo: 4 }) }} options={[{ value: '8', label: '8 equipos' }, { value: '16', label: '16 equipos' }, { value: '32', label: '32 equipos' }]} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nº de grupos"><input className="input" type="number" min={1} value={cfg.numGrupos} onChange={(e) => set({ numGrupos: Math.max(1, Number(e.target.value)) })} /></Field>
                    <Field label="Equipos por grupo"><input className="input" type="number" min={2} value={cfg.equiposPorGrupo} onChange={(e) => set({ equiposPorGrupo: Math.max(2, Number(e.target.value)) })} /></Field>
                  </div>
                  <Field label="Clasificados por grupo"><input className="input" type="number" min={1} max={cfg.equiposPorGrupo} value={cfg.clasificadosPorGrupo} onChange={(e) => set({ clasificadosPorGrupo: Number(e.target.value) })} /></Field>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Clasificación de mejores terceros</span>
                    <Toggle checked={cfg.mejoresTerceros} onChange={(v) => set({ mejoresTerceros: v })} />
                  </div>
                  {cfg.mejoresTerceros && <Field label="Nº de mejores terceros"><input className="input" type="number" min={0} value={cfg.numMejoresTerceros} onChange={(e) => set({ numMejoresTerceros: Number(e.target.value) })} /></Field>}
                  <Field label="Jugadores por equipo" hint="P. ej. 2 en 2x2, 5/6 en otras modalidades. Se aplica a los equipos nuevos.">
                    <Select value={String(cfg.jugadoresPorEquipo)} onChange={(v) => set({ jugadoresPorEquipo: Number(v) })} options={[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({ value: String(n), label: `${n} jugadores` }))} />
                  </Field>
                  <Field label="Subcategorías" hint="Separadas por comas (p. ej. SUB-17, SUB-15). Etiqueta cada equipo dentro de esta misma competición.">
                    <input
                      className="input"
                      value={cfg.subcategorias.join(', ')}
                      onChange={(e) => set({ subcategorias: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                      placeholder="SUB-17, SUB-15"
                    />
                  </Field>
                </div>
              </Card>

              <Card>
                <h3 className="font-bold mb-4">Reglas de juego</h3>
                <div className="grid gap-3">
                  <Field label="Formato de partido">
                    <Select value={cfg.alMejorDeTres ? '3' : '1'} onChange={(v) => set({ alMejorDeTres: v === '3' })} options={[{ value: '1', label: 'A un set' }, { value: '3', label: 'Al mejor de 3 sets' }]} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Puntos por set"><input className="input" type="number" min={1} value={cfg.puntosPorSet} onChange={(e) => set({ puntosPorSet: Number(e.target.value) })} /></Field>
                    <Field label="Puntos set decisivo"><input className="input" type="number" min={1} value={cfg.puntosSetDecisivo} onChange={(e) => set({ puntosSetDecisivo: Number(e.target.value) })} /></Field>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Diferencia mínima de 2 puntos</span>
                    <Toggle checked={cfg.diferenciaDosPuntos} onChange={(v) => set({ diferenciaDosPuntos: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Partido por el 3.º puesto</span>
                    <Toggle checked={cfg.tercerPuesto} onChange={(v) => set({ tercerPuesto: v })} />
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="font-bold mb-4">Sorteo</h3>
                <div className="grid gap-3">
                  <Field label="Distribución de equipos">
                    <Select value={cfg.sorteoAutomatico ? 'auto' : 'manual'} onChange={(v) => set({ sorteoAutomatico: v === 'auto' })} options={[{ value: 'auto', label: 'Sorteo automático' }, { value: 'manual', label: 'Distribución manual' }]} />
                  </Field>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Usar cabezas de serie</span>
                    <Toggle checked={cfg.usarCabezasSerie} onChange={(v) => set({ usarCabezasSerie: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Evitar mismo grupo en los cruces</span>
                    <Toggle checked={cfg.evitarMismoGrupoEnCruces} onChange={(v) => set({ evitarMismoGrupoEnCruces: v })} />
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="font-bold mb-1">Criterios de desempate</h3>
                <p className="text-muted text-sm mb-3">Ordena los criterios (arriba = mayor prioridad).</p>
                <div className="flex flex-col gap-2">
                  {cfg.tiebreakOrder.map((c: TiebreakCriterion, i) => (
                    <div key={c} className="flex items-center gap-2 surface-2 rounded-xl px-3 py-2" style={{ borderRadius: 12 }}>
                      <span className="font-bold text-muted" style={{ width: 20 }}>{i + 1}</span>
                      <span className="flex-1 text-sm font-medium">{TIEBREAK_LABEL[c]}</span>
                      <button className="btn btn-ghost" style={{ padding: '2px 8px' }} disabled={i === 0} onClick={() => moveCriterion(i, -1)}>↑</button>
                      <button className="btn btn-ghost" style={{ padding: '2px 8px' }} disabled={i === cfg.tiebreakOrder.length - 1} onClick={() => moveCriterion(i, 1)}>↓</button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )
      }}
    </RequireCategory>
  )
}
