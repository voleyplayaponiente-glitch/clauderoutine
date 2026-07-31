import type { Category, Match, Tournament } from '@/types'
import { uid } from '@/engine/id'
import { defaultConfig, defaultSchedule, CATEGORY_COLORS } from '@/engine/defaults'
import { newTeam } from './factory'
import { generateCategoryDraw, refreshCategory } from './category'
import { generateSchedule } from '@/engine/schedule'

const NOMBRES = [
  'Playa Norte', 'Sol y Arena', 'Los Tiburones', 'Ola Brava', 'Costa Azul',
  'Duna Roja', 'Mar Adentro', 'Vóley Kings', 'Las Gaviotas', 'Rompeolas',
  'Arena Fina', 'Marejada', 'Los Delfines', 'Brisa Marina', 'Espuma',
  'Náufragos', 'Corriente', 'Litoral', 'Bahía', 'Faro',
  'Coral', 'Tramontana', 'Levante', 'Poniente', 'Sirocco',
  'Cala Blanca', 'Peñón', 'Acantilado', 'Resaca', 'Tsunami',
  'Maremoto', 'Barlovento',
]

function makeTeams(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const t = newTeam(i + 1, NOMBRES[i] ?? `Equipo ${i + 1}`)
    t.jugadores = Array.from({ length: 5 }, (_, p) => ({ id: uid('p'), nombre: `Jugador ${i * 5 + p + 1}` }))
    t.telefono = `6${String(10000000 + i).slice(0, 8)}`
    t.estadoInscripcion = 'confirmado'
    t.importePagado = 30
    if (i < n / 4) {
      t.cabezaSerie = true
      t.seedRank = i + 1
    }
    return t
  })
}

/** Deterministic-ish pseudo result so demos look realistic. */
function fakeResult(m: Match, seed: number): Match {
  const a = (seed * 7 + m.numero * 13) % 5
  const localWins = a < 3
  const sets = localWins
    ? [{ local: 21, visitante: 15 + (a % 5) }, { local: 21, visitante: 12 + (a % 6) }]
    : [{ local: 14 + (a % 6), visitante: 21 }, { local: 16 + (a % 4), visitante: 21 }]
  return { ...m, sets, status: 'finalizado' }
}

function playGroups(cat: Category, seed: number): Category {
  const matches = cat.matches.map((m) => (m.phase === 'grupos' ? fakeResult(m, seed) : m))
  return refreshCategory({ ...cat, matches })
}

function buildCategory(nombre: string, colorIdx: number, numEquipos: 8 | 16 | 32, seed: number, subcategorias: string[] = []): Category {
  const config = defaultConfig(numEquipos)
  config.subcategorias = subcategorias
  const teams = makeTeams(numEquipos).map((tm, i) =>
    subcategorias.length > 0 ? { ...tm, subcategoria: subcategorias[i % subcategorias.length] } : tm,
  )
  let cat: Category = {
    id: uid('cat'),
    nombre,
    color: CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length],
    config,
    teams,
    groups: [],
    matches: [],
    manualTiebreaks: {},
  }
  cat = generateCategoryDraw(cat)
  cat = playGroups(cat, seed)
  return cat
}

export function demoTournament(): Tournament {
  const now = safeNow()
  const cat17 = buildCategory('SUB-17', 0, 16, 3, ['SUB-17', 'SUB-15'])
  const catSenior = buildCategory('SÉNIOR', 1, 32, 7)
  const t: Tournament = {
    id: uid('trn'),
    nombre: 'Torneo Demo Vóley Playa 2026',
    lugar: 'Playa de la Concha',
    fecha: '2026-07-25',
    categories: [cat17, catSenior],
    schedule: { ...defaultSchedule(), numPistas: 4, nombresPistas: ['Pista 1', 'Pista 2', 'Pista 3', 'Pista 4'] },
    createdAt: now,
    updatedAt: now,
  }
  // schedule each category
  t.categories = t.categories.map((c) => ({
    ...c,
    matches: generateSchedule(c.matches, t.schedule),
  }))
  return t
}

export function demoSmall(): Tournament {
  const cat = buildCategory('ADULTOS', 2, 8, 5)
  const t: Tournament = {
    id: uid('trn'),
    nombre: 'Copa Rápida 8 Equipos',
    lugar: 'Polideportivo Municipal',
    fecha: '2026-08-10',
    categories: [cat],
    schedule: defaultSchedule(),
    createdAt: safeNow(),
    updatedAt: safeNow(),
  }
  t.categories = t.categories.map((c) => ({ ...c, matches: generateSchedule(c.matches, t.schedule) }))
  return t
}

function safeNow(): number {
  try {
    return Date.now()
  } catch {
    return 1_753_400_000_000
  }
}
