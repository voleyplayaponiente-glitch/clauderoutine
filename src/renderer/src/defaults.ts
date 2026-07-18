import type { NuevaEmpresa, NuevoCentro, NuevoTrabajador } from '@shared/types'

export const COLORES_CENTRO = [
  '#0071e3',
  '#34c759',
  '#ff9500',
  '#af52de',
  '#ff2d55',
  '#5ac8fa',
  '#ffcc00',
  '#8e8e93'
]

export function empresaVacia(): NuevaEmpresa {
  return {
    razon_social: '',
    cif: '',
    domicilio: '',
    admin_nombre: '',
    admin_nif: '',
    sello_imagen: null
  }
}

export function centroVacio(empresaId: number, color = COLORES_CENTRO[0]): NuevoCentro {
  return {
    empresa_id: empresaId,
    codigo: '',
    nombre: '',
    provincia: '',
    localidad: '',
    direccion: '',
    convenio: '',
    horas_anuales_convenio: 1768,
    hora_apertura: '10:00',
    hora_cierre: '22:00',
    abre_laborables: 1,
    abre_sabados: 1,
    abre_domingos: 0,
    abre_festivos: 0,
    color,
    activo: 1
  }
}

export function trabajadorVacio(empresaId: number): NuevoTrabajador {
  return {
    empresa_id: empresaId,
    tipo: 'ajena',
    nombre: '',
    apellidos: '',
    dni_nie: '',
    nss: '',
    direccion: '',
    telefono: '',
    email: '',
    iban: '',
    categoria: '',
    tipo_contrato: 'indefinido',
    fecha_contrato_inicio: null,
    fecha_contrato_fin: null,
    fecha_alta: null,
    fecha_baja: null,
    fecha_fin_periodo_prueba: null,
    horas_contrato_semanales: 40,
    horas_convenio_completa: 1768,
    coef_parcialidad: 1,
    sueldo_convenio_completo: 0,
    irpf: 0,
    vacaciones_anuales: 30,
    vacaciones_disfrutadas: 0,
    precio_hora_complementaria: 0,
    observaciones: '',
    activo: 1
  }
}
