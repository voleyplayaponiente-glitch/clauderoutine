import { z } from 'zod'

/**
 * La configuración se lee una vez, al arrancar, y si algo falta el servidor
 * **no arranca**. Es a propósito: un servidor que arranca a medias con un
 * secreto vacío es mucho peor que uno que no arranca y dice por qué.
 */

const SECRETO_MINIMO = 32

const esquema = z.object({
  DATABASE_URL: z.string().min(1, 'Falta DATABASE_URL (la cadena de conexión de PostgreSQL).'),
  NORTE_SECRETO_SESION: z
    .string()
    .min(SECRETO_MINIMO, `NORTE_SECRETO_SESION necesita al menos ${SECRETO_MINIMO} caracteres.`),
  NORTE_PUERTO: z.coerce.number().int().positive().default(3012),
  NORTE_COOKIE_SEGURA: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  NORTE_DATOS_DIR: z.string().default('./datos'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export interface Configuracion {
  urlBaseDatos: string
  secretoSesion: string
  puerto: number
  cookieSegura: boolean
  datosDir: string
  entorno: 'development' | 'test' | 'production'
}

export class ErrorConfiguracion extends Error {}

export function leerConfiguracion(env: NodeJS.ProcessEnv = process.env): Configuracion {
  const resultado = esquema.safeParse(env)
  if (!resultado.success) {
    const problemas = resultado.error.issues.map((i) => `· ${i.message}`).join('\n')
    throw new ErrorConfiguracion(`No se puede arrancar Norte:\n${problemas}`)
  }
  const datos = resultado.data

  // En producción, una cookie sin `secure` viaja en claro. No se puede exigir
  // siempre —el Umbrel sirve por http:// en la red de casa, que es justamente
  // el caso de uso— pero sí avisar en voz alta.
  if (datos.NODE_ENV === 'production' && !datos.NORTE_COOKIE_SEGURA) {
    console.warn(
      '[norte] Aviso: NORTE_COOKIE_SEGURA=false. Correcto si sirves por http en tu red local ' +
        '(Umbrel); peligroso si Norte está expuesto a internet.',
    )
  }

  return {
    urlBaseDatos: datos.DATABASE_URL,
    secretoSesion: datos.NORTE_SECRETO_SESION,
    puerto: datos.NORTE_PUERTO,
    cookieSegura: datos.NORTE_COOKIE_SEGURA,
    datosDir: datos.NORTE_DATOS_DIR,
    entorno: datos.NODE_ENV,
  }
}
