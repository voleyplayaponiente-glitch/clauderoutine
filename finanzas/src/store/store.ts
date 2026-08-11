/**
 * Estado global (Zustand) + persistencia en IndexedDB con debounce.
 * En la Fase 0 gestiona configuración y tema; los módulos operativos irán
 * añadiendo su porción de estado fase a fase.
 */
import { create } from 'zustand'
import type { Configuracion, DatosOperativos, Tercero, Venta, Compra, GastoRecurrente, CuentaTesoreria, MovimientoTesoreria, ArqueoCaja, Almacen, Articulo, MovimientoStock, PlantillaImportacion, LoteImportacion, Deuda, Renting, Poliza, TarjetaCredito, DeudorVario, Presupuesto, Conector, LogSync } from '../dominio/tipos'
import { configuracionInicial } from '../dominio/defaults'
import {
  cargarConfig,
  guardarConfig,
  cargarTema,
  guardarTema,
  cargarDatos,
  guardarDatos,
  cargarGrupo,
  espaciosGuardados,
  guardarGrupo,
  borrarEspacioEmpresa,
  migrarDesdeEmpresaUnica,
} from '../lib/db'
import { nuevoId } from '../dominio/id'
import {
  grupoInicial,
  validarParticipacion,
  type Grupo,
  type EmpresaResumen,
  type Participacion,
} from '../dominio/grupo'
import { validarSocio, type Socio } from '../dominio/socios'
import type { Inversion, OperacionInversion, ValoracionInversion } from '../dominio/inversiones'

type Tema = 'claro' | 'oscuro'

function datosIniciales(): DatosOperativos {
  return { terceros: [], ventas: [], compras: [], recurrentes: [], cuentasTesoreria: [], movimientos: [], arqueos: [], almacenes: [], articulos: [], movimientosStock: [], importaciones: [], deudas: [], rentings: [], polizas: [], tarjetasCredito: [], deudores: [], presupuestos: [], logsSync: [], inversiones: [], operacionesInversion: [], valoracionesInversion: [] }
}

/** Colección de datos que recibe cada destino de importación. */
const COLECCION_DESTINO: Record<string, keyof DatosOperativos> = {
  articulos: 'articulos',
  terceros: 'terceros',
  'movimientos-banco': 'movimientos',
}

interface Estado {
  loaded: boolean
  tema: Tema
  /** Índice del grupo: qué empresas hay y quién participa en quién. */
  grupo: Grupo
  /** Configuración y datos DE LA EMPRESA ACTIVA (nunca mezclados entre empresas). */
  config: Configuracion
  datos: DatosOperativos
  init: () => Promise<void>
  // Grupo de empresas
  cambiarEmpresa: (empresaId: string) => Promise<void>
  crearEmpresa: (datos: { razonSocial: string; cif: string; esHolding: boolean }) => Promise<string>
  eliminarEmpresa: (empresaId: string) => Promise<void>
  renombrarGrupo: (nombre: string) => void
  guardarParticipacion: (p: Participacion) => { ok: boolean; motivo?: string }
  eliminarParticipacion: (id: string) => void
  actualizarFichaEmpresa: (empresaId: string, parcial: Partial<EmpresaResumen>) => void
  // Accionariado
  guardarSocio: (s: Socio) => { ok: boolean; motivo?: string }
  eliminarSocio: (id: string) => void
  alternarTema: () => void
  actualizarConfig: (parcial: Partial<Configuracion>) => void
  reemplazarConfig: (config: Configuracion) => void
  // Datos operativos
  guardarTercero: (t: Tercero) => void
  guardarVenta: (v: Venta) => void
  anularVenta: (id: string) => void
  guardarCompra: (c: Compra) => void
  anularCompra: (id: string) => void
  guardarRecurrente: (r: GastoRecurrente) => void
  eliminarRecurrente: (id: string) => void
  // Tesorería
  guardarCuentaTesoreria: (c: CuentaTesoreria) => void
  guardarMovimiento: (m: MovimientoTesoreria) => void
  anularMovimiento: (id: string) => void
  anularMovimientos: (ids: string[]) => number
  /** Importa movimientos y, si se indica el fichero, deja una tanda deshacible. */
  importarMovimientos: (ms: MovimientoTesoreria[], nombreFichero?: string) => number
  conciliarMovimiento: (id: string, conciliado: boolean) => void
  conciliarMovimientos: (ids: string[], conciliado: boolean) => number
  guardarArqueo: (a: ArqueoCaja) => void
  // Stock
  guardarAlmacen: (a: Almacen) => void
  guardarArticulo: (a: Articulo) => void
  anularArticulo: (id: string) => void
  guardarMovimientoStock: (m: MovimientoStock) => void
  guardarMovimientosStock: (ms: MovimientoStock[]) => void
  anularMovimientoStock: (id: string) => void
  // Importación
  guardarPlantilla: (p: PlantillaImportacion) => void
  eliminarPlantilla: (id: string) => void
  aplicarImportacion: (destinoId: string, entidades: { id: string }[], nombreFichero: string) => LoteImportacion
  deshacerImportacion: (loteId: string) => void
  // Deudas y deudores
  /** Espacios de empresa que estaban huérfanos y se han recuperado al arrancar. */
  empresasRecuperadas: number
  guardarDeuda: (d: Deuda) => void
  anularDeuda: (id: string) => void
  guardarRenting: (r: Renting) => void
  anularRenting: (id: string) => void
  guardarPoliza: (p: Poliza) => void
  anularPoliza: (id: string) => void
  guardarTarjetaCredito: (t: TarjetaCredito) => void
  anularTarjetaCredito: (id: string) => void
  guardarDeudor: (d: DeudorVario) => void
  anularDeudor: (id: string) => void
  guardarPresupuesto: (p: Presupuesto) => void
  // Inversiones
  guardarInversion: (i: Inversion) => void
  anularInversion: (id: string) => void
  guardarOperacionInversion: (o: OperacionInversion) => void
  anularOperacionInversion: (id: string) => void
  guardarValoracionInversion: (v: ValoracionInversion) => void
  anularValoracionInversion: (id: string) => void
  // Conectores
  guardarConector: (c: Conector) => void
  eliminarConector: (id: string) => void
  guardarLogSync: (l: LogSync) => void
  reemplazarDatos: (d: DatosOperativos) => void
  restaurarTodo: (config: Configuracion, datos: DatosOperativos) => void
}

