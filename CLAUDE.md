# CLAUDE.md — Gestor Laboral (cuadrantes y control de horas)

Memoria del proyecto para Claude Code. Léelo al empezar cualquier sesión en esta rama.

## Qué es
Aplicación en **español** para un despacho de graduado social que gestiona el personal de varias
tiendas. Planifica cuadrantes mensuales por trabajador y por centro, calcula horas, controla horas
complementarias/vacaciones, calcula retribución (con IRPF y neto estimado), emite avisos laborales y
exporta el **registro de jornada firmado** (PDF/Excel) y las retribuciones (Excel). **Local-first,
sin nube** (RGPD: DNI/NIE, NSS, IBAN, dirección no salen del equipo/red del usuario).

- **Rama de desarrollo:** `claude/labor-management-scheduling-app-jd2hcj` · **base/default:** `main`
- **PR abierto:** #2 (base ya cambiada a `main`).
- La app de **vóley playa** (contenido anterior del repo) vive en `claude/tournament-bracket-manager-gvrcdt`; no mezclar.

## Dos formatos (mismo código)
1. **Escritorio (Electron):** `npm run dev`, empaquetado con `electron-builder`. Fichero SQLite en userData.
2. **Web (servidor Node/Express):** para navegador/servidor. **Es el que el usuario usa en producción**,
   desplegado en su **Umbrel** con Docker (ver `INSTALACION-UMBREL.md`). Acceso con contraseña
   (`GESTOR_PASSWORD` en `docker-compose.yml`). Datos en volumen `/datos`.

Stack: React + TypeScript + Vite (`electron-vite` para escritorio; `vite.web.config.ts` para web),
SQLite (`better-sqlite3`), Excel (`exceljs`), PDF (impresión nativa de Electron `printToPDF` en
escritorio; en web se sirve HTML imprimible). Salida **CommonJS**.

## Comandos
```bash
npm run dev          # escritorio (ventana Electron)
npm test             # 29 pruebas del motor puro (Vitest)
npm run typecheck    # tsc main(node) + renderer(web)
npm run build        # bundles escritorio en out/
npm run dist[:win|:mac|:linux]  # instalador nativo
npm run build:webapp # web: dist-web/ (Vite) + dist-server/ (tsc)
npm run web          # servidor web (env: GESTOR_PASSWORD, PORT, GESTOR_DATA_DIR)
```
> Validar en el entorno remoto de Claude (egress bloquea binario Electron/prebuilds, 403):
> `npm install --ignore-scripts && npm rebuild better-sqlite3`, luego `npm test`, `npm run typecheck`,
> `npm run build:webapp`. Para probar en vivo: arrancar `node dist-server/server/index.js` con
> `GESTOR_DATA_DIR`/`GESTOR_PASSWORD`/`PORT`, sembrar por `/api/rpc` y pilotar con Chromium
> (`/opt/pw-browsers/chromium-1194/...`, `playwright-core` instalado con `--no-save`). Ver los `.mjs`
> del scratchpad de la sesión como referencia.

## Despliegue en Umbrel (producción del usuario)
- App propia por Docker en el terminal de umbrelOS (Settings→Terminal). Carpeta:
  `/home/umbrel/umbrel/home/clauderoutine-claude-labor-management-scheduling-app-jd2hcj`.
- **Actualizar** (conserva datos y contraseña): descargar el tar.gz del branch, extraer con
  `tar --strip-components=1 --exclude='*/docker-compose.yml'` sobre la carpeta y
  `sudo docker compose up -d --build`. Comando completo en la conversación / INSTALACION-UMBREL.md.
- El pegar en ese terminal es **Ctrl+Shift+V**; el usuario NO puede copiar la salida → pide capturas.
  Acceso a la app: `http://umbrel.local:3000`.

## Acceso del usuario
- **App instalable (PWA):** la web tiene `manifest.webmanifest` + iconos en `src/renderer/public/`
  (calendario azul de marca) y metas en `web.html`. Se sirve como estático público (sin auth). El
  usuario la instaló como app en Windows (Brave → "Instalar página como aplicación").
- **En LAN:** `http://umbrel.local:3000` (o IP LAN). **En remoto:** por **Tailscale** (VPN privada,
  cifrada, sin abrir puertos → RGPD ok). El usuario ya tiene Tailscale en el Mac y en el Umbrel, misma
  cuenta. IP Tailscale del Umbrel: **`100.125.128.120`** → `http://100.125.128.120:3000`.
- ⚠️ Una PWA queda **fijada al origen** desde el que se instala. Para que funcione en casa y fuera con
  un solo icono: instalarla desde la dirección de Tailscale y dejar Tailscale **siempre activo** (o usar
  MagicDNS, p. ej. `http://umbrel:3000`). NO exponer el puerto 3000 a Internet público.
