import { getDb } from './database'
import { fechasDelMes, diaSemanaIso } from '../../shared/fechas'
import type {
  Empresa,
  NuevaEmpresa,
  Centro,
  NuevoCentro,
  Festivo,
  Trabajador,
  NuevoTrabajador,
  TrabajadorCentro,
  Cuadrante,
  Turno,
  ConvenioSalario,
  NuevoConvenioSalario
} from '../../shared/types'

// ---------------------------------------------------------------- EMPRESAS
export const empresas = {
  listar(): Empresa[] {
    return getDb().prepare('SELECT * FROM empresa ORDER BY razon_social').all() as Empresa[]
  },
  obtener(id: number): Empresa | undefined {
    return getDb().prepare('SELECT * FROM empresa WHERE id = ?').get(id) as Empresa | undefined
  },
  crear(e: NuevaEmpresa): Empresa {
    const info = getDb()
      .prepare(
        `INSERT INTO empresa (razon_social, cif, domicilio, admin_nombre, admin_nif, sello_imagen)
         VALUES (@razon_social, @cif, @domicilio, @admin_nombre, @admin_nif, @sello_imagen)`
      )
      .run(e)
    return empresas.obtener(Number(info.lastInsertRowid))!
  },
  actualizar(id: number, e: NuevaEmpresa): Empresa {
    getDb()
      .prepare(
        `UPDATE empresa SET razon_social=@razon_social, cif=@cif, domicilio=@domicilio,
         admin_nombre=@admin_nombre, admin_nif=@admin_nif, sello_imagen=@sello_imagen WHERE id=@id`
      )
      .run({ ...e, id })
    return empresas.obtener(id)!
  },
  borrar(id: number): void {
    getDb().prepare('DELETE FROM empresa WHERE id = ?').run(id)
  }
}

// ---------------------------------------------------------------- CENTROS
export const centros = {
  listar(empresaId?: number): Centro[] {
    if (empresaId) {
      return getDb()
        .prepare('SELECT * FROM centro WHERE empresa_id = ? ORDER BY nombre')
        .all(empresaId) as Centro[]
    }
    return getDb().prepare('SELECT * FROM centro ORDER BY nombre').all() as Centro[]
  },
  obtener(id: number): Centro | undefined {
    return getDb().prepare('SELECT * FROM centro WHERE id = ?').get(id) as Centro | undefined
  },
  crear(c: NuevoCentro): Centro {
    const info = getDb()
      .prepare(
        `INSERT INTO centro (empresa_id, codigo, nombre, provincia, localidad, direccion, convenio,
          horas_anuales_convenio, hora_apertura, hora_cierre, abre_laborables, abre_sabados,
          abre_lunes_sabado, hora_apertura_ls, hora_cierre_ls, abre_domingos, hora_apertura_dom,
          hora_cierre_dom, abre_festivos, hora_apertura_fes, hora_cierre_fes, color, activo)
         VALUES (@empresa_id,@codigo,@nombre,@provincia,@localidad,@direccion,@convenio,
          @horas_anuales_convenio,@hora_apertura,@hora_cierre,@abre_laborables,@abre_sabados,
          @abre_lunes_sabado,@hora_apertura_ls,@hora_cierre_ls,@abre_domingos,@hora_apertura_dom,
          @hora_cierre_dom,@abre_festivos,@hora_apertura_fes,@hora_cierre_fes,@color,@activo)`
      )
      .run(c)
    return centros.obtener(Number(info.lastInsertRowid))!
  },
  actualizar(id: number, c: NuevoCentro): Centro {
    getDb()
      .prepare(
        `UPDATE centro SET empresa_id=@empresa_id, codigo=@codigo, nombre=@nombre, provincia=@provincia,
          localidad=@localidad, direccion=@direccion, convenio=@convenio,
          horas_anuales_convenio=@horas_anuales_convenio, hora_apertura=@hora_apertura,
          hora_cierre=@hora_cierre, abre_laborables=@abre_laborables, abre_sabados=@abre_sabados,
          abre_lunes_sabado=@abre_lunes_sabado, hora_apertura_ls=@hora_apertura_ls,
          hora_cierre_ls=@hora_cierre_ls, abre_domingos=@abre_domingos,
          hora_apertura_dom=@hora_apertura_dom, hora_cierre_dom=@hora_cierre_dom,
          abre_festivos=@abre_festivos, hora_apertura_fes=@hora_apertura_fes,
          hora_cierre_fes=@hora_cierre_fes, color=@color, activo=@activo
         WHERE id=@id`
      )
      .run({ ...c, id })
    return centros.obtener(id)!
  },
  borrar(id: number): void {
    getDb().prepare('DELETE FROM centro WHERE id = ?').run(id)
  }
}

