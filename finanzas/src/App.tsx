import { Suspense, lazy } from 'react'
import { Layout } from './componentes/Layout'
import { Esqueleto } from './componentes/ui'
import { useRuta } from './lib/router'
import { moduloPorRuta } from './lib/modulos'
import { useStore } from './store/store'
import { Configuracion } from './pantallas/Configuracion'
import { Ventas } from './pantallas/Ventas'
import { Compras } from './pantallas/Compras'
import { Caja } from './pantallas/Caja'
import { Bancos } from './pantallas/Bancos'
import { Stock } from './pantallas/Stock'
import { Importacion } from './pantallas/Importacion'
import { Deudas } from './pantallas/Deudas'
import { Deudores } from './pantallas/Deudores'
import { Presupuesto } from './pantallas/Presupuesto'
import { Informes } from './pantallas/Informes'
import { Copias } from './pantallas/Copias'
import { Grupo } from './pantallas/Grupo'
import { PantallaModulo } from './pantallas/Pantalla'

// Carga diferida: dashboard y previsión usan Recharts, que no debe pesar en el arranque.
const Dashboard = lazy(() => import('./pantallas/Dashboard').then((m) => ({ default: m.Dashboard })))
const Tesoreria = lazy(() => import('./pantallas/Tesoreria').then((m) => ({ default: m.Tesoreria })))

function Contenido() {
  const ruta = useRuta()
  const modulo = moduloPorRuta(ruta)

  if (!modulo) {
    return <div className="p-8">Página no encontrada. <a href="#/" className="underline">Volver al inicio</a></div>
  }
  if (modulo.id === 'dashboard') return <Suspense fallback={<Esqueleto className="h-64 w-full" />}><Dashboard /></Suspense>
  if (modulo.id === 'configuracion') return <Configuracion />
  if (modulo.id === 'ventas') return <Ventas />
  if (modulo.id === 'compras') return <Compras />
  if (modulo.id === 'caja') return <Caja />
  if (modulo.id === 'bancos') return <Bancos />
  if (modulo.id === 'stock') return <Stock />
  if (modulo.id === 'importacion') return <Importacion />
  if (modulo.id === 'deudas') return <Deudas />
  if (modulo.id === 'deudores') return <Deudores />
  if (modulo.id === 'presupuesto') return <Presupuesto />
  if (modulo.id === 'tesoreria') return <Suspense fallback={<Esqueleto className="h-64 w-full" />}><Tesoreria /></Suspense>
  if (modulo.id === 'informes') return <Informes />
  if (modulo.id === 'copias') return <Copias />
  if (modulo.id === 'grupo') return <Grupo />
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
