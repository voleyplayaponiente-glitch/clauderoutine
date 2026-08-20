/**
 * PDF → texto.
 *
 * Se usa `pdfjs-dist` (el motor de Firefox), en la versión 6, que es la que ya
 * no evalúa nada del PDF: un extracto es un fichero que llega de fuera y no hay
 * ninguna razón para que su contenido pueda ejecutar código.
 *
 * Un PDF no tiene líneas: tiene fragmentos con coordenadas. Reconstruirlas es
 * la mitad del trabajo, y hacerlo mal se nota enseguida — si la fecha, el
 * concepto y el importe de un movimiento acaban en «líneas» distintas, ya no
 * hay forma de volver a juntarlos.
 */
export async function leerTextoDePdf(datos: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const tarea = pdfjs.getDocument({
    data: new Uint8Array(datos),
    useSystemFonts: false,
    // Solo se extrae texto: los avisos de fuentes que no se van a dibujar
    // llenarían el registro del servidor en cada subida. Los errores sí salen.
    verbosity: 0,
    // Aun así se le dice dónde están las fuentes estándar, porque algunas
    // hacen falta para saber a qué carácter corresponde cada glifo.
    standardFontDataUrl: new URL(
      '../../../node_modules/pdfjs-dist/standard_fonts/',
      import.meta.url,
    ).href,
  })
  const documento = await tarea.promise

  /**
   * Dos trozos de la misma línea casi nunca están a la misma altura exacta. En
   * la nómina real, el guion de «01/07/2026 - 31/07/2026» va dibujado dos
   * décimas más abajo que las fechas: agrupando por Y exacta (o redondeada al
   * entero) se iba a una línea propia y el periodo de liquidación se perdía.
   */
  const HOLGURA = 2.5

  // La lectura se rehace en cada consulta, así que el coste de un PDF se paga
  // cada vez que alguien mira el documento. Un extracto real de un año entero
  // anda por las 30 páginas; uno preparado puede declarar decenas de miles y
  // dejar el servidor ocupado minutos con cada petición. Se leen las primeras
  // y se dice, en vez de intentarlo todo y no responder.
  const MAX_PAGINAS = 300
  const totalPaginas = Math.min(documento.numPages, MAX_PAGINAS)

  const paginas: string[] = []
  try {
    for (let n = 1; n <= totalPaginas; n++) {
      const pagina = await documento.getPage(n)
      const contenido = await pagina.getTextContent()

      const trozos: { x: number; y: number; texto: string }[] = []
      for (const trozo of contenido.items) {
        if (!('str' in trozo) || trozo.str === '') continue
        const [, , , , x, y] = trozo.transform as number[]
        trozos.push({ x: x ?? 0, y: y ?? 0, texto: trozo.str })
      }
      trozos.sort((a, b) => b.y - a.y)

      const lineas: { y: number; partes: { x: number; texto: string }[] }[] = []
      for (const trozo of trozos) {
        const ultima = lineas[lineas.length - 1]
        if (ultima && Math.abs(ultima.y - trozo.y) <= HOLGURA) ultima.partes.push(trozo)
        else lineas.push({ y: trozo.y, partes: [trozo] })
      }

      const ordenadas = lineas
        .map(({ partes }) =>
          partes
            .sort((a, b) => a.x - b.x)
            .map((t) => t.texto)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim(),
        )
        .filter((l) => l !== '')

      paginas.push(ordenadas.join('\n'))
      pagina.cleanup()
    }
  } finally {
    await tarea.destroy()
  }
  if (documento.numPages > MAX_PAGINAS) {
    paginas.push(`[Norte solo ha leído las primeras ${MAX_PAGINAS} páginas de ${documento.numPages}.]`)
  }
  return paginas.join('\n')
}
