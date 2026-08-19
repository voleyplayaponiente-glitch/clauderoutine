import { componerUrl } from './configuracion.js'

/**
 * Imprime la cadena de conexión por la salida estándar.
 *
 * Existe por una razón muy concreta: el contenedor arranca `prisma migrate
 * deploy` **antes** que el servidor, y ese es otro programa que lee
 * `DATABASE_URL` del esquema por su cuenta. Pasarle la conexión por piezas no
 * le sirve, así que el arranque compone la URL con esto —la misma función
 * probada que usa el servidor, escapando la contraseña— y la exporta antes de
 * llamar a Prisma.
 *
 * Se descubrió instalando la app de verdad desde la tienda de Umbrel: la
 * migración fallaba con «Environment variable not found: DATABASE_URL» y el
 * contenedor entraba en bucle de reinicio.
 */
const url = componerUrl({
  DATABASE_URL: process.env.DATABASE_URL,
  NORTE_BD_HOST: process.env.NORTE_BD_HOST,
  NORTE_BD_PUERTO: Number(process.env.NORTE_BD_PUERTO ?? 5432),
  NORTE_BD_USUARIO: process.env.NORTE_BD_USUARIO,
  NORTE_BD_CONTRASENA: process.env.NORTE_BD_CONTRASENA,
  NORTE_BD_NOMBRE: process.env.NORTE_BD_NOMBRE,
})

if (!url) {
  console.error(
    'Falta la conexión a PostgreSQL. Define DATABASE_URL, o bien NORTE_BD_HOST, ' +
      'NORTE_BD_USUARIO, NORTE_BD_CONTRASENA y NORTE_BD_NOMBRE.',
  )
  process.exit(1)
}

process.stdout.write(url)