/**
 * Escritura con debounce. La empresa destino se captura en el cierre EN EL
 * MOMENTO DE LA LLAMADA: si el usuario cambia de empresa antes de que venza el
 * temporizador, lo pendiente se escribe igualmente en el espacio correcto y
 * jamás cae en la contabilidad de otra sociedad.
 */
/** Empresa cuyo espacio de datos está cargado ahora mismo. */
let empresaActual = ''

let debounce: ReturnType<typeof setTimeout> | undefined
let pendienteConfig: (() => Promise<void>) | undefined
function persistirConDebounce(config: Configuracion) {
  const empresaId = empresaActual
  clearTimeout(debounce)
  pendienteConfig = () => guardarConfig(empresaId, config)
  debounce = setTimeout(() => {
    const f = pendienteConfig
    pendienteConfig = undefined
    void f?.()
  }, 400)
}

let debounceDatos: ReturnType<typeof setTimeout> | undefined
let pendienteDatos: (() => Promise<void>) | undefined
function persistirDatos(datos: DatosOperativos) {
  const empresaId = empresaActual
  clearTimeout(debounceDatos)
  pendienteDatos = () => guardarDatos(empresaId, datos)
  debounceDatos = setTimeout(() => {
    const f = pendienteDatos
    pendienteDatos = undefined
    void f?.()
  }, 400)
}

/** Fuerza la escritura de lo pendiente. Obligatorio antes de cambiar de empresa. */
async function vaciarPendientes(): Promise<void> {
  clearTimeout(debounce)
  clearTimeout(debounceDatos)
  const c = pendienteConfig
  const d = pendienteDatos
  pendienteConfig = undefined
  pendienteDatos = undefined
  await Promise.all([c?.(), d?.()])
}

/** Inserta o reemplaza por id en una lista inmutable. */
function upsert<T extends { id: string }>(lista: T[], item: T): T[] {
  const i = lista.findIndex((x) => x.id === item.id)
  if (i === -1) return [...lista, item]
  const copia = lista.slice()
  copia[i] = item
  return copia
}

