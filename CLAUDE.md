# CLAUDE.md — Gestor de Torneos de Vóley Playa

Memoria del proyecto para Claude Code. Léelo al empezar cualquier sesión en este repo.

## Qué es
Aplicación web **responsive** y **PWA offline-first** (en español) para gestionar
cuadros de competición de torneos de vóley playa: fase de grupos + fase final
eliminatoria, con **varias categorías independientes** por torneo (p. ej. SUB-17
y SÉNIOR), formatos de **8/16/32 equipos**. Estética estilo Apple, modo claro/oscuro.

- **App en producción:** https://voleyplayaponiente-glitch.github.io/clauderoutine/
- **Repo:** voleyplayaponiente-glitch/clauderoutine
- **Rama de desarrollo:** `claude/tournament-bracket-manager-gvrcdt`
- **Rama base / default:** `main` (se creó como commit inicial vacío; el repo estaba vacío)
- **PR principal:** #1 (rama → `main`)

## Stack (decisión deliberada)
Vite + React + TypeScript + Tailwind CSS v4 + Zustand + IndexedDB (idb-keyval),
jsPDF + jspdf-autotable (PDF), qrcode (QR), vite-plugin-pwa (PWA), Vitest (tests).

**No** se usa Next.js/Prisma/SQLite a propósito: el requisito central es funcionar
sin conexión sin perder resultados → arquitectura 100 % cliente con IndexedDB,
desplegable como PWA estática. El motor de cálculo queda aislado en TS puro para
poder añadir sincronización remota (PostgreSQL) en el futuro sin reescribir lógica.

## Comandos
```bash
npm install
npm run dev      # desarrollo (http://localhost:5173)
npm test         # 38 pruebas unitarias (Vitest) del motor
npm run build    # tsc -b && vite build  (usa GITHUB_PAGES=true para base /clauderoutine/)
npm run preview  # previsualizar producción / PWA
```

## Arquitectura
Jerarquía de datos: `Torneo → Categoría[] → {CompetitionConfig, Team[], Group[], Match[], manualTiebreaks}`.
Cada categoría es totalmente independiente (equipos, grupos, resultados, cuadro, color).

- `src/engine/` — **motor puro en TS, separado de la UI** (aquí vive la lógica):
  - `standings.ts` — clasificación + desempates reordenables. Usa **partición
    jerárquica** con mini-liga de enfrentamiento directo (correcta ante empates
    cíclicos de 3 equipos). NO usar comparación pairwise de h2h.
  - `groups.ts` / `fixtures.ts` — sorteo (cabezas de serie, keep-apart) + round-robin.
  - `bracket.ts` — genera/resuelve cuadro 8/16/32; `buildFirstRoundSeeds` evita
    cruces del mismo grupo antes de la final; propaga ganadores hasta el campeón.
  - `schedule.ts` — horarios/pistas + detección de conflictos.
  - `match.ts` — cómputo/validación de resultados (mejor de 3 / a un set, dif. 2).
  - `defaults.ts` — config y colores por defecto.
- `src/lib/` — persistencia (IndexedDB), store helpers de categoría, CSV, PDF, backup JSON, demo, router hash.
- `src/store/store.ts` — estado global (Zustand) + persistencia con debounce.
- `src/screens/` — 13 pantallas. `src/components/` — UI reutilizable.

## Reglas de negocio clave
- Clasificación por defecto: PG → dif. sets → sets favor → dif. puntos → puntos favor → enfrentamiento directo → manual. **Orden configurable** en la pantalla de config.
- Formatos por defecto: 8→2 grupos, 16→4, 32→8; clasifican 2 por grupo; partido 3.º puesto activable.
- Al guardar/corregir un resultado se recalculan clasificación y cuadro; avisa si el cambio afecta rondas posteriores.

## Convenciones
- Interfaz **en español**; mensajes de error en español.
- Mantener el motor sin dependencias de React (testeable de forma aislada).
- Añadir categorías nuevas (SUB-10, veteranos, mixto…) NO debe requerir tocar el núcleo.
- `crypto.randomUUID` con fallback en `src/engine/id.ts`; evitar `Date.now()`/`Math.random()` dentro del motor puro salvo en sorteo/id.

## CI / Despliegue
- `.github/workflows/deploy.yml`: en push a `main` o a la rama de desarrollo → tests + build (`GITHUB_PAGES=true`) + deploy a GitHub Pages (`enablement: true`).
- Pages debe estar en **Settings → Pages → Source: GitHub Actions** (ya activado). El token por defecto no puede crear el site solo; requirió activación manual una vez.

## Estado / pendientes
Terminado: todo el flujo funcional + 38 tests + PWA + export PDF/CSV + backup JSON + vista pública/QR.
Ampliable: drag-and-drop en calendario (hoy edición por selectores), siembra automática de mejores terceros en el cuadro, sincronización remota PostgreSQL, export `.xlsx` nativo.
