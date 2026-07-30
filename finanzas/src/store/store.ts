/**
 * Estado global (Zustand) + persistencia en IndexedDB con debounce.
 * En la Fase 0 gestiona configuración y tema; los módulos operativos irán
 * añadiendo su porción de estado fase a fase.
 */
import { create } from 'zustand'
import type { Configuracion } from '../dominio/tipos'
import { configuracionInicial } from '../dominio/defaults'
import { cargarConfig, guardarConfig, cargarTema, guardarTema } from '../lib/db'

type Tema = 'claro' | 'oscuro'

interface Estado {
  loaded: boolean
  tema: Tema
  config: Configuracion
  init: () => Promise<void>
  alternarTema: () => void
  actualizarConfig: (parcial: Partial<Configuracion>) => void
  reemplazarConfig: (config: Configuracion) => void
}

let debounce: ReturnType<typeof setTimeout> | undefined
function persistirConDebounce(config: Configuracion) {
  clearTimeout(debounce)
  debounce = setTimeout(() => void guardarConfig(config), 400)
}

export const useStore = create<Estado>((set, get) => ({
  loaded: false,
  tema: 'claro',
  config: configuracionInicial(),

  init: async () => {
    const [config, tema] = await Promise.all([cargarConfig(), cargarTema()])
    set({
      config: config ?? configuracionInicial(),
      tema: tema ?? (prefiereOscuro() ? 'oscuro' : 'claro'),
      loaded: true,
    })
    // Si no había nada guardado, deja la config inicial persistida.
    if (!config) void guardarConfig(get().config)
  },

  alternarTema: () => {
    const tema: Tema = get().tema === 'oscuro' ? 'claro' : 'oscuro'
    set({ tema })
    void guardarTema(tema)
  },

  actualizarConfig: (parcial) => {
    const config = { ...get().config, ...parcial }
    set({ config })
    persistirConDebounce(config)
  },

  reemplazarConfig: (config) => {
    set({ config })
    persistirConDebounce(config)
  },
}))

function prefiereOscuro(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}
