/** Dashboard: fila de KPIs y estado inicial. En Fase 8 se llena de datos reales. */
import { Tarjeta, Esqueleto, EstadoVacio, Boton } from '../componentes/ui'
import { CabeceraPantalla } from './Pantalla'
import { navegar } from '../lib/router'
import { useStore } from '../store/store'

const KPIS = ['Tesorería total', 'Venta del mes', 'Margen bruto', 'Resultado del mes', 'Deuda total', 'Stock valorado']

export function Dashboard() {
  const empresa = useStore((s) => s.config.empresa)
  const configurada = empresa.razonSocial.trim() !== ''

  return (
    <>
      <CabeceraPantalla titulo="Dashboard" descripcion="¿Cómo va la empresa hoy?" />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {KPIS.map((k) => (
          <Tarjeta key={k} className="!p-4">
            <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              {k}
            </div>
            <Esqueleto className="h-6 w-24" />
          </Tarjeta>
        ))}
      </div>

      <Tarjeta>
        <EstadoVacio
          icono={configurada ? 'panel' : 'ajustes'}
          titulo={configurada ? 'Aún no hay movimientos que mostrar' : 'Empieza configurando tu empresa'}
          descripcion={
            configurada
              ? 'En cuanto registres ventas, compras y saldos, aquí verás la evolución de tesorería, las ventas por canal y el centro de alertas. (Fase 8)'
              : 'Introduce los datos de tu sociedad, tus puntos de venta y tus impuestos. Todo lo demás se construye a partir de ahí.'
          }
          accion={
            !configurada && <Boton onClick={() => navegar('/configuracion')}>Ir a Configuración</Boton>
          }
        />
      </Tarjeta>
    </>
  )
}