// ---------------------------------------------------------------- FESTIVOS
export const festivos = {
  listar(centroId: number): Festivo[] {
    return getDb()
      .prepare('SELECT * FROM festivo WHERE centro_id = ? ORDER BY fecha')
      .all(centroId) as Festivo[]
  },
  listarPorEmpresa(empresaId: number): Festivo[] {
    return getDb()
      .prepare(
        `SELECT f.* FROM festivo f JOIN centro c ON c.id = f.centro_id
         WHERE c.empresa_id = ? ORDER BY f.fecha`
      )
      .all(empresaId) as Festivo[]
  },
  crear(centroId: number, fecha: string, descripcion: string): Festivo {
    const info = getDb()
      .prepare('INSERT INTO festivo (centro_id, fecha, descripcion) VALUES (?,?,?)')
      .run(centroId, fecha, descripcion)
    return getDb().prepare('SELECT * FROM festivo WHERE id = ?').get(Number(info.lastInsertRowid)) as Festivo
  },
  borrar(id: number): void {
    getDb().prepare('DELETE FROM festivo WHERE id = ?').run(id)
  }
}

// ---------------------------------------------------------------- TRABAJADORES
export interface FiltroTrabajadores {
  empresaId?: number
  centroId?: number
  tipo?: string
  texto?: string
}

const CAMPOS_TRAB = `empresa_id,codigo,color,tipo,nombre,apellidos,dni_nie,nss,direccion,telefono,email,iban,categoria,
  tipo_contrato,fecha_contrato_inicio,fecha_contrato_fin,fecha_alta,fecha_baja,fecha_fin_periodo_prueba,
  horas_contrato_semanales,jornada_completa_semanal,horas_convenio_completa,coef_parcialidad,sueldo_convenio_completo,irpf,
  vacaciones_anuales,vacaciones_disfrutadas,precio_hora_complementaria,plus_productividad,plus_transporte,
  prorrateo_pagas_extras,retribucion_especie,retribucion_especie_exenta,deduccion_especie,
  deduccion_seguro_salud,observaciones,activo`

