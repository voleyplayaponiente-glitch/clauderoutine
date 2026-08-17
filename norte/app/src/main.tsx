import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { aplicarTema, useUi } from './estado/ui.js'
import './index.css'

// El tema se aplica antes de pintar para que no haya un destello blanco al
// arrancar en modo oscuro.
aplicarTema(useUi.getState().tema)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useUi.getState().tema === 'sistema') aplicarTema('sistema')
})

const clientes = new QueryClient({
  defaultOptions: {
    queries: {
      // Toda interacción es optimista y la app se usa a diario: no tiene sentido
      // volver a pedirlo todo cada vez que se cambia de pestaña.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={clientes}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
