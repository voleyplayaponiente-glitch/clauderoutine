# CLAUDE.md — Gestor Laboral (cuadrantes y control de horas)

Memoria del proyecto para Claude Code. Léelo al empezar cualquier sesión en esta rama.

## Qué es
Aplicación de **escritorio local-first** (Electron) en **español** para un despacho de graduado
social que gestiona el personal de varias tiendas. Planifica cuadrantes mensuales por trabajador y
por centro, calcula horas, controla horas complementarias/vacaciones, emite avisos laborales y
exporta el **registro de jornada firmado** (PDF/Excel). **Sin nube**: todos los datos en un único
fichero SQLite local (RGPD: DNI/NIE, NSS, IBAN, dirección no salen del equipo).

- **Rama de desarrollo:** `claude/labor-management-scheduling-app-jd2hcj`
- **Rama base / default:** `main`
- Nota: la app de **vóley playa** (anterior contenido del repo) vive en la rama
  `claude/tournament-bracket-manager-gvrcdt`; no mezclar.

## Stack (decisión deliberada)
Electron + React + TypeScript + Vite (`electron-vite`), SQLite (`better-sqlite3`),
Excel (`exceljs`), PDF (impresión nativa de Electron vía `printToPDF`, sin fuentes externas),
empaquetado con `electron-builder`. Salida **CommonJS** (sin `"type":"module"`) para que `__dirname`
funcione en el proceso principal/preload.

**No** se usa navegador/servidor: el requisito central es local-first con fichero SQLite y arranque
por doble clic para un usuario no técnico.

## Comandos
```bash
npm install          # en la máquina del usuario descarga binario Electron + compila better-sqlite3
npm run dev          # desarrollo escritorio (abre la ventana Electron)
npm test             # 22 pruebas del motor puro (Vitest)
npm run typecheck    # tsc de main (node) + renderer (web)
npm run build        # bundles escritorio en out/ (electron-vite)
npm run dist[:win|:mac|:linux]  # instalador nativo (electron-builder)
npm run build:webapp # versión web: dist-web/ (Vite) + dist-server/ (tsc)
npm run web          # arranca el servidor web (GESTOR_PASSWORD, PORT, GESTOR_DATA_DIR)
```
> Para validar la web en el entorno remoto: `npm install --ignore-scripts && npm rebuild
> better-sqlite3`, luego `npm run build:webapp && npm run web`. Docker: ver INSTALACION-UMBREL.md.
> En el entorno remoto de Claude, la descarga del binario de Electron y de prebuilds nativos puede
> estar bloqueada por egress (403). Para validar aquí: `npm install --ignore-scripts` y luego
> `npm test` + `npm run typecheck` + `npm run build` (no requieren el binario de Electron).

## Arquitectura
- `src/shared/` — **motor puro** (sin Electron ni React), testeable:
  - `types.ts` — modelo de dominio. `fechas.ts` — utilidades fecha/hora (dd/mm/aaaa, coma decimal).
  - `calculos.ts` — horas/día, media mensual = h_anuales×coef÷12, complementarias, resúmenes.
  - `avisos.ts` — validaciones: 12 h entre jornadas, descanso semanal 36 h, fuera de apertura/día
    cerrado, supera contrato/media, complementarias, fin periodo prueba, solapamiento de tramos.
- `src/main/` — proceso principal: `db/` (schema + `better-sqlite3` + repos), `ipc.ts`, `services/`
  (backup por copia de fichero, export Excel/PDF).
- `src/preload/index.ts` — puente seguro `window.api` (contextIsolation).
- `src/renderer/` — UI React: `screens/` (Empresas, Centros, Trabajadores, Cuadrante, Informes,
  Exportar, Ajustes), `components.tsx`, `styles.css` (claro/oscuro).
- `src/shared/api.ts` — interfaz `ApiGestor` (window.api), implementada por dos backends.
- `src/main/rpc.ts` — tabla de manejadores de datos electron-free, compartida por IPC y web.
- `src/server/index.ts` — **versión web** (Express): sirve `dist-web`, expone `/api/rpc` con los
  mismos canales, login por contraseña (`GESTOR_PASSWORD`), export (descarga xlsx / HTML imprimible)
  y backup (descarga/subida del `.db`). Cliente web: `src/renderer/src/web-api.ts` (+ `main-web.tsx`,
  `web.html`). Build: `vite.web.config.ts` → `dist-web`; `tsconfig.server.json` → `dist-server`.
  Empaquetado: `Dockerfile` + `docker-compose.yml` (ver `INSTALACION-UMBREL.md`).
  Datos: carpeta configurable por `GESTOR_DATA_DIR` (Electron la fija a userData; Docker a /datos).

## Modelo de datos (SQLite)
`empresa → centro (+ festivo) → trabajador (+ trabajador_centro N:M) → cuadrante (1/mes) → turno (1/día, 2 tramos)`.
Multiempresa; cada centro con horas anuales de convenio, horario y días de apertura. Trabajador
`ajena|autonomo` (el autónomo no genera complementarias ni valida jornada de cuenta ajena).

## Reglas de negocio clave
- Media mensual constante (base anual). Complementarias = realizadas − contratadas del mes (solo
  ajena, parcial). Vacaciones pendientes = anuales − disfrutadas. Sueldo prorrateado = completo×coef.
- Turno partido = 2 tramos; horas/día = tramos − descanso.

## Convenciones
- Interfaz y mensajes **en español**; fechas dd/mm/aaaa; importes/decimales con coma.
- Mantener el motor (`src/shared`) sin dependencias de Electron/React.
- Confirmación antes de borrar. Copia de seguridad = copiar el fichero `.db`.

## Estado / pendientes
Hecho: Fases 1–7 (modelo + base + centros/trabajadores + agenda 2 vistas + cálculos + avisos +
export PDF/Excel + copias + README + scripts de arranque). Typecheck y build en verde; 22 tests.
Pendiente de validar en ejecución real de Electron (binario bloqueado en el entorno remoto).
Ampliable: arrastrar-y-soltar en la agenda, calendario de festivos por provincia autocargado,
export nativo `.xlsx` con más formato, firma digitalizada en el PDF.