- NO guardar en el repo la contraseña real del usuario (solo en su `docker-compose.yml`, `GESTOR_PASSWORD`).

## Arquitectura
- `src/shared/` — **motor puro** (sin Electron ni React), testeable:
  - `types.ts` (modelo), `fechas.ts` (dd/mm/aaaa, coma decimal), `api.ts` (interfaz `ApiGestor`).
  - `calculos.ts` — horas/día, media mensual, coeficiente, retribución (`calcRetribucion`), etc.
  - `avisos.ts` — validaciones laborales.
- `src/main/` — `db/` (schema + `better-sqlite3` + repos + migración), `rpc.ts` (handlers de datos
  electron-free, compartidos), `ipc.ts` (IPC escritorio), `services/` (backup, generate-excel,
  html-docs, export-*).
- `src/preload/index.ts` — `window.api` (contextIsolation).
- `src/renderer/` — UI React: `screens/`, `components.tsx`, `styles.css`, `defaults.ts`
  (paletas y `colorTrabajador`). Web: `web-api.ts` + `main-web.tsx` + `web.html` (login por contraseña).
- `src/server/index.ts` — servidor Express (web): sirve `dist-web`, `/api/rpc`, export, backup, login.
  **Endurecido (auditoría Bloque 1):** exige `GESTOR_PASSWORD` (si falta → `exit 1`); rate-limit de
  login (5 fallos → 60 s de bloqueo, HTTP 429 con mensaje que muestra la UI); cabeceras de seguridad
  (CSP solo-origen con inline permitido, nosniff, X-Frame-Options DENY, Referrer-Policy); la subida de
  backup valida la firma `SQLite format 3\0` antes de escribir; `sello_imagen` va escapado en el HTML
  imprimible.
  **Bloque 2 (hecho):** `backup-auto.ts` — copia diaria automática a `<datos>/backups/` (rotación 30,
  `db.backup()` en caliente, chequeo horario); `sesiones.ts` — sesiones token→caducidad (30 d) persistidas
  en `<datos>/sesiones.json` (sobreviven reinicios); descarga de backup **cifrado** AES-256-GCM con clave
  scrypt de `GESTOR_PASSWORD` (formato `[16 magia GESTOR-CIFRADO-1][16 sal][12 iv][16 tag][datos]`,
  extensión `.db.cifrada`), la restauración acepta .db y .cifrada (con mensaje claro si la contraseña no
  coincide); la descarga sin cifrar hace antes `wal_checkpoint(TRUNCATE)`; Dockerfile **multi-stage**
  (imagen final sin devDependencies ni toolchain). `exportarCifrado` es método **opcional** de ApiGestor
  (solo web; el botón en Ajustes se muestra si existe).
  **Bloque 3 (hecho):** vista **móvil** (media query ≤840px en `styles.css`: la barra lateral pasa a barra
  superior deslizable, formularios `grid-2/3` a una columna, tarjetas con scroll horizontal para tablas,
  inputs a 16px para evitar el zoom de iOS); accesibilidad (aria-current en nav, aria-label en selector de
  empresa y botones ×, role=dialog en Modal; los campos ya iban envueltos en `<label class="field">`);
  `validarArgs` en `rpc.ts` (tabla FIRMAS canal→tipos, aplicada solo en `/api/rpc` del servidor web →
  400 si no encaja); `robots.txt` (Disallow todo) en `src/renderer/public/`.
  TLS en LAN: decidido NO ponerlo (autofirmado rompería la PWA y Tailscale ya cifra el acceso remoto;
  la LAN es propia). Revisar solo si la app se usara desde una red compartida.

## Modelo de datos (SQLite) — esquema v6
`empresa → centro (+ festivo) → trabajador (+ trabajador_centro N:M) → cuadrante (1/mes) → turno (1/día, 2 tramos)`.
Versionado por `PRAGMA user_version`, migración incremental en `db/database.ts`:
- v2: horario del centro por tipo de día + campos de retribución básicos.
- v3: `retribucion_especie_exenta`. v4: `codigo`, `plus_transporte`. v5: `jornada_completa_semanal`.
- v6: `color` del trabajador.

**centro:** horario **por tipo de día** en 3 bloques con su “¿abre?” + apertura/cierre:
`abre_lunes_sabado`+`hora_apertura_ls/hora_cierre_ls`, `abre_domingos`+`*_dom`, `abre_festivos`+`*_fes`
(campos antiguos `hora_apertura/cierre`, `abre_laborables/sabados` se mantienen por compatibilidad).
`horas_anuales_convenio`, `color`. **Los festivos son por centro.**

