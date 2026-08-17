import { formatearDinero } from '@norte/dominio'
import {
  Aviso,
  BarraSobre,
  Boton,
  Campo,
  Cifra,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Kpi,
  Tarjeta,
} from '../componentes/ui.js'

/**
 * Muestrario del sistema de diseño.
 *
 * Está en la aplicación y no en un Storybook aparte a propósito: así se ve con
 * los tokens de verdad, en los dos temas, y cualquier cambio de paleta se nota
 * aquí antes de llegar a una pantalla que importe.
 */
export function Muestra() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">Sistema de diseño</h1>
        <p className="max-w-2xl leading-relaxed text-texto-2">
          Los ladrillos con los que se construye Norte. Cambia el tema arriba a la derecha: los dos
          están diseñados, no es uno el negativo del otro.
        </p>
      </header>

      <Seccion titulo="Color">
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-texto-2">
          Un acento para lo positivo, uno para lo negativo y uno de marca. El color se reserva para
          el dato; los adornos son grises.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Muestrario nombre="Marca" clase="bg-marca" />
          <Muestrario nombre="Positivo" clase="bg-positivo" />
          <Muestrario nombre="Negativo" clase="bg-negativo" />
          <Muestrario nombre="Aviso" clase="bg-aviso" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Muestrario nombre="Fondo" clase="bg-fondo ring-1 ring-linea" />
          <Muestrario nombre="Superficie 1" clase="bg-sup-1 ring-1 ring-linea" />
          <Muestrario nombre="Superficie 2" clase="bg-sup-2 ring-1 ring-linea" />
          <Muestrario nombre="Superficie 3" clase="bg-sup-3 ring-1 ring-linea" />
        </div>
      </Seccion>

      <Seccion titulo="Tipografía y cifras">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.08em] text-texto-3">Cifra héroe</span>
            <Cifra centimos={4823741} tamano="heroe" />
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.08em] text-texto-3">Variación</span>
              <Cifra centimos={128400} tamano="grande" colorear conSigno />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.08em] text-texto-3">Negativa</span>
              <Cifra centimos={-34250} tamano="grande" colorear conSigno />
            </div>
          </div>
          <div className="rounded-tarjeta bg-sup-2 p-4">
            <p className="mb-2 text-sm text-texto-2">
              Todas las cifras van en tabulares: en columna, no bailan.
            </p>
            <ul className="flex flex-col gap-1 text-right">
              {[111111, 4823741, 90055, 1234567].map((c) => (
                <li key={c} className="cifra text-base">
                  {formatearDinero(c)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Botones y campos">
        <div className="flex flex-wrap items-center gap-3">
          <Boton>Guardar</Boton>
          <Boton variante="secundario">Cancelar</Boton>
          <Boton variante="fantasma">Ver detalle</Boton>
          <Boton variante="peligro">Borrar</Boton>
          <Boton cargando>Guardando</Boton>
          <Boton disabled>No disponible</Boton>
          <Boton tamano="pequeno" variante="secundario">
            Pequeño
          </Boton>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Concepto" placeholder="Café" />
          <Campo
            etiqueta="Importe"
            placeholder="3,40"
            error="Escribe un importe, por ejemplo 3,40."
          />
        </div>
      </Seccion>

      <Seccion titulo="Indicadores de salud">
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi
            nombre="Tasa de ahorro"
            valor="23 %"
            semaforo="verde"
            umbral="Verde a partir del 20 %. Ámbar entre el 10 % y el 20 %. Rojo por debajo del 10 %."
          />
          <Kpi
            nombre="Endeudamiento"
            valor="34 %"
            semaforo="ambar"
            umbral="Cuotas de deuda sobre ingresos netos. Verde por debajo del 30 %, rojo por encima del 40 %."
          />
          <Kpi
            nombre="Colchón"
            valor="2,1 meses"
            semaforo="rojo"
            umbral="Activos líquidos entre gastos fijos mensuales. Verde a partir de 6 meses, rojo por debajo de 3."
          />
        </div>
      </Seccion>

      <Seccion titulo="Sobres del presupuesto">
        <div className="grid gap-5 sm:grid-cols-2">
          <Tarjeta titulo="Alimentación">
            <BarraSobre gastado={28400} asignado={45000} porcentajeDelMes={62} />
          </Tarjeta>
          <Tarjeta titulo="Ocio">
            <BarraSobre gastado={19800} asignado={20000} porcentajeDelMes={62} />
          </Tarjeta>
          <Tarjeta titulo="Restaurantes">
            <BarraSobre gastado={24500} asignado={18000} porcentajeDelMes={62} />
          </Tarjeta>
          <Tarjeta titulo="Transporte">
            <BarraSobre gastado={6100} asignado={22000} porcentajeDelMes={62} />
          </Tarjeta>
        </div>
        <p className="mt-3 text-sm text-texto-3">
          La línea vertical marca el día del mes. Si la barra la pasa, el gasto va por delante del
          calendario.
        </p>
      </Seccion>

      <Seccion titulo="Avisos">
        <div className="flex flex-col gap-3">
          <Aviso titulo="Nómina de julio leída">
            Se han detectado 1.842,30 € netos. Revisa el desglose antes de aplicarlo.
          </Aviso>
          <Aviso tono="atencion" titulo="Vas a quedarte corto el día 22">
            Con los recibos previstos, el saldo baja a 41,20 €. Puedes mover el cargo de la tarjeta
            al día 28.
          </Aviso>
          <Aviso tono="error" titulo="No se ha podido leer el fichero">
            El PDF parece un extracto de otra entidad. Prueba a descargarlo en formato N43 o dinos
            qué banco es.
          </Aviso>
        </div>
      </Seccion>

      <Seccion titulo="Estados de carga y vacío">
        <div className="grid gap-5 sm:grid-cols-2">
          <Tarjeta titulo="Cargando">
            <div className="flex flex-col gap-3">
              <Esqueleto className="h-9 w-2/3" />
              <Esqueleto className="h-4 w-full" />
              <Esqueleto className="h-4 w-4/5" />
            </div>
          </Tarjeta>
          <EstadoVacio
            titulo="Aún no hay movimientos"
            texto="Sube un extracto del banco o apunta el primer gasto. Con dos semanas de datos ya se puede presupuestar."
            accion={<Boton tamano="pequeno">Subir un extracto</Boton>}
          />
        </div>
      </Seccion>

      <Seccion titulo="Etiquetas">
        <div className="flex flex-wrap gap-2">
          <Etiqueta>Fijo</Etiqueta>
          <Etiqueta>Esencial</Etiqueta>
          <Etiqueta tono="marca">Compartido</Etiqueta>
          <Etiqueta>Previsto</Etiqueta>
        </div>
      </Seccion>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-texto-3">
        {titulo}
      </h2>
      <div className="rounded-panel bg-sup-1 p-5 ring-1 ring-linea/60">{children}</div>
    </section>
  )
}

function Muestrario({ nombre, clase }: { nombre: string; clase: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`h-14 rounded-campo ${clase}`} />
      <span className="text-xs text-texto-3">{nombre}</span>
    </div>
  )
}
