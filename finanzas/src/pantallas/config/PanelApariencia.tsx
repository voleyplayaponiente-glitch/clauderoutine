import { useStore } from '../../store/store'
import { Select, Toggle } from '../../componentes/formularios'
import { Tarjeta } from '../../componentes/ui'
import type { Apariencia } from '../../dominio/tipos'

export function PanelApariencia() {
  const apariencia = useStore((s) => s.config.apariencia)
  const tema = useStore((s) => s.tema)
  const alternarTema = useStore((s) => s.alternarTema)
  const actualizar = useStore((s) => s.actualizarConfig)
  const set = (parcial: Partial<Apariencia>) => actualizar({ apariencia: { ...apariencia, ...parcial } })

  return (
    <div className="max-w-xl space-y-4">
      <Tarjeta>
        <h3 className="font-semibold mb-4">Apariencia</h3>
        <div className="space-y-4">
          <Toggle etiqueta="Modo oscuro" valor={tema === 'oscuro'} onChange={alternarTema} />
          <Select
            etiqueta="Densidad"
            valor={apariencia.densidad}
            onChange={(v) => set({ densidad: v })}
            opciones={[{ valor: 'comoda', texto: 'Cómoda' }, { valor: 'compacta', texto: 'Compacta' }]}
          />
          <Select
            etiqueta="Formato de fecha"
            valor={apariencia.formatoFecha}
            onChange={(v) => set({ formatoFecha: v })}
            opciones={[{ valor: 'dd/mm/aaaa', texto: 'dd/mm/aaaa' }, { valor: 'aaaa-mm-dd', texto: 'aaaa-mm-dd' }]}
          />
          <Select
            etiqueta="Moneda"
            valor={apariencia.moneda}
            onChange={(v) => set({ moneda: v })}
            opciones={[{ valor: 'EUR', texto: 'Euro (€)' }]}
          />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Multi-divisa preparado en el modelo de datos; en la v1 solo EUR.
          </p>
        </div>
      </Tarjeta>
    </div>
  )
}
