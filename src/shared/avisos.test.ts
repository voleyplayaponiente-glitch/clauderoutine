import { describe, it, expect } from 'vitest'
import { avisosMes } from './avisos'
import type { Centro, Trabajador, Turno } from './types'

const centro: Centro = {
  id: 1,
  empresa_id: 1,
  codigo: 'C1',
  nombre: 'Tienda Centro',
  provincia: 'Valencia',
  localidad: 'Valencia',
  direccion: 'Calle 1',
  convenio: 'Comercio',
  horas_anuales_convenio: 1768,
  hora_apertura: '10:00',
  hora_cierre: '22:00',
  abre_laborables: 1,
  abre_sabados: 1,
  abre_lunes_sabado: 1,
  hora_apertura_ls: '10:00',
  hora_cierre_ls: '22:00',
  abre_domingos: 0,
  hora_apertura_dom: '11:00',
  hora_cierre_dom: '15:00',
  abre_festivos: 0,
  hora_apertura_fes: '11:00',
  hora_cierre_fes: '15:00',
  color: '#3b82f6',
  activo: 1
}

const trabajador: Trabajador = {
  id: 1,
  empresa_id: 1,
  tipo: 'ajena',
  nombre: 'Ana',
  apellidos: 'García',
  dni_nie: '12345678Z',
  nss: '281234567840',
  direccion: '',
  telefono: '',
  email: '',
  iban: '',
  categoria: 'Dependienta',
  tipo_contrato: 'indefinido',
  fecha_contrato_inicio: null,
  fecha_contrato_fin: null,
  fecha_alta: null,
  fecha_baja: null,
  fecha_fin_periodo_prueba: null,
  horas_contrato_semanales: 40,
  horas_convenio_completa: 1768,
  coef_parcialidad: 1,
  sueldo_convenio_completo: 1400,
  irpf: 2,
  vacaciones_anuales: 30,
  vacaciones_disfrutadas: 0,
  precio_hora_complementaria: 9.7,
  plus_productividad: 0,
  prorrateo_pagas_extras: 0,
  retribucion_especie: 0,
  retribucion_especie_exenta: 0,
  deduccion_especie: 0,
  deduccion_seguro_salud: 0,
  observaciones: '',
  activo: 1
}

const turno = (p: Partial<Turno>): Turno => ({
  id: Math.random(),
  cuadrante_id: 1,
  fecha: '2026-03-02',
  dia_semana: 1,
  situacion: 'trabaja',
  centro_id: 1,
  entrada1: '10:00',
  salida1: '18:00',
  entrada2: null,
  salida2: null,
  descanso_min: 0,
  ...p
})

const ctx = {
  trabajador,
  centrosPorId: { 1: centro },
  festivosPorFecha: new Set<string>(),
  anio: 2026,
  mes: 3
}

describe('avisosMes', () => {
  it('avisa de turno en día que el centro no abre (domingo)', () => {
    const turnos = [turno({ fecha: '2026-03-01' })] // domingo
    const a = avisosMes({ ...ctx, turnos })
    expect(a.some((x) => x.tipo === 'centro_cerrado')).toBe(true)
  })

  it('avisa de turno fuera del horario de apertura', () => {
    const turnos = [turno({ fecha: '2026-03-02', entrada1: '08:00', salida1: '12:00' })]
    const a = avisosMes({ ...ctx, turnos })
    expect(a.some((x) => x.tipo === 'fuera_apertura')).toBe(true)
  })

  it('avisa de descanso menor de 12 h entre jornadas', () => {
    // 22:00 → 09:00 = 11 h de descanso (menos del mínimo legal de 12 h).
    const turnos = [
      turno({ fecha: '2026-03-02', entrada1: '14:00', salida1: '22:00' }),
      turno({ fecha: '2026-03-03', entrada1: '09:00', salida1: '18:00' })
    ]
    const a = avisosMes({ ...ctx, turnos })
    expect(a.some((x) => x.tipo === 'descanso_12h')).toBe(true)
  })

  it('no avisa si el descanso es exactamente de 12 h', () => {
    const turnos = [
      turno({ fecha: '2026-03-02', entrada1: '14:00', salida1: '22:00' }),
      turno({ fecha: '2026-03-03', entrada1: '10:00', salida1: '18:00' })
    ]
    const a = avisosMes({ ...ctx, turnos })
    expect(a.some((x) => x.tipo === 'descanso_12h')).toBe(false)
  })

  it('detecta solapamiento de tramos en turno partido', () => {
    const turnos = [
      turno({ fecha: '2026-03-02', entrada1: '10:00', salida1: '15:00', entrada2: '14:00', salida2: '20:00' })
    ]
    const a = avisosMes({ ...ctx, turnos })
    expect(a.some((x) => x.tipo === 'solapamiento')).toBe(true)
  })

  it('el autónomo no dispara avisos de descanso', () => {
    const auto = { ...trabajador, tipo: 'autonomo' as const }
    const turnos = [
      turno({ fecha: '2026-03-02', entrada1: '14:00', salida1: '22:00' }),
      turno({ fecha: '2026-03-03', entrada1: '10:00', salida1: '18:00' })
    ]
    const a = avisosMes({ ...ctx, trabajador: auto, turnos })
    expect(a.some((x) => x.tipo === 'descanso_12h')).toBe(false)
  })
})
