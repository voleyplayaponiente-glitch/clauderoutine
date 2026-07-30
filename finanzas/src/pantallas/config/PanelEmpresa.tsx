import { useStore } from '../../store/store'
import { Campo, Toggle, Select } from '../../componentes/formularios'
import { Tarjeta } from '../../componentes/ui'
import { validarNifCif } from '../../dominio/validacion'
import type { DatosEmpresa } from '../../dominio/tipos'

export function PanelEmpresa() {
  const empresa = useStore((s) => s.config.empresa)
  const actualizar = useStore((s) => s.actualizarConfig)

  const set = (parcial: Partial<DatosEmpresa>) => actualizar({ empresa: { ...empresa, ...parcial } })

  const cif = empresa.cif.trim()
  const avisoCif = cif !== '' && !validarNifCif(cif).valido ? 'El CIF no supera la validación; revísalo.' : undefined

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const lector = new FileReader()
    lector.onload = () => set({ logoDataUrl: String(lector.result) })
    lector.readAsDataURL(f)
  }

  const anios = Array.from({ length: 8 }, (_, i) => 2023 + i)

  return (
    <div className="max-w-2xl space-y-6">
      <Tarjeta>
        <h3 className="font-semibold mb-4">Datos fiscales</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Campo etiqueta="Razón social" valor={empresa.razonSocial} onChange={(v) => set({ razonSocial: v })} placeholder="Mi Empresa, S.L.U." autoFocus />
          </div>
          <Campo etiqueta="CIF / NIF" valor={empresa.cif} onChange={(v) => set({ cif: v.toUpperCase() })} placeholder="B12345678" aviso={avisoCif} />
          <Select
            etiqueta="Ejercicio contable actual"
            valor={String(empresa.ejercicioActual)}
            onChange={(v) => set({ ejercicioActual: Number(v) })}
            opciones={anios.map((a) => ({ valor: String(a), texto: String(a) }))}
          />
          <div className="sm:col-span-2">
            <Campo etiqueta="Domicilio fiscal" valor={empresa.domicilioFiscal} onChange={(v) => set({ domicilioFiscal: v })} placeholder="Calle, nº, CP, población" />
          </div>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h3 className="font-semibold mb-4">Logotipo</h3>
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center w-20 h-20 rounded-xl overflow-hidden shrink-0"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            {empresa.logoDataUrl ? (
              <img src={empresa.logoDataUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="inline-flex">
              <span className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium cursor-pointer" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                Subir imagen
                <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
              </span>
            </label>
            {empresa.logoDataUrl && (
              <button className="text-xs text-left" style={{ color: 'var(--neg)' }} onClick={() => set({ logoDataUrl: undefined })}>
                Quitar logo
              </button>
            )}
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Se usará en el informe ejecutivo en PDF.</span>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h3 className="font-semibold mb-4">Estructura de grupo</h3>
        <Toggle etiqueta="Es filial de una sociedad holding" valor={empresa.esFilial} onChange={(v) => set({ esFilial: v })} />
        {empresa.esFilial && (
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <Campo etiqueta="Nombre de la matriz" valor={empresa.matrizNombre ?? ''} onChange={(v) => set({ matrizNombre: v })} />
            <Campo etiqueta="CIF de la matriz" valor={empresa.matrizCif ?? ''} onChange={(v) => set({ matrizCif: v.toUpperCase() })} />
          </div>
        )}
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          Marca la estructura de grupo para poder señalar operaciones vinculadas y dividendos intragrupo.
        </p>
      </Tarjeta>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Los cambios se guardan automáticamente en este dispositivo.
      </p>
    </div>
  )
}
