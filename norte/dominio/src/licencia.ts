/**
 * Licencia de uso de una instalación.
 *
 * Norte se vende para autoalojar, así que la licencia tiene que cumplir tres
 * cosas a la vez y ninguna es negociable:
 *
 *  1. **No llama a casa.** La clave va firmada (Ed25519) y el servidor la
 *     comprueba solo. Una aplicación de finanzas que necesita internet para
 *     dejarte entrar a tus propios datos no es autoalojada, es alquilada.
 *  2. **No secuestra nada.** Sin licencia, o con la licencia caducada, no se
 *     borra ni se oculta un solo dato: lo que se pierde es escribir, y solo
 *     para quien sobra del cupo. Leer y **exportar funcionan siempre**.
 *  3. **El dueño de la instalación no depende de nadie.** La primera cuenta
 *     —la única que puede crearse sin invitación— usa Norte entero y gratis,
 *     para siempre. La licencia paga **compartir**, que es justo lo que añade
 *     valor y lo que cuesta soportar.
 *
 * El punto 3 es una desviación deliberada del plan, que decía «sin licencia
 * válida, modo solo lectura» a secas. Tal cual, una licencia caducada dejaría
 * a alguien mirando sus propias cuentas sin poder apuntar un café, y en una
 * instalación casera eso es un rehén, no un cliente. Aquí lo que se cierra al
 * caducar es el cupo de personas, nunca la puerta.
 *
 * Y hay una cuarta regla, esta por decencia con quien ya estaba: **las
 * personas que ya usaban la instalación antes de que existiera el
 * licenciamiento no cuentan para el cupo, nunca.** Publicar una versión que le
 * quita la escritura a alguien que ayer la tenía es cambiarle el trato después
 * de firmarlo, aunque el trato nuevo sea razonable. `HEREDADOS_HASTA` es esa
 * frontera y no se toca: mover esa fecha hacia adelante convierte a clientes
 * antiguos en morosos de un día para otro.
 */

export type PlanLicencia = 'prueba' | 'personal' | 'pareja' | 'negocio'

export const PLANES: readonly PlanLicencia[] = ['prueba', 'personal', 'pareja', 'negocio'] as const

/** Lo que va firmado dentro de la clave. */
export interface CargaLicencia {
  id: string
  plan: PlanLicencia
  titular: string
  email?: string
  /** aaaa-mm-dd */
  emitidaEn: string
  /** aaaa-mm-dd, o `null` si es perpetua. */
  caducaEn: string | null
  maxUsuarios: number
}

/** Cuántas personas puede tener una instalación sin pagar nada. */
export const USUARIOS_GRATIS = 1

/**
 * Quien se dio de alta antes de esta fecha estaba usando Norte cuando no había
 * licencias. Se queda dentro para siempre. Ver la nota de arriba.
 */
export const HEREDADOS_HASTA = '2026-08-20'

/** Desde cuántos días antes se avisa de que toca renovar. */
export const DIAS_DE_AVISO = 30

export interface EstadoLicencia {
  /** Hay una clave firmada, válida y en vigor. */
  valida: boolean
  plan: PlanLicencia | null
  titular: string | null
  caducaEn: string | null
  /** Días que faltan para caducar; `null` si es perpetua o no hay licencia. */
  diasRestantes: number | null
  maxUsuarios: number
  usuariosActivos: number
  /** Cuántos vienen de antes del licenciamiento y no gastan cupo. */
  heredados: number
  /**
   * Quiénes pasan a solo lectura por no caber en el cupo. Son **los últimos en
   * entrar**, nunca el dueño: quitarle la escritura a quien montó la
   * instalación sería exactamente el secuestro que esto quiere evitar.
   */
  soloLectura: string[]
  salud: 'ok' | 'aviso' | 'mal'
  titulo: string
  detalle: string
}

export interface UsuarioDeInstalacion {
  id: string
  /** aaaa-mm-dd del alta. */
  creadoEn: string
}

export interface DatosDeLicencia {
  /**
   * Los miembros de la instalación, **del más antiguo al más nuevo**. El
   * primero es el dueño.
   */
  usuarios: UsuarioDeInstalacion[]
  ahora: Date
}

function comoDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

function diasEntre(desde: string, hasta: string): number {
  const uno = Date.parse(`${desde}T00:00:00.000Z`)
  const otro = Date.parse(`${hasta}T00:00:00.000Z`)
  return Math.round((otro - uno) / 86_400_000)
}

/**
 * Decide en qué estado está la instalación. La comprobación criptográfica se
 * hace fuera (necesita Node); aquí solo llega una carga **ya verificada**, o
 * `null` si no hay clave o la firma no cuadraba.
 */
