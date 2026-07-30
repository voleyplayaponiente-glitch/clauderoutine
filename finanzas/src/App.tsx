import { Layout } from './componentes/Layout'
import { Esqueleto } from './componentes/ui'
import { useRuta } from './lib/router'
import { moduloPorRuta } from './lib/modulos'
import { useStore } from './store/store'
import { Dashboard } from './pantallas/Dashboard'
import { Configuracion } from './pantallas/Configuracion'
import { Ventas } from './pantallas/Ventas'
import { Compras } from './pantallas/Compras'
import { Caja } from './pantallas/Caja'
import { Bancos } from './pantallas/Bancos'
import { Stock } from './pantallas/Stock'
import { Importacion } from './pantallas/Importacion'
import { Deudas } from './pantallas/Deudas'
import { Deudores } from './pantallas/Deudores'
import { PantallaModulo } from './pantallas/Pantalla'

function Contenido() {
  const ruta = useRuta()
  const modulo = moduloPorRuta(ruta)

  if (!modulo) {
    return <div className="p-8">Página no encontrada. <a href="#/" className="underline">Volver al inicio</a></div>
  }
  if (modulo.id === 'dashboard') return <Dashboard />
  if (modulo.id === 'configuracion') return <Configuracion />
  if (modulo.id === 'ventas') return <Ventas />
  if (modulo.id === 'compras') return <Compras />
  if (modulo.id === 'caja') return <Caja />
  if (modulo.id === 'bancos') return <Bancos />
  if (modulo.id === 'stock') return <Stock />
  if (modulo.id === 'importacion') return <Importacion />
  if (modulo.id === 'deudas') return <Deudas />
  if (modulo.id === 'deudores') return <Deudores />
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