export const useStore = create<Estado>((set, get) => ({
  loaded: false,
  empresasRecuperadas: 0,
  tema: 'claro',
  grupo: { version: 1, nombre: 'Mi grupo', empresas: [], participaciones: [], socios: [], empresaActivaId: '' },
  config: configuracionInicial(),
  datos: datosIniciales(),

  init: async () => {
    const tema = await cargarTema()
    let grupo = migrarGrupo(await cargarGrupo())
    // Si no había índice, cualquier espacio que aparezca luego es un huérfano y
    // hay que entrar en él, no en la empresa vacía que se acaba de crear.
    const sinIndicePrevio = !grupo

    if (!grupo) {
      // Primer arranque tras el cambio a multi-empresa: se crea el grupo con una
      // empresa y se traen a su espacio los datos de la versión de empresa única.
      const empresaId = nuevoId()
      const legado = await migrarDesdeEmpresaUnica(empresaId)
      const cfg = legado?.config
      grupo = grupoInicial({
        id: empresaId,
        razonSocial: cfg?.empresa?.razonSocial ?? '',
        cif: cfg?.empresa?.cif ?? '',
        esHolding: false,
        creadaEn: new Date().toISOString(),
      })
      await guardarGrupo(grupo)
    }

    // **Rescate de espacios huérfanos.** Si el índice del grupo se pierde y los
    // datos de cada empresa siguen en su sitio, sin esto no los vería nadie: el
    // índice se regenera vacío y `finanzas:datos:<id>` se queda ahí, intacto e
    // invisible. Se recuperan todos los espacios que no estén en el índice.
    const espacios = await espaciosGuardados()
    const enIndice = new Set(grupo.empresas.map((e) => e.id))
    const huerfanos = espacios.filter((e) => !enIndice.has(e.empresaId))
    if (huerfanos.length > 0) {
      grupo = {
        ...grupo,
        empresas: [
          ...grupo.empresas,
          ...huerfanos.map((h) => ({
            id: h.empresaId,
            razonSocial: h.razonSocial || 'Empresa recuperada',
            cif: h.cif,
            esHolding: false,
            creadaEn: new Date().toISOString(),
          })),
        ],
      }
      // La activa pasa a ser una que tenga datos: si se acaba de regenerar el
      // índice, la empresa «activa» es una recién creada y vacía, y entrar ahí
      // daría la falsa sensación de que no se ha recuperado nada.
      const conDatos = huerfanos.find((h) => h.tieneDatos)
      if (conDatos && sinIndicePrevio) grupo = { ...grupo, empresaActivaId: conDatos.empresaId }
      await guardarGrupo(grupo)
      set({ empresasRecuperadas: huerfanos.filter((h) => h.tieneDatos).length })
    }

    // La empresa activa guardada podría no existir (backup antiguo): cae a la primera.
    const activa = grupo.empresas.find((e) => e.id === grupo!.empresaActivaId) ?? grupo.empresas[0]
    if (!activa) {
      // Grupo sin empresas: se regenera uno vacío para no dejar la app sin espacio.
      const empresaId = nuevoId()
      grupo = grupoInicial({ id: empresaId, razonSocial: '', cif: '', esHolding: false, creadaEn: new Date().toISOString() })
      await guardarGrupo(grupo)
    }
    const empresaId = (grupo.empresas.find((e) => e.id === grupo!.empresaActivaId) ?? grupo.empresas[0]).id
    grupo = { ...grupo, empresaActivaId: empresaId }
    empresaActual = empresaId

    const [config, datos] = await Promise.all([cargarConfig(empresaId), cargarDatos(empresaId)])
    set({
      grupo,
      config: config ? migrarConfig(config) : configuracionInicial(),
      tema: tema ?? (prefiereOscuro() ? 'oscuro' : 'claro'),
      datos: datos ? { ...datosIniciales(), ...datos } : datosIniciales(),
      loaded: true,
    })
    // Si no había nada guardado, deja la config inicial persistida.
    if (!config) void guardarConfig(empresaId, get().config)
    // Copia de seguridad automática diaria (retención gestionada en la capa lib).
    void import('../lib/copias').then((m) => m.crearSnapshotDiario(get().config, get().datos, new Date().toISOString(), get().grupo))
  },

  cambiarEmpresa: async (empresaId) => {
    const grupo = get().grupo
    if (!grupo.empresas.some((e) => e.id === empresaId) || empresaId === grupo.empresaActivaId) return
    // Nada a medio escribir puede quedar colgando al soltar el espacio actual.
    await vaciarPendientes()
    empresaActual = empresaId

    const [config, datos] = await Promise.all([cargarConfig(empresaId), cargarDatos(empresaId)])
    const nuevoGrupo = { ...grupo, empresaActivaId: empresaId }
    set({
      grupo: nuevoGrupo,
      config: config ? migrarConfig(config) : configuracionInicial(),
      datos: datos ? { ...datosIniciales(), ...datos } : datosIniciales(),
    })
    await guardarGrupo(nuevoGrupo)
    if (!config) void guardarConfig(empresaId, get().config)
  },

  crearEmpresa: async ({ razonSocial, cif, esHolding }) => {
    await vaciarPendientes()
    const empresaId = nuevoId()
    const ficha: EmpresaResumen = { id: empresaId, razonSocial, cif, esHolding, creadaEn: new Date().toISOString() }

    // Espacio nuevo y limpio: plan contable e impuestos por defecto, cero operaciones.
    const config: Configuracion = { ...configuracionInicial(), empresa: { ...configuracionInicial().empresa, razonSocial, cif } }
    const datos = datosIniciales()
    await guardarConfig(empresaId, config)
    await guardarDatos(empresaId, datos)

    const grupo = { ...get().grupo, empresas: [...get().grupo.empresas, ficha], empresaActivaId: empresaId }
    empresaActual = empresaId
    set({ grupo, config, datos })
    await guardarGrupo(grupo)
    return empresaId
  },

  eliminarEmpresa: async (empresaId) => {
    const grupo = get().grupo
    if (grupo.empresas.length <= 1) return // nunca dejar el grupo sin empresas
    await vaciarPendientes()

    const empresas = grupo.empresas.filter((e) => e.id !== empresaId)
    // Al irse una empresa se van sus participaciones, en los dos sentidos.
    const participaciones = grupo.participaciones.filter((p) => p.matrizId !== empresaId && p.participadaId !== empresaId)
    const activa = grupo.empresaActivaId === empresaId ? empresas[0].id : grupo.empresaActivaId
    const nuevoGrupo = { ...grupo, empresas, participaciones, empresaActivaId: activa }

    await borrarEspacioEmpresa(empresaId)
    await guardarGrupo(nuevoGrupo)
    set({ grupo: nuevoGrupo })
    if (activa !== grupo.empresaActivaId) {
      empresaActual = activa
      const [config, datos] = await Promise.all([cargarConfig(activa), cargarDatos(activa)])
      set({
        config: config ? migrarConfig(config) : configuracionInicial(),
        datos: datos ? { ...datosIniciales(), ...datos } : datosIniciales(),
      })
    }
  },

  renombrarGrupo: (nombre) => {
    const grupo = { ...get().grupo, nombre }
    set({ grupo })
    void guardarGrupo(grupo)
  },

  guardarParticipacion: (p) => {
    const grupo = get().grupo
    const v = validarParticipacion(grupo, p)
    if (!v.valido) return { ok: false, motivo: v.motivo }
    const existe = grupo.participaciones.some((x) => x.id === p.id)
    const participaciones = existe ? grupo.participaciones.map((x) => (x.id === p.id ? p : x)) : [...grupo.participaciones, p]
    const nuevoGrupo = { ...grupo, participaciones }
    set({ grupo: nuevoGrupo })
    void guardarGrupo(nuevoGrupo)
    return { ok: true }
  },

  eliminarParticipacion: (id) => {
    const grupo = { ...get().grupo, participaciones: get().grupo.participaciones.filter((p) => p.id !== id) }
    set({ grupo })
    void guardarGrupo(grupo)
  },

  actualizarFichaEmpresa: (empresaId, parcial) => {
    const grupo = {
      ...get().grupo,
      empresas: get().grupo.empresas.map((e) => (e.id === empresaId ? { ...e, ...parcial } : e)),
    }
    set({ grupo })
    void guardarGrupo(grupo)
  },

  guardarSocio: (socio) => {
    const v = validarSocio(socio)
    if (!v.valido) return { ok: false, motivo: v.motivo }
    const grupo = { ...get().grupo, socios: upsert(get().grupo.socios, socio) }
    set({ grupo })
    void guardarGrupo(grupo)
    return { ok: true }
  },

  eliminarSocio: (id) => {
    const grupo = { ...get().grupo, socios: get().grupo.socios.filter((s) => s.id !== id) }
    set({ grupo })
    void guardarGrupo(grupo)
  },

  alternarTema: () => {
    const tema: Tema = get().tema === 'oscuro' ? 'claro' : 'oscuro'
    set({ tema })
    void guardarTema(tema)
  },

  actualizarConfig: (parcial) => {
    const config = { ...get().config, ...parcial }
    set({ config })
    persistirConDebounce(config)
    // La razón social y el CIF se editan en Configuración → Empresa; el índice
    // del grupo debe reflejarlo al instante (selector, organigrama, informes).
    if (parcial.empresa) sincronizarFichaGrupo(set, get, config)
  },

  reemplazarConfig: (config) => {
    set({ config })
    persistirConDebounce(config)
    sincronizarFichaGrupo(set, get, config)
  },

  guardarTercero: (t) => {
    const datos = { ...get().datos, terceros: upsert(get().datos.terceros, t) }
    set({ datos })
    persistirDatos(datos)
  },
  guardarVenta: (v) => {
    const datos = { ...get().datos, ventas: upsert(get().datos.ventas, v) }
    set({ datos })
    persistirDatos(datos)
  },
  anularVenta: (id) => {
    const ventas = get().datos.ventas.map((v) => (v.id === id ? { ...v, anuladoEn: new Date().toISOString() } : v))
    const datos = { ...get().datos, ventas }
    set({ datos })
    persistirDatos(datos)
  },
  guardarCompra: (c) => {
    const datos = { ...get().datos, compras: upsert(get().datos.compras, c) }
    set({ datos })
    persistirDatos(datos)
  },
  anularCompra: (id) => {
    const compras = get().datos.compras.map((c) => (c.id === id ? { ...c, anuladoEn: new Date().toISOString() } : c))
    const datos = { ...get().datos, compras }
    set({ datos })
    persistirDatos(datos)
  },
  guardarRecurrente: (r) => {
    const datos = { ...get().datos, recurrentes: upsert(get().datos.recurrentes, r) }
    set({ datos })
    persistirDatos(datos)
  },
  eliminarRecurrente: (id) => {
    const datos = { ...get().datos, recurrentes: get().datos.recurrentes.filter((r) => r.id !== id) }
    set({ datos })
    persistirDatos(datos)
  },

  guardarCuentaTesoreria: (c) => {
    const datos = { ...get().datos, cuentasTesoreria: upsert(get().datos.cuentasTesoreria, c) }
    set({ datos })
    persistirDatos(datos)
  },
  guardarMovimiento: (m) => {
    const datos = { ...get().datos, movimientos: upsert(get().datos.movimientos, m) }
    set({ datos })
    persistirDatos(datos)
  },
  anularMovimiento: (id) => {
    const movimientos = get().datos.movimientos.map((m) => (m.id === id ? { ...m, anuladoEn: new Date().toISOString() } : m))
    const datos = { ...get().datos, movimientos }
    set({ datos })
    persistirDatos(datos)
  },
  anularMovimientos: (ids) => {
    const aAnular = new Set(ids)
    if (aAnular.size === 0) return 0
    const sello = new Date().toISOString()
    let n = 0
    const movimientos = get().datos.movimientos.map((m) => {
      if (!aAnular.has(m.id) || m.anuladoEn) return m
      n++
      return { ...m, anuladoEn: sello }
    })
    if (n === 0) return 0
    const datos = { ...get().datos, movimientos }
    set({ datos })
    persistirDatos(datos)
    return n
  },
  importarMovimientos: (ms, nombreFichero) => {
    // Idempotencia: no duplica por (cuenta, fecha, importe, referencia).
    const existentes = new Set(
      get().datos.movimientos.map((m) => `${m.cuentaId}|${m.fecha}|${m.importe}|${m.referencia ?? ''}`),
    )
    const nuevos = ms.filter((m) => !existentes.has(`${m.cuentaId}|${m.fecha}|${m.importe}|${m.referencia ?? ''}`))
    if (nuevos.length === 0) return 0
    const importaciones = nombreFichero
      ? [
          ...get().datos.importaciones,
          {
            id: nuevoId(),
            fecha: new Date().toISOString(),
            destinoId: 'movimientos-banco',
            nombreFichero,
            ids: nuevos.map((m) => m.id),
          },
        ]
      : get().datos.importaciones
    const datos = { ...get().datos, movimientos: [...get().datos.movimientos, ...nuevos], importaciones }
    set({ datos })
    persistirDatos(datos)
    return nuevos.length
  },
  conciliarMovimiento: (id, conciliado) => {
    const movimientos = get().datos.movimientos.map((m) => (m.id === id ? { ...m, conciliado } : m))
    const datos = { ...get().datos, movimientos }
    set({ datos })
    persistirDatos(datos)
  },
  conciliarMovimientos: (ids, conciliado) => {
    const objetivo = new Set(ids)
    if (objetivo.size === 0) return 0
    let n = 0
    const movimientos = get().datos.movimientos.map((m) => {
      if (!objetivo.has(m.id) || m.conciliado === conciliado) return m
      n++
      return { ...m, conciliado }
    })
    if (n === 0) return 0
    const datos = { ...get().datos, movimientos }
    set({ datos })
    persistirDatos(datos)
    return n
  },
  guardarArqueo: (a) => {
    const datos = { ...get().datos, arqueos: upsert(get().datos.arqueos, a) }
    set({ datos })
    persistirDatos(datos)
  },

  guardarAlmacen: (a) => {
    const datos = { ...get().datos, almacenes: upsert(get().datos.almacenes, a) }
    set({ datos })
    persistirDatos(datos)
  },
  guardarArticulo: (a) => {
    const datos = { ...get().datos, articulos: upsert(get().datos.articulos, a) }
    set({ datos })
    persistirDatos(datos)
  },
  anularArticulo: (id) => {
    const articulos = get().datos.articulos.map((a) => (a.id === id ? { ...a, anuladoEn: new Date().toISOString() } : a))
    const datos = { ...get().datos, articulos }
    set({ datos })
    persistirDatos(datos)
  },
  guardarMovimientoStock: (m) => {
    const datos = { ...get().datos, movimientosStock: upsert(get().datos.movimientosStock, m) }
    set({ datos })
    persistirDatos(datos)
  },
  guardarMovimientosStock: (ms) => {
    const datos = { ...get().datos, movimientosStock: [...get().datos.movimientosStock, ...ms] }
    set({ datos })
    persistirDatos(datos)
  },
  anularMovimientoStock: (id) => {
    const movimientosStock = get().datos.movimientosStock.map((m) => (m.id === id ? { ...m, anuladoEn: new Date().toISOString() } : m))
    const datos = { ...get().datos, movimientosStock }
    set({ datos })
    persistirDatos(datos)
  },

  guardarPlantilla: (p) => {
    const config = { ...get().config, plantillasImportacion: upsert(get().config.plantillasImportacion, p) }
    set({ config })
    persistirConDebounce(config)
  },
  eliminarPlantilla: (id) => {
    const config = { ...get().config, plantillasImportacion: get().config.plantillasImportacion.filter((p) => p.id !== id) }
    set({ config })
    persistirConDebounce(config)
  },
  aplicarImportacion: (destinoId, entidades, nombreFichero) => {
    const coleccion = COLECCION_DESTINO[destinoId]
    const lote: LoteImportacion = { id: 'lote-' + Math.random().toString(36).slice(2), fecha: new Date().toISOString(), destinoId, nombreFichero, ids: entidades.map((e) => e.id) }
    const datos = { ...get().datos }
    if (coleccion) {
      datos[coleccion] = [...(datos[coleccion] as { id: string }[]), ...entidades] as any
    }
    datos.importaciones = [...datos.importaciones, lote]
    set({ datos })
    persistirDatos(datos)
    return lote
  },
  deshacerImportacion: (loteId) => {
    const lote = get().datos.importaciones.find((l) => l.id === loteId)
    if (!lote) return
    const coleccion = COLECCION_DESTINO[lote.destinoId]
    const ids = new Set(lote.ids)
    const datos = { ...get().datos }
    if (coleccion) {
      datos[coleccion] = (datos[coleccion] as { id: string }[]).filter((x) => !ids.has(x.id)) as any
    }
    datos.importaciones = datos.importaciones.filter((l) => l.id !== loteId)
    set({ datos })
    persistirDatos(datos)
  },

  guardarDeuda: (d) => {
    const datos = { ...get().datos, deudas: upsert(get().datos.deudas, d) }
    set({ datos })
    persistirDatos(datos)
  },
  anularDeuda: (id) => {
    const deudas = get().datos.deudas.map((x) => (x.id === id ? { ...x, anuladoEn: new Date().toISOString() } : x))
    const datos = { ...get().datos, deudas }
    set({ datos })
    persistirDatos(datos)
  },
  guardarRenting: (r) => {
    const datos = { ...get().datos, rentings: upsert(get().datos.rentings, r) }
    set({ datos })
    persistirDatos(datos)
  },
  anularRenting: (id) => {
    const rentings = get().datos.rentings.map((x) => (x.id === id ? { ...x, anuladoEn: new Date().toISOString() } : x))
    const datos = { ...get().datos, rentings }
    set({ datos })
    persistirDatos(datos)
  },
  guardarPoliza: (p) => {
    const datos = { ...get().datos, polizas: upsert(get().datos.polizas, p) }
    set({ datos })
    persistirDatos(datos)
  },
  anularPoliza: (id) => {
    const polizas = get().datos.polizas.map((x) => (x.id === id ? { ...x, anuladoEn: new Date().toISOString() } : x))
    const datos = { ...get().datos, polizas }
    set({ datos })
    persistirDatos(datos)
  },
  guardarTarjetaCredito: (t) => {
    const datos = { ...get().datos, tarjetasCredito: upsert(get().datos.tarjetasCredito, t) }
    set({ datos })
    persistirDatos(datos)
  },
  anularTarjetaCredito: (id) => {
    const tarjetasCredito = get().datos.tarjetasCredito.map((x) => (x.id === id ? { ...x, anuladoEn: new Date().toISOString() } : x))
    const datos = { ...get().datos, tarjetasCredito }
    set({ datos })
    persistirDatos(datos)
  },
  guardarDeudor: (d) => {
    const datos = { ...get().datos, deudores: upsert(get().datos.deudores, d) }
    set({ datos })
    persistirDatos(datos)
  },
  anularDeudor: (id) => {
    const deudores = get().datos.deudores.map((x) => (x.id === id ? { ...x, anuladoEn: new Date().toISOString() } : x))
    const datos = { ...get().datos, deudores }
    set({ datos })
    persistirDatos(datos)
  },
  guardarPresupuesto: (p) => {
    const datos = { ...get().datos, presupuestos: upsert(get().datos.presupuestos, p) }
    set({ datos })
    persistirDatos(datos)
  },

  guardarInversion: (i) => {
    const datos = { ...get().datos, inversiones: upsert(get().datos.inversiones, i) }
    set({ datos })
    persistirDatos(datos)
  },
  anularInversion: (id) => {
    const sello = new Date().toISOString()
    const datos = {
      ...get().datos,
      inversiones: get().datos.inversiones.map((x) => (x.id === id ? { ...x, anuladoEn: sello } : x)),
    }
    set({ datos })
    persistirDatos(datos)
  },
  guardarOperacionInversion: (o) => {
    const datos = { ...get().datos, operacionesInversion: upsert(get().datos.operacionesInversion, o) }
    set({ datos })
    persistirDatos(datos)
  },
  anularOperacionInversion: (id) => {
    const sello = new Date().toISOString()
    const datos = {
      ...get().datos,
      operacionesInversion: get().datos.operacionesInversion.map((x) => (x.id === id ? { ...x, anuladoEn: sello } : x)),
    }
    set({ datos })
    persistirDatos(datos)
  },
  guardarValoracionInversion: (v) => {
    const datos = { ...get().datos, valoracionesInversion: upsert(get().datos.valoracionesInversion, v) }
    set({ datos })
    persistirDatos(datos)
  },
  anularValoracionInversion: (id) => {
    const sello = new Date().toISOString()
    const datos = {
      ...get().datos,
      valoracionesInversion: get().datos.valoracionesInversion.map((x) => (x.id === id ? { ...x, anuladoEn: sello } : x)),
    }
    set({ datos })
    persistirDatos(datos)
  },

  guardarConector: (c) => {
    const config = { ...get().config, conectores: upsert(get().config.conectores, c) }
    set({ config })
    persistirConDebounce(config)
  },
  eliminarConector: (id) => {
    const config = { ...get().config, conectores: get().config.conectores.filter((c) => c.id !== id) }
    set({ config })
    persistirConDebounce(config)
  },
  guardarLogSync: (l) => {
    const datos = { ...get().datos, logsSync: [l, ...get().datos.logsSync].slice(0, 100) }
    set({ datos })
    persistirDatos(datos)
  },
  reemplazarDatos: (d) => {
    set({ datos: d })
    persistirDatos(d)
  },
  restaurarTodo: (config, datos) => {
    // Restaura SOLO en el espacio de la empresa activa: un backup nunca puede
    // sobrescribir la contabilidad de otra sociedad del grupo.
    const c = migrarConfig(config)
    const d = { ...datosIniciales(), ...datos }
    set({ config: c, datos: d })
    void guardarConfig(empresaActual, c)
    void guardarDatos(empresaActual, d)
    sincronizarFichaGrupo(set, get, c)
  },
}))

