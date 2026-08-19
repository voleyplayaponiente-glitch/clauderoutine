/**
 * Cliente de la API.
 *
 * Todas las llamadas son al mismo origen: en el Umbrel nginx sirve la app y
 * pasa `/api` al servidor, y en desarrollo Vite hace lo mismo con su proxy. Así
 * no hay CORS, ni contenido mixto, ni cookies de terceros. Es la misma lección
 * que costó una tarde de Tailscale en la app de empresa.
 */

export class ErrorDeApi extends Error {
  readonly codigo: string
  readonly estado: number

  constructor(estado: number, codigo: string, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorDeApi'
    this.estado = estado
    this.codigo = codigo
  }
}

export async function pedir<T>(
  ruta: string,
  opciones: { metodo?: string; cuerpo?: unknown } = {},
): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers: opciones.cuerpo ? { 'content-type': 'application/json' } : undefined,
      body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
      // La sesión va en cookie httpOnly; sin esto no viajaría.
      credentials: 'same-origin',
    })
  } catch {
    // Un fallo de red no es un fallo del servidor, y decir cuál es cambia lo
    // que la persona tiene que hacer a continuación.
    throw new ErrorDeApi(0, 'sin_conexion', 'No se ha podido contactar con el servidor de Norte.')
  }

  if (respuesta.status === 204) return undefined as T

  const texto = await respuesta.text()
  const datos = texto ? (JSON.parse(texto) as unknown) : {}

  if (!respuesta.ok) {
    const error = (datos as { error?: { codigo?: string; mensaje?: string } }).error
    throw new ErrorDeApi(
      respuesta.status,
      error?.codigo ?? 'interno',
      error?.mensaje ?? 'Algo ha fallado y el servidor no ha dicho qué.',
    )
  }
  return datos as T
}

// ─────────────────────────────────────────────────────────── Tipos compartidos

export interface Usuario {
  id: string
  email: string
  nombre: string
  divisaBase: string
  zonaHoraria: string
  totpActivo: boolean
}

export interface EspacioResumen {
  id: string
  nombre: string
  tipo: 'personal' | 'pareja' | 'negocio'
  divisaBase: string
  rol: 'propietario' | 'editor' | 'lector'
}

export interface Sesion {
  usuario: Usuario
  espacios: EspacioResumen[]
}

export interface EstadoPuerta {
  requiereInvitacion: boolean
  primeraCuenta: boolean
}

export type ConsultaInvitacion =
  | { valida: true; espacio: string; rol: string; email: string | null; invitaPor: string; expiraEn: string }
  | { valida: false; motivo: string; mensaje: string }

export interface CuentaResumen {
  id: string
  nombre: string
  tipo: string
  divisa: string
  entidad: string | null
  ultimos4: string | null
  computaPatrimonio: boolean
  visibleEnEspacio: boolean
  esMia: boolean
  archivada: boolean
  saldo: number
}

export interface Movimiento {
  id: string
  cuentaId: string
  categoriaId: string | null
  categoria: string | null
  importe: number
  fecha: string
  concepto: string
  comercio: string | null
  notas: string | null
  etiquetas: string[]
  estado: 'previsto' | 'confirmado'
  esCompartido: boolean
}

export interface ListaMovimientos {
  movimientos: Movimiento[]
  total: number
  pagina: number
  resumen: {
    ingresos: number
    gastos: number
    balance: number
    previsto: { ingresos: number; gastos: number }
  }
}

export interface Categoria {
  id: string
  nombre: string
  padreId: string | null
  flujo: 'gasto' | 'ingreso'
  tipo: string
  esencial: boolean
}

export interface Recurrente {
  id: string
  cuentaId: string
  categoriaId: string | null
  categoria: string | null
  concepto: string
  importe: number
  periodicidad: string
  desde: string
  hasta: string | null
  diaDelMes: number | null
  ultimoDiaHabil: boolean
  activa: boolean
  proxima: string | null
}

export interface FiltrosMovimientos {
  desde?: string
  hasta?: string
  cuentaId?: string
  categoriaId?: string
  estado?: 'previsto' | 'confirmado'
  texto?: string
  pagina?: number
}

