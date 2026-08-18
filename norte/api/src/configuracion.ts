import { z } from 'zod'

/**
 * La configuración se lee una vez, al arrancar, y si algo falta el servidor
 * **no arranca**. Es a propósito: un servidor que arranca a medias con un
 * secreto vacío es mucho peor que uno que no arranca y dice por qué.
 */

const SECRETO_MINIMO = 32

const esquema = z.object({
  DATABASE_URL: z.string().optional(),
  // Alternativa por piezas a DATABASE_URL. Existe porque **una contraseña
  // dentro de una URL hay que escaparla**: Umbrel genera la contraseña de la
  // app por su cuenta, y en cuanto trae una `@`, una `/` o unos `:` la cadena
  // de conexión se parte y el servidor no arranca. Aquí se recibe cruda y se
  // codifica al construir la URL, que es lo único que no se puede hacer desde
  // un fichero de docker-compose.
  NORTE_BD_HOST: z.string().optional(),
  NORTE_BD_PUERTO: z.coerce.number().int().positive().default(5432),
  NORTE_BD_USUARIO: z.string().optional(),
  NORTE_BD_CONTRASENA: z.string().optional(),
  NORTE_BD_NOMBRE: z.string().optional(),
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
  const urlBaseDatos = componerUrl(datos)
  if (!urlBaseDatos) {
    throw new ErrorConfiguracion(
      'No se puede arrancar Norte:\n· Falta la conexión a PostgreSQL. Define DATABASE_URL, ' +
        'o bien NORTE_BD_HOST, NORTE_BD_USUARIO, NORTE_BD_CONTRASENA y NORTE_BD_NOMBRE.',
    )
  }

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
    urlBaseDatos,
    secretoSesion: datos.NORTE_SECRETO_SESION,
    puerto: datos.NORTE_PUERTO,
    cookieSegura: datos.NORTE_COOKIE_SEGURA,
    datosDir: datos.NORTE_DATOS_DIR,
    entorno: datos.NODE_ENV,
  }
}

type DatosBd = {
  DATABASE_URL?: string | undefined
  NORTE_BD_HOST?: string | undefined
  NORTE_BD_PUERTO: number
  NORTE_BD_USUARIO?: string | undefined
  NORTE_BD_CONTRASENA?: string | undefined
  NORTE_BD_NOMBRE?: string | undefined
}

/**
 * `DATABASE_URL` manda si viene. Si no, se compone a partir de las piezas
 * **escapando usuario y contraseña**, que es justo lo que no puede hacer un
 * docker-compose y lo que rompe la conexión cuando la contraseña trae un
 * carácter con significado dentro de una URL.
 */
export function componerUrl(datos: DatosBd): string | null {
  if (datos.DATABASE_URL) return datos.DATABASE_URL
  const { NORTE_BD_HOST: host, NORTE_BD_USUARIO: usuario, NORTE_BD_NOMBRE: nombre } = datos
  if (!host || !usuario || !nombre) return null

  const clave = datos.NORTE_BD_CONTRASENA ? `:${encodeURIComponent(datos.NORTE_BD_CONTRASENA)}` : ''
  return `postgresql://${encodeURIComponent(usuario)}${clave}@${host}:${datos.NORTE_BD_PUERTO}/${encodeURIComponent(nombre)}`
}