export function decidirLicencia(
  carga: CargaLicencia | null,
  datos: DatosDeLicencia,
): EstadoLicencia {
  const hoy = comoDia(datos.ahora)
  const usuariosActivos = datos.usuarios.length
  const caducada = carga?.caducaEn != null && carga.caducaEn < hoy
  const valida = carga !== null && !caducada

  const maxUsuarios = valida ? Math.max(carga.maxUsuarios, USUARIOS_GRATIS) : USUARIOS_GRATIS

  // Los heredados no gastan cupo; el resto se lo reparte por orden de llegada.
  const nuevos = datos.usuarios.filter((usuario) => usuario.creadoEn >= HEREDADOS_HASTA)
  const soloLectura = nuevos.slice(maxUsuarios).map((usuario) => usuario.id)

  const diasRestantes =
    valida && carga.caducaEn !== null ? diasEntre(hoy, carga.caducaEn) : null

  const heredados = usuariosActivos - nuevos.length

  const { salud, titulo, detalle } = redactar({
    carga,
    caducada,
    valida,
    maxUsuarios,
    usuariosActivos,
    heredados,
    sobran: soloLectura.length,
    diasRestantes,
  })

  return {
    valida,
    plan: valida ? carga.plan : null,
    titular: carga?.titular ?? null,
    caducaEn: carga?.caducaEn ?? null,
    diasRestantes,
    maxUsuarios,
    usuariosActivos,
    heredados,
    soloLectura,
    salud,
    titulo,
    detalle,
  }
}

function redactar(estado: {
  carga: CargaLicencia | null
  caducada: boolean
  valida: boolean
  maxUsuarios: number
  usuariosActivos: number
  heredados: number
  sobran: number
  diasRestantes: number | null
}): { salud: 'ok' | 'aviso' | 'mal'; titulo: string; detalle: string } {
  const personas = (cuantas: number) => (cuantas === 1 ? '1 persona' : `${cuantas} personas`)

  if (estado.sobran > 0) {
    return {
      salud: 'mal',
      titulo: `${personas(estado.sobran)} sin poder escribir`,
      detalle: estado.caducada
        ? `La licencia caducó y el cupo ha vuelto a ${personas(estado.maxUsuarios)}. ` +
          `Nadie ha perdido el acceso ni un solo dato: quien sobra puede leer y exportar, ` +
          `pero no apuntar. Renueva la licencia y vuelven a escribir en el acto.`
        : `Esta licencia llega a ${personas(estado.maxUsuarios)} y sois ${estado.usuariosActivos}. ` +
          `Quien sobra puede leer y exportar, pero no apuntar. Amplía la licencia y se arregla solo.`,
    }
  }

  if (estado.caducada) {
    return {
      salud: 'aviso',
      titulo: 'Licencia caducada',
      detalle:
        'Sigues usando Norte entero porque sois los que caben sin licencia. ' +
        'Si vuelves a invitar a alguien, hará falta renovarla.',
    }
  }

  if (!estado.valida) {
    // Sin esta rama, la tarjeta decía «gratis para una persona» encima de
    // «2 personas en esta instalación», y quien lo leía se quedaba sin saber
    // cuál de las dos frases era la que le afectaba.
    if (estado.heredados > 1) {
      return {
        salud: 'ok',
        titulo: 'Instalación personal',
        detalle:
          `Sois ${estado.usuariosActivos} y ${personas(estado.heredados)} ya estabais aquí antes ` +
          'de que Norte tuviera licencias, así que seguís entrando sin ninguna. Para añadir a ' +
          'alguien más sí hará falta una.',
      }
    }
    return {
      salud: 'ok',
      titulo: 'Instalación personal',
      detalle:
        'Norte funciona entero y sin licencia para una persona, para siempre. ' +
        'La licencia hace falta solo para compartir el mismo Norte con alguien más.',
    }
  }

  if (estado.diasRestantes !== null && estado.diasRestantes <= DIAS_DE_AVISO) {
    return {
      salud: 'aviso',
      titulo:
        estado.diasRestantes <= 0
          ? 'La licencia caduca hoy'
          : `La licencia caduca en ${estado.diasRestantes} día${estado.diasRestantes === 1 ? '' : 's'}`,
      detalle:
        'Cuando caduque no se borra nada ni se cierra la puerta: el cupo vuelve a una persona ' +
        'y el resto pasa a solo lectura hasta que renueves.',
    }
  }

  return {
    salud: 'ok',
    titulo: `Licencia ${estado.carga!.plan}`,
    detalle:
      `A nombre de ${estado.carga!.titular}. Hasta ${personas(estado.maxUsuarios)}` +
      (estado.carga!.caducaEn ? `, hasta el ${estado.carga!.caducaEn}.` : ', sin caducidad.'),
  }
}

/**
 * ¿Puede escribir esta persona? Se pregunta en cada ruta que escribe, junto al
 * rol. Son dos permisos distintos: el rol dice qué puede hacer dentro de un
 * espacio, y esto dice si la instalación le deja escribir en absoluto.
 */
export function puedeEscribirConLicencia(estado: EstadoLicencia, usuarioId: string): boolean {
  return !estado.soloLectura.includes(usuarioId)
}