export const trabajadores = {
  listar(f: FiltroTrabajadores = {}): Trabajador[] {
    const cond: string[] = []
    const p: Record<string, unknown> = {}
    if (f.empresaId) {
      cond.push('t.empresa_id = @empresaId')
      p.empresaId = f.empresaId
    }
    if (f.tipo) {
      cond.push('t.tipo = @tipo')
      p.tipo = f.tipo
    }
    if (f.texto) {
      cond.push('(t.nombre LIKE @texto OR t.apellidos LIKE @texto OR t.dni_nie LIKE @texto OR t.codigo LIKE @texto)')
      p.texto = `%${f.texto}%`
    }
    let sql = 'SELECT DISTINCT t.* FROM trabajador t'
    if (f.centroId) {
      sql += ' JOIN trabajador_centro tc ON tc.trabajador_id = t.id AND tc.centro_id = @centroId'
      p.centroId = f.centroId
    }
    if (cond.length) sql += ' WHERE ' + cond.join(' AND ')
    sql += ' ORDER BY t.apellidos, t.nombre'
    return getDb().prepare(sql).all(p) as Trabajador[]
  },
  obtener(id: number): Trabajador | undefined {
    return getDb().prepare('SELECT * FROM trabajador WHERE id = ?').get(id) as Trabajador | undefined
  },
  crear(t: NuevoTrabajador): Trabajador {
    const cols = CAMPOS_TRAB.replace(/\s+/g, '')
    const vals = cols
      .split(',')
      .map((c) => '@' + c)
      .join(',')
    const info = getDb()
      .prepare(`INSERT INTO trabajador (${cols}) VALUES (${vals})`)
      .run(t as unknown as Record<string, unknown>)
    return trabajadores.obtener(Number(info.lastInsertRowid))!
  },
  actualizar(id: number, t: NuevoTrabajador): Trabajador {
    const sets = CAMPOS_TRAB.replace(/\s+/g, '')
      .split(',')
      .map((c) => `${c}=@${c}`)
      .join(',')
    getDb()
      .prepare(`UPDATE trabajador SET ${sets} WHERE id=@id`)
      .run({ ...(t as unknown as Record<string, unknown>), id })
    return trabajadores.obtener(id)!
  },
  borrar(id: number): void {
    getDb().prepare('DELETE FROM trabajador WHERE id = ?').run(id)
  },
  // ---- Centros asignados (N:M) ----
  centrosDe(trabajadorId: number): TrabajadorCentro[] {
    return getDb()
      .prepare('SELECT * FROM trabajador_centro WHERE trabajador_id = ?')
      .all(trabajadorId) as TrabajadorCentro[]
  },
  fijarCentros(
    trabajadorId: number,
    asignaciones: Array<{ centro_id: number; es_principal: boolean }>
  ): void {
    const d = getDb()
    const tx = d.transaction(() => {
      d.prepare('DELETE FROM trabajador_centro WHERE trabajador_id = ?').run(trabajadorId)
      const ins = d.prepare(
        'INSERT INTO trabajador_centro (trabajador_id, centro_id, es_principal) VALUES (?,?,?)'
      )
      for (const a of asignaciones) ins.run(trabajadorId, a.centro_id, a.es_principal ? 1 : 0)
    })
    tx()
  }
}

// ---------------------------------------------------------------- VACACIONES
export const vacaciones = {
  listar(trabajadorId: number): string[] {
    return (
      getDb()
        .prepare('SELECT fecha FROM vacacion WHERE trabajador_id = ? ORDER BY fecha')
        .all(trabajadorId) as { fecha: string }[]
    ).map((r) => r.fecha)
  },
  /** Reemplaza el conjunto de días de vacaciones disfrutados del trabajador. */
  fijar(trabajadorId: number, fechas: string[]): void {
    const d = getDb()
    const tx = d.transaction(() => {
      d.prepare('DELETE FROM vacacion WHERE trabajador_id = ?').run(trabajadorId)
      const ins = d.prepare('INSERT OR IGNORE INTO vacacion (trabajador_id, fecha) VALUES (?, ?)')
      for (const f of fechas) ins.run(trabajadorId, f)
    })
    tx()
  }
}

