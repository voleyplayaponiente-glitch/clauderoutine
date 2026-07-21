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

/** Calendario mensual por centros: la vista por centro de la agenda, imprimible y en color. */
export function htmlCuadranteCentros(
  empresaId: number,
  anio: number,
  mes: number,
  conBoton = false,
  centroId?: number
): string {
  const d = datosCuadranteCentros(empresaId, anio, mes, centroId)
  const mm = String(mes).padStart(2, '0')
  const totalDias = new Date(anio, mes, 0).getDate()
  const unSolo = d.centros.length === 1

  // Leyenda: solo los trabajadores que aparecen en el mes, con su color.
  const idsUsados = new Set<number>()
  for (const lista of d.porDiaCentro.values()) for (const t of lista) idsUsados.add(t.trabajador_id)
  const leyenda = [...idsUsados]
    .map((id) => d.trabajadoresPorId[id])
    .filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((i) => `<span class="chip" style="background:${esc(i.color)}">${esc(i.nombre)}</span>`)
    .join('')

  const cab = d.centros
    .map((c) => `<th style="background:${esc(c.color)}">${esc(c.nombre)}</th>`)
    .join('')

  let cuerpo = ''
  for (let dia = 1; dia <= totalDias; dia++) {
    const fecha = `${anio}-${mm}-${String(dia).padStart(2, '0')}`
    const dw = diaSemanaIso(fecha)
    const finde = dw === 0 || dw === 6
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
              .join(' · ')
            return `<div class="turno" style="border-left-color:${esc(info?.color ?? '#888')}">
              <span class="pill" style="background:${esc(info?.color ?? '#888')}">${esc(info?.nombre ?? '?')}</span>
              <span class="hor">${esc(horario)}</span>
            </div>`
          })
          .join('')
        return `<td class="${finde ? 'finde' : ''}">${contenido}</td>`
      })
      .join('')
    cuerpo += `<tr><td class="dia ${finde ? 'finde' : ''}"><span class="num">${dia}</span><span class="dsem">${DIAS_SEMANA_CORTO[dw]}</span></td>${celdas}</tr>`
  }

  const totales = d.centros
    .map((c) => `<td class="tot">${numEs(d.horasPorCentro[c.id] ?? 0)} h</td>`)
    .join('')

  const titulo = unSolo
    ? `${d.centros[0].nombre} — ${MESES[mes - 1]} ${anio}`
    : `Cuadrante por centros — ${MESES[mes - 1]} ${anio}`

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1d1d1f; margin: 20px; }
  .cabecera { display: flex; align-items: baseline; gap: 14px; border-bottom: 3px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 10px; }
  .mes { font-size: 26px; font-weight: 800; color: #1d4ed8; letter-spacing: -0.5px; }
  .empresa { font-size: 13px; color: #555; font-weight: 600; }
  .leyenda { margin: 8px 0 12px; display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-block; padding: 2px 10px; border-radius: 999px; color: #fff; font-size: 11px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #d6dbe3; padding: 4px 6px; vertical-align: top; text-align: left; }
  th { color: #fff; font-size: 11.5px; padding: 7px 8px; letter-spacing: 0.2px; }
  th:first-child { background: #1e293b !important; width: 56px; }
  td.dia { width: 56px; text-align: center; background: #f8fafc; }
  td.dia .num { display: block; font-size: 15px; font-weight: 800; color: #1e293b; line-height: 1.1; }
  td.dia .dsem { display: block; font-size: 9.5px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  td.finde { background: #eef2f7; }
  td.dia.finde { background: #e2e8f0; }
  td.dia.finde .num { color: #b91c1c; }
  .turno { display: flex; align-items: center; gap: 6px; margin: 2px 0; padding: 2px 4px 2px 6px; border-left: 3px solid; border-radius: 4px; background: #fff; }
  td.finde .turno { background: #fbfcfe; }
  .pill { display: inline-block; padding: 1.5px 8px; border-radius: 999px; color: #fff; font-size: 10.5px; font-weight: 700; white-space: nowrap; }
  .hor { font-size: 10px; color: #475569; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr.total td { background: #1e293b; color: #fff; font-weight: 800; font-size: 12px; padding: 7px 8px; }
  tr.total td.tot { text-align: right; }
  .noprint { position: fixed; top: 12px; right: 12px; }
  .noprint button { font-size: 13px; padding: 8px 14px; border-radius: 8px; border: 1px solid #0071e3; background: #0071e3; color: #fff; cursor: pointer; }
  @media print { .noprint { display: none; } body { margin: 0; } @page { size: A4 ${unSolo ? 'portrait' : 'landscape'}; margin: 9mm; } }
  </style></head>
  <body>
    ${conBoton ? BOTON_IMPRIMIR : ''}
    <div class="cabecera">
      <span class="mes">${MESES[mes - 1]} ${anio}</span>
      <span class="empresa">${esc(d.empresa.razon_social)}${unSolo ? ' · ' + esc(d.centros[0].nombre) : ''}</span>
    </div>
    ${leyenda ? `<div class="leyenda">${leyenda}</div>` : ''}
    <table>
      <thead><tr><th>Día</th>${cab}</tr></thead>
      <tbody>${cuerpo}
        <tr class="total"><td>TOTAL</td>${totales}</tr>
      </tbody>
    </table>
  </body></html>`
}
