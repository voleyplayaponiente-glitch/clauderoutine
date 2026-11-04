/**
 * Subida automática al servidor de copias, probada en el store de verdad
 * (IndexedDB y red simulados).
 *
 * Fija los dos fallos que dejaron al usuario sin copias:
 *  1. el temporizador subía los datos de la empresa ACTIVA en la carpeta de la
 *     empresa del cambio (cambiar de sociedad a tiempo cruzaba los datos);
 *  2. cerrar la app antes de que venciera perdía la subida para siempre.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const disco = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: async (k: string) => structuredClone(disco.get(k)),
  set: async (k: string, v: unknown) => {
    disco.set(k, structuredClone(v))
  },
  del: async (k: string) => {
    disco.delete(k)
  },
  keys: async () => [...disco.keys()],
}))

interface Subida {
  empresaId: string
  razonSocial: string
  terceros: number
}
let subidas: Subida[] = []
let fallarRed = false

function instalarRed() {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (fallarRed) throw new Error('Failed to fetch')
    const m = /\/api\/copias\/([^/]+)$/.exec(url)
    if (m && init?.method === 'PUT') {
      const b = JSON.parse(String(init.body))
      subidas.push({ empresaId: decodeURIComponent(m[1]), razonSocial: b.config.empresa.razonSocial, terceros: b.datos.terceros.length })
      return new Response(JSON.stringify({ fecha: '2026-11-04', bytes: 100 }), { status: 200 })
    }
    return new Response('{}', { status: 404 })
  })
}

async function arrancar() {
  vi.resetModules()
  const { useStore } = await import('./store')
  await useStore.getState().init()
  return useStore
}

/** Deja correr los temporizadores y las promesas que encadenan. */
async function pasar(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  // La subida carga `lib/copias-remotas` con import(): eso es E/S de verdad y
  // no avanza con los relojes falsos.
  for (let i = 0; i < 5; i++) {
    await vi.dynamicImportSettled()
    await vi.advanceTimersByTimeAsync(0)
  }
}

const tercero = (id: string) => ({ id, tipo: 'PROVEEDOR', nombre: id, nif: '' }) as never

describe('copia automática en el servidor', () => {
  beforeEach(() => {
    disco.clear()
    subidas = []
    fallarRed = false
    vi.useFakeTimers()
    instalarRed()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('cada empresa se sube con SUS datos aunque se cambie de empresa antes de subir', async () => {
    const store = await arrancar()
    const s = store.getState()
    s.actualizarConfig({ empresa: { ...s.config.empresa, razonSocial: 'BESPAIN 7777 SLU' } })
    const bespain = store.getState().grupo.empresaActivaId
    await store.getState().crearEmpresa({ razonSocial: 'BTC EMBASSY', cif: '', esHolding: true })
    const btc = store.getState().grupo.empresaActivaId
    store.getState().actualizarServidorCopias({ activo: true, automatico: true, url: 'http://192.168.1.20:3011', secreto: 'x' })
    await pasar(3_000)
    subidas = []

    // Cambio en BESPAIN y, antes de que se suba, se pasa a BTC.
    await store.getState().cambiarEmpresa(bespain)
    store.getState().guardarTercero(tercero('t1'))
    store.getState().guardarTercero(tercero('t2'))
    await store.getState().cambiarEmpresa(btc)
    await pasar(31_000)

    const deBespain = subidas.filter((x) => x.empresaId === bespain)
    expect(deBespain.length).toBeGreaterThan(0)
    for (const x of deBespain) {
      expect(x.razonSocial).toBe('BESPAIN 7777 SLU')
      expect(x.terceros).toBe(2)
    }
    // Y a la carpeta de BTC no ha ido nada de BESPAIN.
    expect(subidas.filter((x) => x.empresaId === btc && x.razonSocial !== 'BTC EMBASSY')).toEqual([])
  })

  it('un cambio que no llegó a subirse se sube al volver a abrir la app', async () => {
    let store = await arrancar()
    store.getState().actualizarServidorCopias({ activo: true, automatico: true, url: 'http://192.168.1.20:3011', secreto: 'x' })
    store.getState().actualizarConfig({ empresa: { ...store.getState().config.empresa, razonSocial: 'SUA BEAUTY 7777 SLU' } })
    store.getState().guardarTercero(tercero('t1'))
    const empresa = store.getState().grupo.empresaActivaId
    // Se «cierra» la pestaña a los 10 s: el temporizador nunca vence.
    await pasar(10_000)
    expect(subidas).toEqual([])

    vi.clearAllTimers()
    store = await arrancar()
    expect(store.getState().estadoCopias[empresa]?.cambio).toBeDefined()
    await pasar(6_000)
    expect(subidas.map((x) => x.empresaId)).toContain(empresa)
    expect(store.getState().estadoCopias[empresa]?.cambio).toBeUndefined()
    expect(store.getState().estadoCopias[empresa]?.subida).toBeDefined()
  })

  it('si el servidor no responde, el cambio sigue pendiente y se reintenta solo', async () => {
    const store = await arrancar()
    store.getState().actualizarServidorCopias({ activo: true, automatico: true, url: 'http://192.168.1.20:3011', secreto: 'x' })
    await pasar(3_000)
    fallarRed = true
    store.getState().actualizarConfig({ empresa: { ...store.getState().config.empresa, razonSocial: 'BESPAIN 7777 SLU' } })
    const empresa = store.getState().grupo.empresaActivaId
    await pasar(31_000)
    expect(store.getState().estadoCopias[empresa]?.error).toBe('Failed to fetch')
    expect(store.getState().estadoCopias[empresa]?.cambio).toBeDefined()

    fallarRed = false
    store.getState().guardarTercero(tercero('t1'))
    await pasar(31_000)
    expect(subidas.some((x) => x.empresaId === empresa && x.terceros === 1)).toBe(true)
    expect(store.getState().estadoCopias[empresa]?.error).toBeUndefined()
  })

  it('los datos que había antes de esta versión, sin marca, se suben una vez al arrancar', async () => {
    disco.set('finanzas:grupo', { version: 1, nombre: 'G', empresas: [{ id: 'e1', razonSocial: 'BESPAIN', cif: '', esHolding: false, creadaEn: '' }], participaciones: [], socios: [], empresaActivaId: 'e1' })
    disco.set('finanzas:config:e1', { empresa: { razonSocial: 'BESPAIN', cif: '' } })
    disco.set('finanzas:datos:e1', { terceros: [tercero('t1')] })
    disco.set('finanzas:servidor-copias', { activo: true, automatico: true, url: 'http://192.168.1.20:3011', secreto: 'x' })
    await arrancar()
    await pasar(6_000)
    expect(subidas).toEqual([{ empresaId: 'e1', razonSocial: 'BESPAIN', terceros: 1 }])
  })

  it('una empresa vacía no se sube ni deja un aviso colgado', async () => {
    const store = await arrancar()
    store.getState().actualizarServidorCopias({ activo: true, automatico: true, url: 'http://192.168.1.20:3011', secreto: 'x' })
    store.getState().alternarTema()
    store.getState().reemplazarDatos(store.getState().datos)
    const empresa = store.getState().grupo.empresaActivaId
    await pasar(31_000)
    expect(subidas).toEqual([])
    expect(store.getState().estadoCopias[empresa]?.cambio).toBeUndefined()
  })
})