// ---------------------------------------------------------------- CUADRANTES
export const cuadrantes = {
  /** Devuelve el cuadrante del mes creándolo (con sus turnos vacíos) si no existe. */
  obtenerOCrear(trabajadorId: number, anio: number, mes: number): Cuadrante {
    const d = getDb()
    let c = d
      .prepare('SELECT * FROM cuadrante WHERE trabajador_id=? AND anio=? AND mes=?')
      .get(trabajadorId, anio, mes) as Cuadrante | undefined
    if (!c) {
      const tx = d.transaction(() => {
        const info = d
          .prepare('INSERT INTO cuadrante (trabajador_id, anio, mes) VALUES (?,?,?)')
          .run(trabajadorId, anio, mes)
        const cid = Number(info.lastInsertRowid)
        const ins = d.prepare(
          'INSERT INTO turno (cuadrante_id, fecha, dia_semana, situacion) VALUES (?,?,?,?)'
        )
        for (const fecha of fechasDelMes(anio, mes)) {
          ins.run(cid, fecha, diaSemanaIso(fecha), 'libre')
        }
        return cid
      })
      const cid = tx()
      c = d.prepare('SELECT * FROM cuadrante WHERE id = ?').get(cid) as Cuadrante
    } else {
      // Garantiza que existan todos los días (por si cambió algo).
      const existentes = new Set(
        (d.prepare('SELECT fecha FROM turno WHERE cuadrante_id = ?').all(c.id) as { fecha: string }[]).map(
          (r) => r.fecha
        )
      )
      const ins = d.prepare(
        'INSERT INTO turno (cuadrante_id, fecha, dia_semana, situacion) VALUES (?,?,?,?)'
      )
      for (const fecha of fechasDelMes(anio, mes)) {
        if (!existentes.has(fecha)) ins.run(c.id, fecha, diaSemanaIso(fecha), 'libre')
      }
    }
    return c
  },
  turnos(cuadranteId: number): Turno[] {
    return getDb()
      .prepare('SELECT * FROM turno WHERE cuadrante_id = ? ORDER BY fecha')
      .all(cuadranteId) as Turno[]
  },
  guardarTurno(t: Turno): Turno {
    getDb()
      .prepare(
        `UPDATE turno SET situacion=@situacion, centro_id=@centro_id, entrada1=@entrada1,
          salida1=@salida1, entrada2=@entrada2, salida2=@salida2, descanso_min=@descanso_min
         WHERE id=@id`
      )
      .run(t)
    return getDb().prepare('SELECT * FROM turno WHERE id = ?').get(t.id) as Turno
  },
  /** Guarda varios turnos en una transacción (rellenado ágil, copiar semana…). */
  guardarTurnos(lista: Turno[]): void {
    const d = getDb()
    const stmt = d.prepare(
      `UPDATE turno SET situacion=@situacion, centro_id=@centro_id, entrada1=@entrada1,
        salida1=@salida1, entrada2=@entrada2, salida2=@salida2, descanso_min=@descanso_min WHERE id=@id`
    )
    const tx = d.transaction((rows: Turno[]) => {
      for (const r of rows) stmt.run(r)
    })
    tx(lista)
  },
  fijarFechaEntrega(cuadranteId: number, fecha: string | null): void {
    getDb().prepare('UPDATE cuadrante SET fecha_entrega = ? WHERE id = ?').run(fecha, cuadranteId)
  },
  /** Todos los turnos de un mes de todos los trabajadores de una empresa (vista por centro). */
  turnosMesEmpresa(empresaId: number, anio: number, mes: number): Array<Turno & { trabajador_id: number }> {
    return getDb()
      .prepare(
        `SELECT tu.*, c.trabajador_id AS trabajador_id
         FROM turno tu
         JOIN cuadrante c ON c.id = tu.cuadrante_id
         JOIN trabajador t ON t.id = c.trabajador_id
         WHERE t.empresa_id = ? AND c.anio = ? AND c.mes = ?
         ORDER BY tu.fecha`
      )
      .all(empresaId, anio, mes) as Array<Turno & { trabajador_id: number }>
  }
}

// ---------------------------------------------------------------- CONVENIOS (salarios)
export const conveniosSalario = {
  listar(): ConvenioSalario[] {
    return getDb()
      .prepare('SELECT * FROM convenio_salario ORDER BY convenio, categoria')
      .all() as ConvenioSalario[]
  },
  crear(c: NuevoConvenioSalario): ConvenioSalario {
    const info = getDb()
      .prepare(
        `INSERT INTO convenio_salario (convenio, categoria, salario_base, plus_productividad,
          plus_transporte, precio_hora_complementaria, horas_convenio_anuales, notas)
         VALUES (@convenio,@categoria,@salario_base,@plus_productividad,@plus_transporte,
          @precio_hora_complementaria,@horas_convenio_anuales,@notas)`
      )
      .run(c)
    return getDb()
      .prepare('SELECT * FROM convenio_salario WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as ConvenioSalario
  },
  actualizar(id: number, c: NuevoConvenioSalario): ConvenioSalario {
    getDb()
      .prepare(
        `UPDATE convenio_salario SET convenio=@convenio, categoria=@categoria,
          salario_base=@salario_base, plus_productividad=@plus_productividad,
          plus_transporte=@plus_transporte, precio_hora_complementaria=@precio_hora_complementaria,
          horas_convenio_anuales=@horas_convenio_anuales, notas=@notas WHERE id=@id`
      )
      .run({ ...c, id })
    return getDb().prepare('SELECT * FROM convenio_salario WHERE id = ?').get(id) as ConvenioSalario
  },
  borrar(id: number): void {
    getDb().prepare('DELETE FROM convenio_salario WHERE id = ?').run(id)
  }
}
