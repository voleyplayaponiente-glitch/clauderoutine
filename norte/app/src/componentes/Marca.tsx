/**
 * La aguja de Norte. Aislada del fondo del icono, se lee como una línea que
 * sube: el patrimonio neto, que es la métrica que manda en toda la app.
 */
export function Aguja({ tamano = 28 }: { tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Norte"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="agujaNorte" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="var(--marca-clara)" />
          <stop offset="1" stopColor="var(--marca)" />
        </linearGradient>
      </defs>
      <path
        d="M196 300 L316 300 L256 424 Z"
        fill="var(--texto-3)"
        stroke="var(--texto-3)"
        strokeWidth="10"
        strokeLinejoin="round"
      />
      <path
        d="M256 88 L316 300 L196 300 Z"
        fill="url(#agujaNorte)"
        stroke="url(#agujaNorte)"
        strokeWidth="10"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logotipo({ tamano = 28 }: { tamano?: number }) {
  return (
    <span className="flex items-center gap-2">
      <Aguja tamano={tamano} />
      <span className="text-[1.05rem] font-semibold tracking-[-0.02em]">Norte</span>
    </span>
  )
}
