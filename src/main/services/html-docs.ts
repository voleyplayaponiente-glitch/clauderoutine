// Generadores de HTML de los documentos (cuadrante firmado y resumen por centro).
// Sin dependencias de Electron: los usa tanto la exportación PDF de escritorio
// (printToPDF) como el servidor web (página imprimible desde el navegador).
import { datosCuadrante, datosResumenCentros, datosCuadranteCentros } from './export-data'
import {
  DIAS_SEMANA,
  DIAS_SEMANA_CORTO,
  MESES,
  isoALocal,
  numEs,
  hoyIso,
  diaSemanaIso
} from '../../shared/fechas'
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
  @media print { .noprint { display:none; } body { margin: 0; } }
  .noprint { position: fixed; top: 12px; right: 12px; }
  .noprint button { font-size: 13px; padding: 8px 14px; border-radius: 8px; border: 1px solid #0071e3; background: #0071e3; color: #fff; cursor: pointer; }
`

const BOTON_IMPRIMIR = `<div class="noprint"><button onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button></div>`

export function htmlCuadrante(trabajadorId: number, anio: number, mes: number, conBoton = false): string {
  const d = datosCuadrante(trabajadorId, anio, mes)
  const filas = d.turnos
    .map((t) => {
      const h = d.horasDiaFn(t)
      // Centro y horario solo tienen sentido cuando el trabajador trabaja ese día;
      // en Libre/Vacaciones/Baja/Festivo/Permiso se dejan en blanco para no confundir.
      const trabaja = t.situacion === 'trabaja'
      const centro = trabaja && t.centro_id ? d.centrosPorId[t.centro_id]?.nombre ?? '' : ''
      return `<tr>
        <td>${Number(t.fecha.slice(-2))}</td>
        <td>${isoALocal(t.fecha)}</td>
        <td>${DIAS_SEMANA[t.dia_semana]}</td>
        <td>${esc(SITUACIONES[t.situacion] ?? t.situacion)}</td>
        <td>${esc(centro)}</td>
        <td>${esc(trabaja ? horario(t) : '')}</td>
        <td class="num">${h > 0 ? numEs(h) : ''}</td>
      </tr>`
    })
    .join('')

  const sello = d.empresa.sello_imagen
    ? `<img class="sello" src="${esc(d.empresa.sello_imagen)}" alt="Sello"/>`
    : ''

  const complementarias =
    d.trabajador.tipo === 'ajena'
      ? `<span>Horas complementarias: <b>${numEs(d.resumen.horasComplementarias)}</b></span>
         <span>Valor: <b>${numEs(d.resumen.valorComplementarias)} €</b></span>`
      : `<span><i>Trabajador/a autónomo/a (sin horas complementarias ni jornada de cuenta ajena)</i></span>`

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cuadrante ${esc(d.trabajador.apellidos)} ${MESES[mes - 1]} ${anio}</title><style>${ESTILOS}</style></head>
  <body>
    ${conBoton ? BOTON_IMPRIMIR : ''}
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

export function htmlResumenCentros(empresaId: number, anio: number, mes: number, conBoton = false): string {
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
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resumen centros ${MESES[mes - 1]} ${anio}</title><style>${ESTILOS}</style></head>
  <body>
    ${conBoton ? BOTON_IMPRIMIR : ''}
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

/** Calendario mensual por centros: la vista por centro de la agenda, imprimible. */
export function htmlCuadranteCentros(
  empresaId: number,
  anio: number,
  mes: number,
  conBoton = false
): string {
  const d = datosCuadranteCentros(empresaId, anio, mes)
  const mm = String(mes).padStart(2, '0')
  const totalDias = new Date(anio, mes, 0).getDate()
  const cab = d.centros
    .map((c) => `<th><span class="cua" style="background:${esc(c.color)}"></span> ${esc(c.nombre)}</th>`)
    .join('')
  let cuerpo = ''
  for (let dia = 1; dia <= totalDias; dia++) {
    const fecha = `${anio}-${mm}-${String(dia).padStart(2, '0')}`
    const dw = diaSemanaIso(fecha)
    const finde = dw === 0 || dw === 6 ? ' class="finde"' : ''
    const celdas = d.centros
      .map((c) => {
        const lst = d.porDiaCentro.get(`${fecha}|${c.id}`) ?? []
        const contenido = lst
          .map((t) => {
            const info = d.trabajadoresPorId[t.trabajador_id]
            const horario = [
              t.entrada1 && t.salida1 ? `${t.entrada1}–${t.salida1}` : '',
              t.entrada2 && t.salida2 ? `${t.entrada2}–${t.salida2}` : ''
            ]
              .filter(Boolean)
              .join(' / ')
            return `<span class="turno"><span class="pill" style="background:${esc(info?.color ?? '#888')}">${esc(
              info?.nombre ?? '?'
            )}</span> <span class="hor">${esc(horario)}</span></span>`
          })
          .join(' ')
        return `<td${finde}>${contenido}</td>`
      })
      .join('')
    cuerpo += `<tr><td${finde}><b>${dia}</b> ${DIAS_SEMANA_CORTO[dw]}</td>${celdas}</tr>`
  }
  const totales = d.centros
    .map((c) => `<td class="num"><b>${numEs(d.horasPorCentro[c.id] ?? 0)}</b></td>`)
    .join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cuadrante por centros ${MESES[mes - 1]} ${anio}</title><style>${ESTILOS}
  table { table-layout: fixed; }
  th:first-child, td:first-child { width: 70px; }
  td { font-size: 10px; }
  td.finde { background: #f1f5f9; }
  .cua { display:inline-block; width:9px; height:9px; border-radius:2px; vertical-align:baseline; }
  .turno { display:inline-block; white-space:nowrap; margin: 1px 6px 1px 0; }
  .pill { display:inline-block; padding: 0 5px; border-radius: 6px; color: #fff; font-size: 9.5px; font-weight: 600; }
  .hor { font-size: 9px; color: #444; }
  @media print { @page { size: A4 landscape; margin: 10mm; } }
  </style></head>
  <body>
    ${conBoton ? BOTON_IMPRIMIR : ''}
    <h1>${esc(d.empresa.razon_social)}</h1>
    <h2>Cuadrante mensual por centros — ${MESES[mes - 1]} ${anio}</h2>
    <table>
      <thead><tr><th>Día</th>${cab}</tr></thead>
      <tbody>${cuerpo}
        <tr class="total"><td>TOTAL h</td>${totales}</tr>
      </tbody>
    </table>
  </body></html>`
}
