// Implementación de window.api para la versión WEB: habla con el servidor por HTTP
// en vez de por IPC de Electron. Mantiene exactamente la misma forma que la API de
// escritorio para que las pantallas no cambien.
import type { ApiGestor } from '@shared/api'

async function rpc<T>(channel: string, ...args: unknown[]): Promise<T> {
  const r = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel, args })
  })
  if (r.status === 401) {
    document.dispatchEvent(new CustomEvent('gestor-no-autenticado'))
    throw new Error('No autenticado')
  }
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error || 'Error del servidor')
  return data.result as T
}

function descargar(url: string): void {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function subirBackup(): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.db'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve({ ok: false })
      try {
        const r = await fetch('/api/backup/upload', {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
          body: await file.arrayBuffer()
        })
        const data = await r.json().catch(() => ({}))
        resolve(r.ok ? { ok: true } : { ok: false, error: data?.error })
      } catch (e) {
        resolve({ ok: false, error: (e as Error).message })
      }
    }
    input.click()
  })
}

export const webApi: ApiGestor = {
  empresas: {
    listar: () => rpc('empresas:listar'),
    obtener: (id) => rpc('empresas:obtener', id),
    crear: (d) => rpc('empresas:crear', d),
    actualizar: (id, d) => rpc('empresas:actualizar', id, d),
    borrar: (id) => rpc('empresas:borrar', id)
  },
  centros: {
    listar: (empresaId) => rpc('centros:listar', empresaId),
    obtener: (id) => rpc('centros:obtener', id),
    crear: (d) => rpc('centros:crear', d),
    actualizar: (id, d) => rpc('centros:actualizar', id, d),
    borrar: (id) => rpc('centros:borrar', id)
  },
  festivos: {
    listar: (centroId) => rpc('festivos:listar', centroId),
    listarEmpresa: (empresaId) => rpc('festivos:listarEmpresa', empresaId),
    crear: (centroId, fecha, desc) => rpc('festivos:crear', centroId, fecha, desc),
    borrar: (id) => rpc('festivos:borrar', id)
  },
  trabajadores: {
    listar: (f = {}) => rpc('trabajadores:listar', f),
    obtener: (id) => rpc('trabajadores:obtener', id),
    crear: (d) => rpc('trabajadores:crear', d),
    actualizar: (id, d) => rpc('trabajadores:actualizar', id, d),
    borrar: (id) => rpc('trabajadores:borrar', id),
    centrosDe: (id) => rpc('trabajadores:centrosDe', id),
    fijarCentros: (id, asignaciones) => rpc('trabajadores:fijarCentros', id, asignaciones)
  },
  cuadrante: {
    obtenerOCrear: (trabId, anio, mes) => rpc('cuadrante:obtenerOCrear', trabId, anio, mes),
    turnos: (cuadranteId) => rpc('cuadrante:turnos', cuadranteId),
    guardarTurno: (t) => rpc('cuadrante:guardarTurno', t),
    guardarTurnos: (lista) => rpc('cuadrante:guardarTurnos', lista),
    fijarEntrega: (cuadranteId, fecha) => rpc('cuadrante:fijarEntrega', cuadranteId, fecha),
    turnosMesEmpresa: (empresaId, anio, mes) => rpc('cuadrante:turnosMesEmpresa', empresaId, anio, mes)
  },
  exportar: {
    cuadrantePdf: async (trabId, anio, mes) => {
      window.open(`/api/export/cuadrante-pdf?trab=${trabId}&anio=${anio}&mes=${mes}`, '_blank')
      return { ok: true }
    },
    cuadranteExcel: async (trabId, anio, mes) => {
      descargar(`/api/export/cuadrante-excel?trab=${trabId}&anio=${anio}&mes=${mes}`)
      return { ok: true }
    },
    resumenPdf: async (empresaId, anio, mes) => {
      window.open(`/api/export/resumen-pdf?empresa=${empresaId}&anio=${anio}&mes=${mes}`, '_blank')
      return { ok: true }
    },
    resumenExcel: async (empresaId, anio, mes) => {
      descargar(`/api/export/resumen-excel?empresa=${empresaId}&anio=${anio}&mes=${mes}`)
      return { ok: true }
    }
  },
  backup: {
    exportar: async () => {
      descargar('/api/backup/download')
      return { ok: true }
    },
    importar: () => subirBackup()
  },
  app: {
    rutaBaseDatos: () => rpc('app:rutaBaseDatos')
  }
}
