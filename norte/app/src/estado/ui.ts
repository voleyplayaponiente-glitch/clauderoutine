import { create } from 'zustand'

/**
 * Estado de interfaz, y solo de interfaz: qué espacio se está mirando y si el
 * tema es claro u oscuro. Los datos del dominio viven en TanStack Query, no
 * aquí; mezclarlos es cómo se acaba con dos copias de la verdad.
 */

export type Tema = 'claro' | 'oscuro' | 'sistema'

const CLAVE_TEMA = 'norte:tema'
const CLAVE_ESPACIO = 'norte:espacio'

function temaGuardado(): Tema {
  const valor = localStorage.getItem(CLAVE_TEMA)
  return valor === 'claro' || valor === 'oscuro' ? valor : 'sistema'
}

export function aplicarTema(tema: Tema): void {
  const oscuro =
    tema === 'oscuro' ||
    (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('oscuro', oscuro)
  document.documentElement.style.colorScheme = oscuro ? 'dark' : 'light'
}

interface EstadoUi {
  tema: Tema
  espacioId: string | null
  cambiarTema: (tema: Tema) => void
  elegirEspacio: (id: string) => void
}

export const useUi = create<EstadoUi>((set) => ({
  tema: temaGuardado(),
  espacioId: localStorage.getItem(CLAVE_ESPACIO),

  cambiarTema: (tema) => {
    localStorage.setItem(CLAVE_TEMA, tema)
    aplicarTema(tema)
    set({ tema })
  },

  elegirEspacio: (id) => {
    localStorage.setItem(CLAVE_ESPACIO, id)
    set({ espacioId: id })
  },
}))