export interface InvitacionPendiente {
  id: string
  email: string | null
  rol: string
  creadaEn: string
  expiraEn: string
}


export interface DocumentoResumen {
  id: string
  nombreOriginal: string
  mimeType: string
  tamanoBytes: number
  tipo: string
  estado: 'subido' | 'procesando' | 'revision' | 'aplicado' | 'fallido'
  motivoTipo: string | null
  error: string | null
  creadoEn: string
  movimientos?: number
}

export interface ApunteLeido {
  huella: string
  fecha: string
  fechaValor?: string
  concepto: string
  importe: number
  saldo?: number
  divisa: string
  tarjeta?: string
  origen: number
  yaImportado: boolean
  parecidoA?: { concepto: string; fecha: string }
}

export interface NominaLeida {
  empresa: string | null
  cif: string | null
  periodo: { desde: string; hasta: string } | null
  bruto: number | null
  irpf: number | null
  cotizaciones: number | null
  neto: number | null
}

export interface LecturaDocumento {
  documento: DocumentoResumen
  deteccion: { tipo: string; formato: string; motivo: string }
  error?: string
  hoja?: string
  cuenta?: { titular?: string; ibanUltimos4?: string; saldoFinal?: number; divisa?: string }
  desde?: string
  hasta?: string
  avisos?: string[]
  nomina?: NominaLeida
  apuntes: ApunteLeido[]
}

