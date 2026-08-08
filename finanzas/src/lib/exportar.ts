/**
 * Exportaciones a CSV, Excel y PDF. Las librerías pesadas (SheetJS, jsPDF) se
 * cargan de forma diferida para no penalizar el arranque.
 */
type Celda = string | number

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

/** CSV con separador `;` (compatible con Excel en España) y BOM UTF-8. */
/**
 * Número para un CSV que se va a abrir en Excel español: coma decimal. Con
 * punto, Excel en español lo trata como texto y la gestoría no puede sumar.
 */
export function numeroCsv(n: number, decimales = 2): string {
  return n.toFixed(decimales).replace('.', ',')
}

export function exportarCSV(nombre: string, cabeceras: string[], filas: Celda[][]): void {
  const esc = (v: Celda) => {
    const s = String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lineas = [cabeceras.map(esc).join(';'), ...filas.map((f) => f.map(esc).join(';'))]
  descargar(new Blob(['﻿' + lineas.join('\n')], { type: 'text/csv;charset=utf-8' }), `${nombre}.csv`)
}

export async function exportarExcel(nombre: string, cabeceras: string[], filas: Celda[][]): Promise<void> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([cabeceras, ...filas])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  XLSX.writeFile(wb, `${nombre}.xlsx`)
}

export interface SeccionPDF {
  titulo: string
  cabeceras: string[]
  filas: Celda[][]
}

/** PDF con una o varias tablas. Portada con logo y datos de empresa. */
export async function exportarPDF(
  nombreFichero: string,
  meta: { titulo: string; subtitulo?: string; empresa?: string; cif?: string; logoDataUrl?: string },
  secciones: SeccionPDF[],
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTablePlugin } = await import('jspdf-autotable')
  const doc = new jsPDF()
  const autoTable = (opts: Record<string, unknown>) => autoTablePlugin(doc, opts as never)

  if (meta.logoDataUrl) {
    try {
      doc.addImage(meta.logoDataUrl, 'PNG', 14, 12, 20, 20)
    } catch {
      /* logo no válido: se omite */
    }
  }
  doc.setFontSize(16)
  doc.text(meta.titulo, meta.logoDataUrl ? 40 : 14, 20)
  doc.setFontSize(10)
  doc.setTextColor(120)
  if (meta.empresa) doc.text(`${meta.empresa}${meta.cif ? ` · ${meta.cif}` : ''}`, meta.logoDataUrl ? 40 : 14, 27)
  if (meta.subtitulo) doc.text(meta.subtitulo, meta.logoDataUrl ? 40 : 14, 33)
  doc.setTextColor(0)

  let y = 42
  for (const s of secciones) {
    doc.setFontSize(12)
    doc.text(s.titulo, 14, y)
    autoTable({
      head: [s.cabeceras],
      body: s.filas.map((f) => f.map((c) => String(c))),
      startY: y + 3,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 132, 255] },
      margin: { left: 14, right: 14 },
    })
    // @ts-expect-error autotable añade lastAutoTable
    y = (doc.lastAutoTable?.finalY ?? y + 20) + 10
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage()
      y = 20
    }
  }
  doc.save(`${nombreFichero}.pdf`)
}
