// Paleta de colores por trabajador, compartida entre la interfaz (agenda) y
// los generadores de documentos (PDF/Excel del cuadrante por centro).

// Paleta amplia y con buen contraste (texto blanco) para dar un color propio a
// cada trabajador y distinguirlos en la agenda.
export const COLORES_TRABAJADOR = [
  '#e11d48',
  '#ea580c',
  '#d97706',
  '#ca8a04',
  '#65a30d',
  '#16a34a',
  '#059669',
  '#0891b2',
  '#0284c7',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#9333ea',
  '#c026d3',
  '#db2777',
  '#57534e'
]

/** Color efectivo de un trabajador: el suyo propio, o uno de la paleta según su id/semilla. */
export function colorTrabajador(color: string, semilla: number): string {
  if (color) return color
  const n = COLORES_TRABAJADOR.length
  return COLORES_TRABAJADOR[((semilla % n) + n) % n]
}