/**
 * Correcciones de criterio que SÍ deben llegar a los datos ya guardados.
 *
 * Cambiar un valor por defecto no basta: `fusionarCategorias` respeta la copia
 * guardada del usuario, así que una categoría que ya existe se queda como
 * estaba. Para un cambio de criterio contable hay que corregirla expresamente,
 * y **solo si sigue teniendo el valor antiguo**: si el usuario la ha tocado,
 * manda lo suyo.
 */
const CORRECCIONES: { id: string; de: Partial<Configuracion['categoriasGasto'][number]>; a: Partial<Configuracion['categoriasGasto'][number]> }[] = [
  // La Seguridad Social pasó de financiación a gasto: sin módulo de personal,
  // el pago a la TGSS es el único registro de la cuota patronal, que es coste.
  { id: 'cat-bco-seg-social', de: { efectoPresupuesto: 'FINANCIACION', cuentaPGC: '476' }, a: { efectoPresupuesto: 'GASTO', cuentaPGC: '642' } },
]

function aplicarCorrecciones(cats: Configuracion['categoriasGasto']): Configuracion['categoriasGasto'] {
  return cats.map((c) => {
    const corr = CORRECCIONES.find((x) => x.id === c.id)
    if (!corr) return c
    const sigueIgual = Object.entries(corr.de).every(([k, v]) => (c as unknown as Record<string, unknown>)[k] === v)
    return sigueIgual ? { ...c, ...corr.a } : c
  })
}

