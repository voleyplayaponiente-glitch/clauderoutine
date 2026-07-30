import { Layout } from './componentes/Layout'
import { Esqueleto } from './componentes/ui'
import { useRuta } from './lib/router'
import { moduloPorRuta } from './lib/modulos'
import { useStore } from './store/store'
import { Dashboard } from './pantallas/Dashboard'
import { PantallaModulo } from './pantallas/Pantalla'

function Contenido() {
  const ruta = useRuta()
  const modulo = moduloPorRuta(ruta)

  if (!modulo) {
    return <div className="p-8">Página no encontrada. <a href="#/" className="underline">Volver al inicio</a></div>
  }
  if (modulo.id === 'dashboard') return <Dashboard />
  return <PantallaModulo modulo={modulo} />
}

export default function App() {
  const loaded = useStore((s) => s.loaded)

  return (
    <Layout>
      {loaded ? (
        <Contenido />
      ) : (
        <div className="max-w-3xl space-y-3">
          <Esqueleto className="h-8 w-64" />
          <Esqueleto className="h-40 w-full" />
        </div>
      )}
    </Layout>
  )
}
