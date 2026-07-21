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

## Despliegue en Umbrel (producción del usuario) — app de la tienda (Opción B, ACTIVA)
- **Desde 20/07/2026 la app corre como app de Umbrel instalada** desde la community app store
  `https://github.com/voleyplayaponiente-glitch/bespain-umbrel-store` (store id `bespain`, app
  `bespain-gestor-laboral`, tile con icono propio en el panel). Umbrel Home 2025 (Intel x86_64),
  umbrelOS 1.7.4. **Contraseña de acceso = la que genera Umbrel** (⋯ del tile → credenciales);
  la contraseña antigua ya no aplica. Datos en `${APP_DATA_DIR}/data` de la app (migrados por
  restauración del .db); puerto 3000 publicado directo (sin app_proxy) → PWA y Tailscale intactos.
- **Publicar una actualización:** (1) push a la rama → GitHub Actions construye y sube
  `ghcr.io/voleyplayaponiente-glitch/gestor-laboral:latest` (workflow `publicar-imagen.yml`, amd64);
  (2) subir `version` en `bespain-gestor-laboral/umbrel-app.yml` del repo de la store (clon en
  `/workspace/bespain-umbrel-store`, add_repo si hace falta) y push a su `main` → al usuario le
  aparece **Update** en Umbrel. Ya NO se usa el comando tar/docker del terminal.
- El despliegue manual antiguo quedó parado (`docker compose down`) en
  `/home/umbrel/umbrel/home/clauderoutine-claude-labor-management-scheduling-app-jd2hcj`; su carpeta
  `datos/` sigue en disco como copia extra de seguridad.
- El pegar en el terminal de umbrelOS es **Ctrl+Shift+V**; el usuario NO puede copiar la salida →
  pide capturas. Acceso a la app: `http://umbrel.local:3000`.

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
- NO guardar en el repo ninguna contraseña real. Con la app de la tienda, `GESTOR_PASSWORD` viene de
  `APP_PASSWORD` (generada por Umbrel, visible en el ⋯ del tile). Las copias cifradas creadas con la
  contraseña antigua NO se pueden restaurar ya (clave distinta); las nuevas van con la actual.

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

## Modelo de datos (SQLite) — esquema v7
`empresa → centro (+ festivo) → trabajador (+ trabajador_centro N:M) → cuadrante (1/mes) → turno (1/día, 2 tramos)`
`+ convenio_salario` (global, sin FK).
Versionado por `PRAGMA user_version`, migración incremental en `db/database.ts`:
- v2: horario del centro por tipo de día + campos de retribución básicos.
- v3: `retribucion_especie_exenta`. v4: `codigo`, `plus_transporte`. v5: `jornada_completa_semanal`.
- v6: `color` del trabajador. v7: tabla `convenio_salario` (convenio, categoria, salario_base,
  plus_productividad, plus_transporte, precio_hora_complementaria, horas_convenio_anuales, notas).

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
- **Fase 10 (20/07/2026):** (1) **Exportación del calendario por centros** (la vista por centro):
  `datosCuadranteCentros` en export-data, `htmlCuadranteCentros` (A4 apaisado, pastillas de color,
  orden mañana→tarde, total h/centro) y `bufferCuadranteCentrosExcel` (richText coloreado); endpoints
  `/api/export/cuadrante-centros-{pdf,excel}`, tarjeta en Exportación, también en escritorio (ipc).
  (2) **Ficha de alta Excel** (`services/ficha-alta.ts`), **rehecha (Fase 11) sobre el modelo real del
  despacho** (FORMULARIO_CONTRATACION_TRABAJADOR): 8 secciones (personales, contacto/domicilio, banco,
  modelo 145, contrato/puesto, formación, emergencia, observaciones) + bloque RGPD/firma. Etiquetas col
  B/valores col C; parse con compuestos (apellido1+2 → apellidos, domicilio por partes → direccion,
  salario bruto anual ÷ nº pagas → sueldo mensual, prueba en días → fecha fin desde el alta) y el resto
  de campos se vuelca a Observaciones (nada se pierde). Devuelve además `centro` (nombre) y la UI lo
  asigna si coincide con un centro existente. Endpoints `/api/ficha-alta/{plantilla,parse}`; botones en
  Trabajadores (`window.api.fichaAlta` **opcional**, solo web) → abre el alta precargada.
  (3) **Pestaña Convenios** (`screens/Convenios.tsx`, nav 📋): CRUD de `convenio_salario`; en la ficha
  del trabajador (sección Retribución) selector "Aplicar salario según convenio" que rellena salario
  base, pluses, €/h complementaria y horas anuales del convenio. `colorTrabajador` movido a
  `shared/colores.ts` (re-export en defaults.ts).

## Estado
Desplegada y **en uso real por el usuario en su Umbrel** (versión web), con acceso local (PWA) y
**remoto por Tailscale** funcionando (verificado por el usuario desde el Mac en otra red). Typecheck +
build + 32 tests en verde. Cada cambio: implementar → `typecheck`/`test`/`build:webapp` → verificar en
navegador con datos reales sembrados → commit + push al branch → pasar al usuario el comando de
actualización de Umbrel.

**Estado del despliegue (21/07/2026):** publicada la **versión 1.2.0** en la store (Fases 10+11:
calendario por centros filtrable y rediseñado, ficha de contratación según el modelo del despacho,
pestaña Convenios); el usuario actualiza con el botón Update de Umbrel. Se le envió el Excel de la
ficha nueva para revisión: **pendiente su OK o cambios de campos**.

**⚠️ Notas operativas del entorno remoto:** (1) el contenedor puede RESTAURARSE a un estado anterior
entre turnos → si el árbol local no cuadra con lo esperado, `git fetch` + `git reset --hard origin/...`
(todo lo importante debe empujarse SIEMPRE al terminar cada cambio; el clon de la store en /workspace
también se pierde → re-clonar). (2) El proxy de git REESCRIBE los commits al empujar (el sha remoto ≠
sha local) → para esperar la imagen GHCR del workflow, comprobar el estado del run por la API de
GitHub o usar el tag `latest`, no el sha local.

**Pendiente / ideas:** confirmar si el plus de transporte va exento; permitir nº de pagas extra distinto
de 3; posible selector de color/tamaño de pastillas y **mostrar código junto al nombre en la agenda**;
**arrastrar-y-soltar** turnos; **festivos por provincia** autocargados; firma digitalizada en el PDF.

**Opción B (tile en el panel de Umbrel) — ✅ COMPLETADA (20/07/2026):** app instalada desde la
community app store y **confirmada funcionando por el usuario** (datos migrados por restauración del
.db). Detalles operativos en la sección "Despliegue en Umbrel". Fuente de la store versionada en
`umbrel-store/` de este repo (copia espejo de lo publicado en `bespain-umbrel-store`): si se cambia,
copiar también al repo de la store. El paquete GHCR es público. El PR #2 sigue abierto (base main);
rama default del repo es la de vóley.