export const api = {
  yo: () => pedir<Sesion>('/auth/yo'),
  estadoPuerta: () => pedir<EstadoPuerta>('/auth/estado'),
  entrar: (email: string, contrasena: string) =>
    pedir<Sesion>('/auth/entrar', { metodo: 'POST', cuerpo: { email, contrasena } }),
  registro: (email: string, nombre: string, contrasena: string, invitacion?: string) =>
    pedir<Sesion>('/auth/registro', {
      metodo: 'POST',
      cuerpo: { email, nombre, contrasena, ...(invitacion ? { invitacion } : {}) },
    }),
  salir: () => pedir<{ ok: true }>('/auth/salir', { metodo: 'POST' }),
  espacios: () => pedir<{ espacios: EspacioResumen[] }>('/espacios'),

  crearEspacio: (nombre: string, tipo: 'personal' | 'pareja' | 'negocio') =>
    pedir<{ espacio: { id: string } }>('/espacios', { metodo: 'POST', cuerpo: { nombre, tipo } }),

  // El testigo va en el cuerpo y no en la ruta: Fastify registra la URL de cada
  // petición, y en la ruta acabaría escrito en los registros del servidor.
  consultarInvitacion: (token: string) =>
    pedir<ConsultaInvitacion>('/invitaciones/consultar', { metodo: 'POST', cuerpo: { token } }),
  invitaciones: (espacioId: string) =>
    pedir<{ invitaciones: InvitacionPendiente[] }>(`/espacios/${espacioId}/invitaciones`),
  crearInvitacion: (espacioId: string, datos: { email?: string; rol: string }) =>
    pedir<{ ruta: string; invitacion: InvitacionPendiente }>(`/espacios/${espacioId}/invitaciones`, {
      metodo: 'POST',
      cuerpo: datos,
    }),
  anularInvitacion: (espacioId: string, id: string) =>
    pedir<{ ok: true }>(`/espacios/${espacioId}/invitaciones/${id}`, { metodo: 'DELETE' }),

  categorias: (espacioId: string) =>
    pedir<{ categorias: Categoria[] }>(`/espacios/${espacioId}/categorias`),

  cuentas: (espacioId: string) => pedir<{ cuentas: CuentaResumen[] }>(`/espacios/${espacioId}/cuentas`),
  crearCuenta: (espacioId: string, datos: Record<string, unknown>) =>
    pedir<{ cuenta: CuentaResumen }>(`/espacios/${espacioId}/cuentas`, { metodo: 'POST', cuerpo: datos }),
  editarCuenta: (espacioId: string, id: string, datos: Record<string, unknown>) =>
    pedir<{ cuenta: CuentaResumen }>(`/espacios/${espacioId}/cuentas/${id}`, {
      metodo: 'PATCH',
      cuerpo: datos,
    }),
  borrarCuenta: (espacioId: string, id: string) =>
    pedir<{ ok: true }>(`/espacios/${espacioId}/cuentas/${id}`, { metodo: 'DELETE' }),

  movimientos: (espacioId: string, filtros: FiltrosMovimientos = {}) => {
    const busqueda = new URLSearchParams()
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== undefined && valor !== '') busqueda.set(clave, String(valor))
    }
    const cola = busqueda.toString()
    return pedir<ListaMovimientos>(`/espacios/${espacioId}/movimientos${cola ? `?${cola}` : ''}`)
  },
  crearMovimiento: (espacioId: string, datos: Record<string, unknown>) =>
    pedir<{ movimiento: Movimiento }>(`/espacios/${espacioId}/movimientos`, {
      metodo: 'POST',
      cuerpo: datos,
    }),
  editarMovimiento: (espacioId: string, id: string, datos: Record<string, unknown>) =>
    pedir<{ movimiento: Movimiento }>(`/espacios/${espacioId}/movimientos/${id}`, {
      metodo: 'PATCH',
      cuerpo: datos,
    }),
  borrarMovimiento: (espacioId: string, id: string) =>
    pedir<{ ok: true }>(`/espacios/${espacioId}/movimientos/${id}`, { metodo: 'DELETE' }),

  recurrentes: (espacioId: string) =>
    pedir<{ recurrentes: Recurrente[] }>(`/espacios/${espacioId}/recurrentes`),
  crearRecurrente: (espacioId: string, datos: Record<string, unknown>) =>
    pedir<{ recurrente: { id: string } }>(`/espacios/${espacioId}/recurrentes`, {
      metodo: 'POST',
      cuerpo: datos,
    }),
  borrarRecurrente: (espacioId: string, id: string) =>
    pedir<{ ok: true }>(`/espacios/${espacioId}/recurrentes/${id}`, { metodo: 'DELETE' }),
  generarPrevistos: (espacioId: string) =>
    pedir<{ creados: number; revisados: number }>(`/espacios/${espacioId}/recurrentes/generar`, {
      metodo: 'POST',
      cuerpo: {},
    }),
  documentos: (espacioId: string) =>
    pedir<{ documentos: DocumentoResumen[] }>(`/espacios/${espacioId}/documentos`),
  // La subida no pasa por `pedir`: va en multipart y el cuerpo es el propio
  // `FormData`, así que no puede llevar `content-type` puesto a mano — el
  // navegador tiene que añadir el separador él.
  subirDocumento: async (espacioId: string, fichero: File): Promise<{ documento: DocumentoResumen }> => {
    const formulario = new FormData()
    formulario.append('fichero', fichero)
    const respuesta = await fetch(`/api/espacios/${espacioId}/documentos`, {
      method: 'POST',
      body: formulario,
      credentials: 'same-origin',
    })
    const texto = await respuesta.text()
    const datos = texto ? (JSON.parse(texto) as unknown) : {}
    if (!respuesta.ok) {
      const error = (datos as { error?: { codigo?: string; mensaje?: string } }).error
      throw new ErrorDeApi(
        respuesta.status,
        error?.codigo ?? 'interno',
        error?.mensaje ?? 'No se ha podido subir el fichero.',
      )
    }
    return datos as { documento: DocumentoResumen }
  },
  lecturaDocumento: (espacioId: string, id: string) =>
    pedir<LecturaDocumento>(`/espacios/${espacioId}/documentos/${id}/lectura`),
  aplicarDocumento: (
    espacioId: string,
    id: string,
    datos: { cuentaId: string; categoriaId?: string | null; apuntes: unknown[] },
  ) =>
    pedir<{ creados: number; omitidos: number }>(`/espacios/${espacioId}/documentos/${id}/aplicar`, {
      metodo: 'POST',
      cuerpo: datos,
    }),
  borrarDocumento: (espacioId: string, id: string) =>
    pedir<{ ok: true }>(`/espacios/${espacioId}/documentos/${id}`, { metodo: 'DELETE' }),
}
