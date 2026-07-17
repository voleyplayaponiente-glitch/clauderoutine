interface Props {
  size?: number
  className?: string
  style?: React.CSSProperties
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const IconHome = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9 21v-6h6v6" />
  </svg>
)
export const IconTrophy = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
    <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
    <path d="M12 13v4M9 21h6M10 17h4" />
  </svg>
)
export const IconUsers = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6" />
  </svg>
)
export const IconGrid = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)
export const IconCalendar = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9h18M8 3v3M16 3v3" />
  </svg>
)
export const IconTable = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M3 15h18M9 10v10M15 10v10" />
  </svg>
)
export const IconBracket = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 5h4v5h4M4 19h4v-5" />
    <path d="M12 12h4V7h4M16 12h4v10M16 12V2" opacity="0.55" />
  </svg>
)
export const IconSettings = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
  </svg>
)
export const IconLayers = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 3 3 8l9 5 9-5z" />
    <path d="M3 13l9 5 9-5M3 18l9 5 9-5" opacity="0.6" />
  </svg>
)
export const IconShare = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M8.2 10.8 15.8 7.2M8.2 13.2l7.6 3.6" />
  </svg>
)
export const IconDownload = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 3v12M7 10l5 5 5-5" />
    <path d="M4 21h16" />
  </svg>
)
export const IconDatabase = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </svg>
)
export const IconPlus = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconTrash = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
)
export const IconMoon = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z" />
  </svg>
)
export const IconSun = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </svg>
)
export const IconPrint = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M6 9V3h12v6" />
    <rect x="4" y="9" width="16" height="8" rx="2" />
    <path d="M7 17h10v4H7z" />
  </svg>
)
export const IconEye = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const IconEdit = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z" />
    <path d="M13.5 6.5l3 3" />
  </svg>
)
export const IconCheck = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M5 13l4 4L19 7" />
  </svg>
)
export const IconMenu = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)
export const IconWarning = ({ size = 20, className, style }: Props) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 3 2 20h20z" />
    <path d="M12 9v5M12 17h.01" />
  </svg>
)
