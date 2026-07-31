import { useStore } from '../../store/store'
import { CampoNumero } from '../../componentes/formularios'
import { Tarjeta } from '../../componentes/ui'
import type { Umbrales } from '../../dominio/tipos'

export function PanelUmbrales() {
  const umbrales = useStore((s) => s.config.umbrales)
  const actualizar = useStore((s) => s.actualizarConfig)
  const set = (parcial: Partial<Umbrales>) => actualizar({ umbrales: { ...umbrales, ...parcial } })

  return (
    <div className="max-w-2xl">
      <Tarjeta>
        <h3 className="font-semibold mb-1">Umbrales y alertas</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Estos valores disparan las alertas del dashboard y de cada módulo.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <CampoNumero etiqueta="Saldo mínimo de seguridad" valor={umbrales.saldoMinimoSeguridad} onChange={(v) => set({ saldoMinimoSeguridad: v })} sufijo="€" ayuda="Por debajo de esto, alerta de tensión de liquidez." />
          <CampoNumero etiqueta="Descuadre de caja tolerado" valor={umbrales.descuadreCajaTolerado} onChange={(v) => set({ descuadreCajaTolerado: v })} sufijo="€" ayuda="Por encima exige explicación obligatoria." />
          <CampoNumero etiqueta="Días para stock muerto" valor={umbrales.diasStockMuerto} onChange={(v) => set({ diasStockMuerto: v })} sufijo="días" ayuda="Sin movimiento en este plazo = stock muerto." />
          <CampoNumero etiqueta="Límite de pago en efectivo" valor={umbrales.limitePagoEfectivo} onChange={(v) => set({ limitePagoEfectivo: v })} sufijo="€" ayuda="Entre empresarios: 1.000 € (Ley 11/2021). Editable." />
          <CampoNumero etiqueta="Días de retraso para reclamar" valor={umbrales.diasRetrasoReclamar} onChange={(v) => set({ diasRetrasoReclamar: v })} sufijo="días" ayuda="Deudor vencido más de X días = a reclamar." />
          <CampoNumero etiqueta="Meses en negativo para alertar" valor={umbrales.mesesNegativoAlertaPunto} onChange={(v) => set({ mesesNegativoAlertaPunto: v })} sufijo="meses" ayuda="Punto de venta en pérdidas N meses seguidos." />
        </div>
      </Tarjeta>
    </div>
  )
}
