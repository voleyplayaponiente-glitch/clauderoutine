/**
 * Errores de la API.
 *
 * Regla del proyecto: **un mensaje de error dice qué pasó y cómo se arregla**.
 * «Error inesperado» es lo que se escribe cuando no se ha pensado en el usuario.
 */

export type CodigoError =
  | 'no_autenticado'
  | 'credenciales'
  | 'no_encontrado'
  | 'sin_permiso'
  | 'datos_invalidos'
  | 'conflicto'
  | 'demasiadas_peticiones'
  | 'interno'

const ESTADO: Record<CodigoError, number> = {
  no_autenticado: 401,
  credenciales: 401,
  no_encontrado: 404,
  sin_permiso: 403,
  datos_invalidos: 400,
  conflicto: 409,
  demasiadas_peticiones: 429,
  interno: 500,
}

export class ErrorApi extends Error {
  readonly codigo: CodigoError
  readonly estado: number
  readonly detalle?: unknown

  constructor(codigo: CodigoError, mensaje: string, detalle?: unknown) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.codigo = codigo
    this.estado = ESTADO[codigo]
    this.detalle = detalle
  }
}

export const noAutenticado = () =>
  new ErrorApi('no_autenticado', 'Necesitas entrar en tu cuenta para hacer esto.')

export const credencialesInvalidas = () =>
  // El mismo mensaje para «no existe ese correo» y «la contraseña no es esa»:
  // distinguirlos permite averiguar quién tiene cuenta en esta instalación.
  new ErrorApi('credenciales', 'El correo o la contraseña no son correctos.')

export const noEncontrado = (mensaje = 'No encontrado.') => new ErrorApi('no_encontrado', mensaje)

export const sinPermiso = (mensaje: string) => new ErrorApi('sin_permiso', mensaje)

export const datosInvalidos = (mensaje: string, detalle?: unknown) =>
  new ErrorApi('datos_invalidos', mensaje, detalle)

export const conflicto = (mensaje: string) => new ErrorApi('conflicto', mensaje)
