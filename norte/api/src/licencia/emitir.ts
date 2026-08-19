import { createPrivateKey, generateKeyPairSync } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { PLANES, type CargaLicencia, type PlanLicencia } from '@norte/dominio'
import { firmarClave } from './clave.js'

/**
 * Herramienta para emitir licencias. **No forma parte del servidor**: se
 * ejecuta a mano en la máquina de quien vende, que es donde vive la clave
 * privada. Por eso está aquí y no en una ruta: una ruta que firma licencias es
 * una ruta que, si alguien la alcanza, emite licencias gratis.
 *
 *   npm run licencia -- claves                       (crea el par de claves)
 *   npm run licencia -- emitir --titular "Ana" --plan pareja --meses 12
 */

const CUPO_POR_PLAN: Record<PlanLicencia, number> = {
  prueba: 2,
  personal: 1,
  pareja: 2,
  negocio: 10,
}

function leerArgumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

function sumarMeses(meses: number): string {
  const fecha = new Date()
  fecha.setUTCMonth(fecha.getUTCMonth() + meses)
  return fecha.toISOString().slice(0, 10)
}

function crearClaves() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const spki = publicKey.export({ type: 'spki', format: 'der' })
  const publica = spki.subarray(spki.length - 32).toString('base64url')
  const ruta = leerArgumento('salida') ?? 'norte-licencias.privada.pem'

  writeFileSync(ruta, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), {
    mode: 0o600,
  })

  console.log(`Clave privada escrita en ${ruta}. GUÁRDALA: sin ella no puedes emitir más`)
  console.log('licencias, y quien la tenga puede emitirlas por ti.\n')
  console.log('Pon esta clave pública en la instalación (o en NORTE_CLAVE_LICENCIAS):')
  console.log(`  ${publica}`)
}

function emitir() {
  const titular = leerArgumento('titular')
  if (!titular) {
    console.error('Falta --titular "Nombre de quien compra".')
    process.exit(1)
  }
  const plan = (leerArgumento('plan') ?? 'personal') as PlanLicencia
  if (!PLANES.includes(plan)) {
    console.error(`Plan desconocido. Los que hay: ${PLANES.join(', ')}.`)
    process.exit(1)
  }

  const meses = Number(leerArgumento('meses') ?? '12')
  const perpetua = leerArgumento('perpetua') !== undefined || meses === 0
  const carga: CargaLicencia = {
    id: `lic_${Date.now().toString(36)}`,
    plan,
    titular,
    email: leerArgumento('email'),
    emitidaEn: new Date().toISOString().slice(0, 10),
    caducaEn: perpetua ? null : sumarMeses(meses),
    maxUsuarios: Number(leerArgumento('usuarios') ?? CUPO_POR_PLAN[plan]),
  }

  const rutaPrivada = leerArgumento('clave') ?? 'norte-licencias.privada.pem'
  let privada
  try {
    privada = createPrivateKey(readFileSync(rutaPrivada, 'utf8'))
  } catch {
    console.error(`No se ha podido leer la clave privada en ${rutaPrivada}.`)
    console.error('Créala con:  npm run licencia -- claves')
    process.exit(1)
  }

  console.log(firmarClave(carga, privada))
  console.error(
    `\n(${carga.plan}, ${carga.maxUsuarios} usuarios, ` +
      `${carga.caducaEn ? `hasta ${carga.caducaEn}` : 'sin caducidad'})`,
  )
}

const orden = process.argv[2]
if (orden === 'claves') crearClaves()
else if (orden === 'emitir') emitir()
else {
  console.error('Uso:')
  console.error('  npm run licencia -- claves')
  console.error('  npm run licencia -- emitir --titular "Ana" --plan pareja --meses 12')
  process.exit(1)
}