**trabajador:** `codigo` (nº de orden, buscable), `color` (agenda), `tipo` ajena|autonomo,
identificación, `horas_contrato_semanales`, `jornada_completa_semanal` (def. 40),
`horas_convenio_completa` (anuales, def. 1768), `coef_parcialidad`, y **retribución mensual**:
`sueldo_convenio_completo` (salario base), `plus_productividad`, `plus_transporte`,
`prorrateo_pagas_extras` (ya NO se usa; el prorrateo se calcula), `retribucion_especie` (sujeta a IRPF),
`retribucion_especie_exenta` (seguro salud, exenta), `deduccion_especie`, `deduccion_seguro_salud`,
`irpf`, `precio_hora_complementaria`, vacaciones.

**turno:** situacion (`trabaja|libre|vacaciones|baja|festivo|permiso`), `centro_id`, 2 tramos
(entrada1/salida1, entrada2/salida2) opcionales, `descanso_min`.

## Reglas de cálculo (todas en `src/shared/calculos.ts`, con tests)
- **Coeficiente parcialidad = horas_contrato_semanales ÷ jornada_completa_semanal** (auto en la ficha
  al escribir las horas; editable). Jornada completa por defecto 40 h/semana.
- **Media mensual = horas_convenio_completa DEL TRABAJADOR × coef ÷ 12** (NO las del centro). Constante
  todo el año. (Se usa en ficha, cuadrante, informes, avisos, export → todo consistente.)
- **Retribución (`calcRetribucion`)**, importes mensuales:
  - prorrateo pagas = **salario base × 3 ÷ 12** (automático, 3 pagas; `NUM_PAGAS_EXTRA`).
  - total devengado = base + productividad + transporte + prorrateo + especie sujeta + especie exenta.
  - base sujeta a IRPF = igual **sin** la especie exenta.
  - retención IRPF = irpf% × base sujeta. neto = devengado − (ded. especie + ded. salud + retención IRPF).
  - Plus de transporte: tratado como **sujeto a IRPF** (revisar si el usuario lo quiere exento).
- Complementarias = realizadas − contratadas del mes (solo ajena parcial). Vacaciones pend. = anuales − disfrutadas.
- horas/día = tramos (mañana/tarde, opcionales) − descanso. Media jornada = rellenar solo un tramo.

## Avisos (`avisos.ts`): 12 h entre jornadas, descanso semanal 36 h, fuera de apertura/día cerrado
(según horario del tipo de día), supera contrato/media, complementarias, fin periodo prueba, solape de tramos.

## UI / convenciones
- Todo **en español**; fechas con **selector de calendario** (ISO interno); importes con coma.
- **Cuadrante**: vista por trabajador (edición, patrón rápido L–V, copiar semana, botón × para vaciar
  tramo) y **vista por centro** (solo lectura, **color por trabajador**, coincidentes **en fila** y
  **ordenados por hora de entrada** — mañana antes que tarde, helper `inicioTurno` en `Cuadrante.tsx`).
- Cada **trabajador tiene color propio** (ficha “Color en la agenda”; por defecto de paleta
  `COLORES_TRABAJADOR`; fallback por id con `colorTrabajador`).
- Confirmación antes de borrar. Backup = descargar/subir el `.db` (Ajustes). Motor `src/shared` sin Electron/React.
- **Exportación cuadrante (PDF `html-docs.ts` + Excel `generate-excel.ts`):** las columnas **Centro** y
  **Horario** solo se rellenan cuando la situación es `trabaja`; en Libre/Vacaciones/Baja/Festivo/Permiso
  van en blanco (el turno puede conservar `centro_id`/tramos heredados, pero no se muestran → no confunde).

## Estado
Desplegada y **en uso real por el usuario en su Umbrel** (versión web), con acceso local (PWA) y
**remoto por Tailscale** funcionando (verificado por el usuario desde el Mac en otra red). Typecheck +
build + 32 tests en verde. Cada cambio: implementar → `typecheck`/`test`/`build:webapp` → verificar en
navegador con datos reales sembrados → commit + push al branch → pasar al usuario el comando de
actualización de Umbrel.

**Próxima sesión (mañana):** el usuario quiere seguir con "algunas mejoras" (sin concretar aún).

**Pendiente / ideas:** confirmar si el plus de transporte va exento; permitir nº de pagas extra distinto
de 3; posible selector de color/tamaño de pastillas y **mostrar código junto al nombre en la agenda**;
**arrastrar-y-soltar** turnos; **festivos por provincia** autocargados; firma digitalizada en el PDF;
**Opción B de acceso** (tile propio dentro del panel de Umbrel; pendiente saber hardware del Umbrel
Intel/x86 vs Raspberry Pi para compilar imagen GHCR).