/**
 * Une las categorías guardadas con las de fábrica: respeta lo que el usuario
 * haya cambiado o creado (manda su versión) y añade las nuevas que aún no
 * tenga. Así una lista ampliada llega a quien ya tenía datos sin pisar nada.
 */
export function fusionarCategorias(
  guardadas: Configuracion['categoriasGasto'] | undefined,
  defecto: Configuracion['categoriasGasto'],
): Configuracion['categoriasGasto'] {
  if (!guardadas || guardadas.length === 0) return defecto
  const corregidas = aplicarCorrecciones(guardadas)
  const porId = new Map(corregidas.map((c) => [c.id, c]))
  const nuevas = defecto.filter((c) => !porId.has(c.id))
  return [...corregidas, ...nuevas].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))
}

/**
 * Igual que con las categorías: manda lo que el usuario haya cambiado (nombre,
 * tipo, fecha de cierre) y se añaden los puntos de venta de fábrica que aún no
 * tenga. Los ids de los de fábrica son fijos, así que esto no duplica nada.
 */
function fusionarCentros(
  guardados: Configuracion['centrosCoste'] | undefined,
  defecto: Configuracion['centrosCoste'],
): Configuracion['centrosCoste'] {
  if (!guardados || guardados.length === 0) return defecto
  const porId = new Set(guardados.map((c) => c.id))
  return [...guardados, ...defecto.filter((c) => !porId.has(c.id))]
}

