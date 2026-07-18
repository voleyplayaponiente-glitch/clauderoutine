import { BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { datosCuadrante, datosResumenCentros } from './export-data'
import { DIAS_SEMANA, MESES, isoALocal, numEs, hoyIso } from '../../shared/fechas'
import type { Turno } from '../../shared/types'

const SITUACIONES: Record<string, string> = {
  trabaja: 'Trabaja',
  libre: 'Libre',
  vacaciones: 'Vacaciones',
  baja: 'Baja',
  festivo: 'Festivo',
  permiso: 'Permiso'
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'
  )
}

function horario(t: Turno): string {
  const tr: string[] = []
  if (t.entrada1 && t.salida1) tr.push(`${t.entrada1}–${t.salida1}`)
  if (t.entrada2 && t.salida2) tr.push(`${t.entrada2}–${t.salida2}`)
  return tr.join(' / ')
}

const ESTILOS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #111; margin: 24px; font-size: 11px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  h2 { font-size: 13px; margin: 0 0 10px; font-weight: 600; color: #444; }
  .cab { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
  .datos { font-size: 11px; line-height: 1.5; }
  table { width:100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 3px 6px; text-align: left; }
  th { background:#e5e7eb; font-size:10px; }
  td.num, th.num { text-align:right; }
  tr.total td { font-weight:700; background:#f1f5f9; }
  .resumen { margin-top:10px; font-size:11px; }
  .resumen span { display:inline-block; margin-right:18px; }
  .clausula { margin-top:18px; font-size:10px; color:#333; }
  .firmas { display:flex; gap:40px; margin-top:36px; }
  .firma { flex:1; border-top:1px solid #111; padding-top:6px; font-size:10px; text-align:center; }
  .sello { max-height:70px; margin-top:6px; }
  .find { color:#b91c1c; }
`

function htmlCuadrante(trabajadorId: number, anio: number, mes: number): string {
  const d = datosCuadrante(trabajadorId, anio, mes)
  const filas = d.turnos
    .map((t) => {
      const h = d.horasDiaFn(t)
      const centro = t.centro_id ? d.centrosPorId[t.centro_id]?.nombre ?? '' : ''
      return `<tr>
        <td>${Number(t.fecha.slice(-2))}</td>
        <td>${isoALocal(t.fecha)}</td>
        <td>${DIAS_SEMANA[t.dia_semana]}</td>
        <td>${esc(SITUACIONES[t.situacion] ?? t.situacion)}</td>
        <td>${esc(centro)}</td>
        <td>${esc(horario(t))}</td>
        <td class="num">${h > 0 ? numEs(h) : ''}</td>
      </tr>`
    })
    .join('')

  const sello = d.empresa.sello_imagen
    ? `<img class="sello" src="${d.empresa.sello_imagen}" alt="Sello"/>`
    : ''

  const complementarias =
    d.trabajador.tipo === 'ajena'
      ? `<span>Horas complementarias: <b>${numEs(d.resumen.horasComplementarias)}</b></span>
         <span>Valor: <b>${numEs(d.resumen.valorComplementarias)} €</b></span>`
      : `<span><i>Trabajador/a autónomo/a (sin horas complementarias ni jornada de cuenta ajena)</i></span>`

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${ESTILOS}</style></head>
  <body>
    <div class="cab">
      <div class="datos">
        <h1>${esc(d.empresa.razon_social)}</h1>
        <h2>Cuadrante horario — ${MESES[mes - 1]} ${anio}</h2>
        <div>CIF: ${esc(d.empresa.cif)}</div>
        <div><b>Trabajador/a:</b> ${esc(d.trabajador.nombre)} ${esc(d.trabajador.apellidos)}</div>
        <div><b>DNI/NIE:</b> ${esc(d.trabajador.dni_nie)} · <b>NSS:</b> ${esc(d.trabajador.nss)}</div>
      </div>
      <div class="datos" style="text-align:right">
        <div><b>Fecha de entrega:</b> ${isoALocal(hoyIso())}</div>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>Día</th><th>Fecha</th><th>Día semana</th><th>Situación</th>
        <th>Centro</th><th>Horario</th><th class="num">Horas</th>
      </tr></thead>
      <tbody>
        ${filas}
        <tr class="total"><td colspan="6">TOTAL HORAS</td><td class="num">${numEs(d.resumen.horasRealizadas)}</td></tr>
      </tbody>
    </table>
    <div class="resumen">
      <span>Media mensual teórica: <b>${numEs(d.resumen.mediaMensualTeorica)}</b></span>
      <span>Horas contratadas (mes): <b>${numEs(d.resumen.horasContratadasMes)}</b></span>
      <span>Desviación vs. media: <b>${numEs(d.resumen.desviacionVsMedia)}</b></span>
      <br/>${complementarias}
    </div>
    <div class="clausula">
      <b>RECIBÍ Y ACEPTO.</b> El/la trabajador/a declara haber recibido el presente cuadrante horario
      correspondiente al mes indicado, que refleja la jornada prevista, y presta su conformidad. Documento
      válido a efectos del registro de jornada (art. 34.9 del Estatuto de los Trabajadores).
    </div>
    <div class="firmas">
      <div class="firma">La empresa${sello}</div>
      <div class="firma">El/la trabajador/a<br/><br/><br/></div>
    </div>
  </body></html>`
}

function htmlResumenCentros(empresaId: number, anio: number, mes: number): string {
  const d = datosResumenCentros(empresaId, anio, mes)
  const filas = d.filas
    .map(
      (f) => `<tr>
        <td>${esc(f.centro.codigo)}</td>
        <td>${esc(f.centro.nombre)}</td>
        <td class="num">${f.trabajadores}</td>
        <td class="num">${numEs(f.horas)}</td>
      </tr>`
    )
    .join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${ESTILOS}</style></head>
  <body>
    <h1>${esc(d.empresa.razon_social)}</h1>
    <h2>Resumen de horas por centro — ${MESES[mes - 1]} ${anio}</h2>
    <table>
      <thead><tr><th>Código</th><th>Centro</th><th class="num">Nº trabajadores</th><th class="num">Horas</th></tr></thead>
      <tbody>${filas}
        <tr class="total"><td colspan="3">TOTAL</td><td class="num">${numEs(d.totalHoras)}</td></tr>
      </tbody>
    </table>
  </body></html>`
}

async function generarPdf(html: string, defaultName: string) {
  const res = await dialog.showSaveDialog({
    title: 'Guardar PDF',
    defaultPath: defaultName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false }

  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'default' },
      pageSize: 'A4'
    })
    writeFileSync(res.filePath, pdf)
    return { ok: true, ruta: res.filePath }
  } finally {
    win.destroy()
  }
}

export function exportarCuadrantePdf(trabajadorId: number, anio: number, mes: number) {
  const d = datosCuadrante(trabajadorId, anio, mes)
  const name = `cuadrante-${d.trabajador.apellidos}-${anio}-${String(mes).padStart(2, '0')}.pdf`
  return generarPdf(htmlCuadrante(trabajadorId, anio, mes), name)
}

export function exportarResumenCentrosPdf(empresaId: number, anio: number, mes: number) {
  return generarPdf(
    htmlResumenCentros(empresaId, anio, mes),
    `resumen-centros-${anio}-${String(mes).padStart(2, '0')}.pdf`
  )
}
