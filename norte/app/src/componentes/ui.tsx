import { formatearDinero, type Centimos } from '@norte/dominio'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { useId, useState } from 'react'

/**
 * Los ladrillos de la interfaz. Uno solo de cada cosa: en cuanto hay dos
 * botones primarios distintos, la app deja de parecer una app.
 */

function unir(...clases: (string | false | null | undefined)[]): string {
  return clases.filter(Boolean).join(' ')
}

// ─────────────────────────────────────────────────────────────── Botón

type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro'

const ESTILO_BOTON: Record<VarianteBoton, string> = {
  primario: 'bg-marca text-white hover:brightness-110 active:brightness-95',
  secundario: 'bg-sup-3 text-texto-1 hover:brightness-105 active:brightness-95',
  fantasma: 'bg-transparent text-texto-2 hover:bg-sup-2 hover:text-texto-1',
  peligro: 'bg-negativo text-white hover:brightness-110 active:brightness-95',
}

export function Boton({
  variante = 'primario',
  tamano = 'normal',
  cargando = false,
  className,
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBoton
  tamano?: 'normal' | 'pequeno'
  cargando?: boolean
}) {
  return (
    <button
      {...resto}
      disabled={resto.disabled || cargando}
      className={unir(
        'inline-flex items-center justify-center gap-2 rounded-campo font-medium',
        'transition-[filter,background-color,opacity] duration-200',
        'disabled:cursor-not-allowed disabled:opacity-45',
        tamano === 'pequeno' ? 'h-8 px-3 text-sm' : 'h-11 px-5 text-[0.95rem]',
        ESTILO_BOTON[variante],
        className,
      )}
    >
      {cargando && (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────── Campo

export function Campo({
  etiqueta,
  ayuda,
  error,
  className,
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string
  ayuda?: string
  error?: string
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-texto-2">
        {etiqueta}
      </label>
      <input
        {...resto}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error || ayuda ? `${id}-nota` : undefined}
        className={unir(
          'h-11 rounded-campo bg-sup-2 px-3.5 text-texto-1 placeholder:text-texto-3',
          'border border-linea transition-colors duration-200',
          'focus:border-marca focus:outline-none focus-visible:outline-none',
          error && 'border-negativo',
          className,
        )}
      />
      {(error || ayuda) && (
        <p id={`${id}-nota`} className={unir('text-sm', error ? 'text-negativo' : 'text-texto-3')}>
          {error ?? ayuda}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────── Superficies

export function Tarjeta({
  children,
  className,
  titulo,
  accion,
}: {
  children: ReactNode
  className?: string
  titulo?: string
  accion?: ReactNode
}) {
  return (
    <section
      className={unir(
        'rounded-tarjeta bg-sup-1 p-5 shadow-contacto',
        // La elevación se hace con luz, no con un borde blanco translúcido.
        'ring-1 ring-linea/60',
        className,
      )}
    >
      {(titulo || accion) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {titulo && (
            <h3 className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-texto-3">
              {titulo}
            </h3>
          )}
          {accion}
        </header>
      )}
      {children}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────── Cifras

export function Cifra({
  centimos,
  tamano = 'normal',
  colorear = false,
  conSigno = false,
  divisa,
}: {
  centimos: Centimos
  tamano?: 'heroe' | 'grande' | 'normal' | 'pequena'
  /** El color solo cuando el signo es información, no en todos los importes. */
  colorear?: boolean
  conSigno?: boolean
  divisa?: string
}) {
  const clasesTamano = {
    heroe: 'cifra-heroe text-5xl font-semibold sm:text-6xl',
    grande: 'cifra-heroe text-3xl font-semibold',
    normal: 'cifra text-base',
    pequena: 'cifra text-sm',
  }[tamano]

  const color = !colorear
    ? 'text-texto-1'
    : centimos > 0
      ? 'text-positivo'
      : centimos < 0
        ? 'text-negativo'
        : 'text-texto-2'

  return (
    <span className={unir(clasesTamano, color)}>
      {formatearDinero(centimos, { conSigno, ...(divisa ? { divisa } : {}) })}
    </span>
  )
}

// ─────────────────────────────────────────────── KPI con semáforo explicado

export type Semaforo = 'verde' | 'ambar' | 'rojo'

const PUNTO: Record<Semaforo, string> = {
  verde: 'bg-positivo',
  ambar: 'bg-aviso',
  rojo: 'bg-negativo',
}

/**
 * Un indicador con semáforo **siempre** lleva su umbral a mano. Un punto rojo
 * sin explicación no informa: solo inquieta.
 */
export function Kpi({
  nombre,
  valor,
  semaforo,
  umbral,
}: {
  nombre: string
  valor: string
  semaforo: Semaforo
  umbral: string
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div
      className="group relative flex flex-col gap-1 rounded-tarjeta bg-sup-2 p-4"
      onMouseEnter={() => setAbierto(true)}
      onMouseLeave={() => setAbierto(false)}
    >
      <div className="flex items-center gap-2">
        <span className={unir('size-2 rounded-full', PUNTO[semaforo])} aria-hidden />
        <span className="text-sm text-texto-2">{nombre}</span>
        <button
          type="button"
          aria-label={`Qué significa: ${nombre}`}
          aria-expanded={abierto}
          onClick={() => setAbierto((v) => !v)}
          onFocus={() => setAbierto(true)}
          onBlur={() => setAbierto(false)}
          className="ml-auto size-5 rounded-full text-xs text-texto-3 ring-1 ring-linea hover:text-texto-1"
        >
          ?
        </button>
      </div>
      <span className="cifra text-2xl font-semibold">{valor}</span>
      {abierto && (
        <p className="animar-entrada absolute left-4 right-4 top-full z-10 mt-1 rounded-campo bg-sup-3 p-3 text-xs leading-relaxed text-texto-2 shadow-ambiental">
          {umbral}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────── Progreso de un sobre

/**
 * La barra del presupuesto lleva una marca con el día del mes transcurrido: sin
 * ella, «llevas gastado el 60 %» no dice nada. Con ella, se ve de un vistazo si
 * el gasto va por delante del calendario.
 */
export function BarraSobre({
  gastado,
  asignado,
  porcentajeDelMes,
}: {
  gastado: Centimos
  asignado: Centimos
  porcentajeDelMes?: number
}) {
  const proporcion = asignado > 0 ? Math.min(gastado / asignado, 1.35) : 0
  const pasado = asignado > 0 && gastado > asignado
  const adelantado = porcentajeDelMes !== undefined && proporcion * 100 > porcentajeDelMes + 5

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-2 overflow-hidden rounded-full bg-sup-3">
        <div
          className={unir(
            'h-full rounded-full transition-[width] duration-500',
            pasado ? 'bg-negativo' : adelantado ? 'bg-aviso' : 'bg-marca',
          )}
          style={{ width: `${Math.min(proporcion * 100, 100)}%` }}
        />
        {porcentajeDelMes !== undefined && (
          <span
            className="absolute top-0 h-full w-px bg-texto-1/45"
            style={{ left: `${Math.min(porcentajeDelMes, 100)}%` }}
            aria-hidden
          />
        )}
      </div>
      <div className="flex justify-between text-sm text-texto-2">
        <Cifra centimos={gastado} tamano="pequena" />
        <span className="cifra text-sm text-texto-3">
          de {formatearDinero(asignado, { sinDecimales: true })}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────── Estados

/** Nunca un spinner centrado: un esqueleto dice qué va a aparecer y dónde. */
export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      className={unir('rounded-campo bg-sup-3', className)}
      style={{ animation: 'latido 1.6s ease-in-out infinite' }}
      aria-hidden
    />
  )
}

export function EstadoVacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string
  texto: string
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-tarjeta bg-sup-2 px-6 py-10 text-center">
      <h3 className="text-lg font-semibold">{titulo}</h3>
      {/* Un vacío que solo dice «no hay nada» es una pantalla desperdiciada:
          este dice qué hacer para llenarla. */}
      <p className="max-w-sm text-sm leading-relaxed text-texto-2">{texto}</p>
      {accion}
    </div>
  )
}

export function Aviso({
  tono = 'info',
  titulo,
  children,
}: {
  tono?: 'info' | 'atencion' | 'error'
  titulo?: string
  children: ReactNode
}) {
  const estilo = {
    info: 'bg-marca-tenue text-texto-1',
    atencion: 'bg-aviso/12 text-texto-1',
    error: 'bg-negativo/12 text-texto-1',
  }[tono]
  const barra = { info: 'bg-marca', atencion: 'bg-aviso', error: 'bg-negativo' }[tono]

  return (
    <div
      role={tono === 'error' ? 'alert' : undefined}
      className={unir('flex gap-3 overflow-hidden rounded-campo p-3.5 text-sm', estilo)}
    >
      <span className={unir('w-1 shrink-0 rounded-full', barra)} aria-hidden />
      <div className="flex flex-col gap-1">
        {titulo && <strong className="font-semibold">{titulo}</strong>}
        <div className="leading-relaxed text-texto-2">{children}</div>
      </div>
    </div>
  )
}

export function Etiqueta({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'marca' }) {
  return (
    <span
      className={unir(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        tono === 'marca' ? 'bg-marca-tenue text-marca' : 'bg-sup-3 text-texto-2',
      )}
    >
      {children}
    </span>
  )
}
