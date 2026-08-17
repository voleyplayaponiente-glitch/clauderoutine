import type { EspacioResumen } from '../lib/api.js'
import { ir } from '../lib/router.js'
import { Aviso, Boton, EstadoVacio, Etiqueta, Tarjeta } from '../componentes/ui.js'

/**
 * Pantalla de inicio de la fase 1.
 *
 * El bento completo con el patrimonio neto es la fase 6; poner aquí un
 * dashboard con cifras inventadas sería enseñar una maqueta y llamarla app. Lo
 * que sí hace ya es lo de esta fase: decir en qué espacio estás, con qué papel,
 * y qué falta para que esto sirva de algo.
 */
export function Inicio({ espacio }: { espacio: EspacioResumen | undefined }) {
  if (!espacio) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <EstadoVacio
          titulo="No tienes ningún espacio"
          texto="Un espacio es un ámbito financiero: el tuyo, el de la pareja o el del negocio. Crea el primero para empezar."
          accion={<Boton>Crear un espacio</Boton>}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">{espacio.nombre}</h1>
          <Etiqueta tono="marca">{nombreTipo(espacio.tipo)}</Etiqueta>
          <Etiqueta>{nombreRol(espacio.rol)}</Etiqueta>
        </div>
        <p className="text-texto-2">Aquí vivirá tu cuadro completo. De momento, los cimientos.</p>
      </header>

      <Aviso titulo="Fase 1 de 9: cimientos">
        Están puestos el esquema de datos completo, las cuentas de usuario, el aislamiento entre
        espacios —con sus tests— y el sistema de diseño. Lo siguiente son las cuentas y los
        movimientos, y después la lectura de nóminas y extractos.
      </Aviso>

      <div className="grid gap-5 sm:grid-cols-2">
        <Tarjeta titulo="Tus datos, en tu servidor">
          <p className="text-sm leading-relaxed text-texto-2">
            Norte guarda en PostgreSQL, dentro de tu Umbrel. Limpiar el navegador, cambiar de móvil
            o entrar desde otro equipo ya no pierde nada: esto es lo que arregla el problema de
            siempre.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Sistema de diseño">
          <p className="mb-4 text-sm leading-relaxed text-texto-2">
            Los componentes con los que se construye todo lo demás, en los dos temas.
          </p>
          <Boton variante="secundario" tamano="pequeno" onClick={() => ir('/muestra')}>
            Ver el muestrario
          </Boton>
        </Tarjeta>
      </div>
    </div>
  )
}

function nombreTipo(tipo: EspacioResumen['tipo']): string {
  return { personal: 'Personal', pareja: 'Pareja', negocio: 'Negocio' }[tipo]
}

function nombreRol(rol: EspacioResumen['rol']): string {
  return { propietario: 'Propietario', editor: 'Editor', lector: 'Solo lectura' }[rol]
}