/** Rellena los campos que no existían en versiones anteriores del grupo guardado. */
function migrarGrupo(g: Grupo | undefined): Grupo | undefined {
  if (!g) return undefined
  return { ...g, socios: g.socios ?? [], participaciones: g.participaciones ?? [], empresas: g.empresas ?? [] }
}

/** Mantiene el índice del grupo alineado con la configuración de la empresa activa. */
function sincronizarFichaGrupo(
  set: (parcial: Partial<Estado>) => void,
  get: () => Estado,
  config: Configuracion,
): void {
  const grupo = get().grupo
  const ficha = grupo.empresas.find((e) => e.id === grupo.empresaActivaId)
  if (!ficha) return
  const razonSocial = config.empresa.razonSocial
  const cif = config.empresa.cif
  if (ficha.razonSocial === razonSocial && ficha.cif === cif) return
  const nuevoGrupo = {
    ...grupo,
    empresas: grupo.empresas.map((e) => (e.id === grupo.empresaActivaId ? { ...e, razonSocial, cif } : e)),
  }
  set({ grupo: nuevoGrupo })
  void guardarGrupo(nuevoGrupo)
}

function prefiereOscuro(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

/** Rellena campos ausentes en configuraciones guardadas con versiones anteriores. */
function migrarConfig(c: Partial<Configuracion>): Configuracion {
  const base = configuracionInicial()
  return {
    empresa: { ...base.empresa, ...c.empresa },
    centrosCoste: fusionarCentros(c.centrosCoste, base.centrosCoste),
    tarjetas: c.tarjetas?.length ? c.tarjetas : base.tarjetas,
    datafonos: c.datafonos?.length ? c.datafonos : base.datafonos,
    planContable: c.planContable ?? base.planContable,
    tiposIva: c.tiposIva ?? base.tiposIva,
    impuestosEspeciales: c.impuestosEspeciales ?? base.impuestosEspeciales,
    obligacionesFiscales: c.obligacionesFiscales ?? base.obligacionesFiscales,
    categoriasGasto: fusionarCategorias(c.categoriasGasto, base.categoriasGasto),
    umbrales: { ...base.umbrales, ...c.umbrales },
    apariencia: { ...base.apariencia, ...c.apariencia },
    plantillasImportacion: c.plantillasImportacion ?? base.plantillasImportacion,
    conectores: c.conectores ?? base.conectores,
  }
}
