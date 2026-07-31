/** Iconografía lineal, fina y coherente (trazo 1.6, estilo Lucide). */
type Props = { nombre: string; className?: string }

const TRAZOS: Record<string, string> = {
  panel: 'M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z',
  ventas: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  compras: 'M6 6h15l-1.5 9h-12zM6 6L5 3H2M9 21a1 1 0 100-2 1 1 0 000 2zM18 21a1 1 0 100-2 1 1 0 000 2z',
  caja: 'M3 7h18v13H3zM3 7l2-4h14l2 4M12 12v4',
  banco: 'M3 21h18M4 10h16M5 10V21M19 10V21M9 10v11M15 10v11M12 3l8 5H4z',
  stock: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
  importar: 'M12 3v12M8 11l4 4 4-4M4 17v3a1 1 0 001 1h14a1 1 0 001-1v-3',
  deuda: 'M3 5h18v14H3zM3 10h18M7 15h4',
  deudor: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M19 8v6M22 11h-6',
  presupuesto: 'M3 3v18h18M7 14l3-3 2 2 4-5 3 3',
  tesoreria: 'M3 17l6-6 4 4 8-8M21 7v5M21 7h-5',
  informe: 'M6 2h9l5 5v15H6zM15 2v5h5M9 13h6M9 17h6M9 9h2',
  copia: 'M21 12a9 9 0 11-3-6.7M21 3v5h-5',
  ajustes: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2l-.3-2.6H9.8l-.4 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2l.4 2.6h4.4l.3-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  luna: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  sol: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  alerta: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.4 3.9a2 2 0 00-3.4 0z',
}

export function Icono({ nombre, className = 'w-5 h-5' }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TRAZOS[nombre] ?? TRAZOS.panel} />
    </svg>
  )
}
