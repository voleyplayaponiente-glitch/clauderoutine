# CLAUDE.md — App de Gestión Financiera Integral

Memoria del proyecto para Claude Code. Léelo al empezar cualquier sesión que toque `finanzas/`.

## Qué es
Aplicación web **en español**, **client-first / PWA offline-first**, de **gestión financiera
integral** para una S.L. de retail (negocio de **vapeo**) con varios puntos de venta, stands
y venta online. Estética estilo Apple, modo claro/oscuro, responsive.

- **App en producción:** https://voleyplayaponiente-glitch.github.io/clauderoutine/finanzas/
- **Repo:** voleyplayaponiente-glitch/clauderoutine · vive en la carpeta `finanzas/`
- **Rama de desarrollo (finanzas):** `claude/preparar-aplicacion-c947u8`
- **Convive con** la app de vóley (raíz del repo) y una de gestión laboral; **no se tocan**.

## Decisión de arquitectura (deliberada)
**Client-first** como la app de vóley: Vite + React 19 + TypeScript + Tailwind v4 + Zustand +
IndexedDB (idb-keyval). Gráficos con Recharts, PDF con jsPDF, Excel con SheetJS (xlsx).
**No backend obligatorio**: el usuario es **un solo administrador**, aloja en GitHub Pages
(estático) y usa la app desde el **iPhone en la tienda** (un backend en su Mac no sería
accesible). El motor de cálculo está aislado en **TS puro** para poder añadir sincronización
a servidor sin reescribir. Las librerías pesadas (recharts/xlsx/jspdf) van en **carga diferida**.

## Comandos
```bash
cd finanzas
npm install
npm run dev      # http://localhost:5173
npm test         # 187 tests (Vitest) del motor
npm run build    # tsc -b && vite build  (GITHUB_PAGES=true para base /clauderoutine/finanzas/)
npm run preview  # previsualizar (¡recompila sin GITHUB_PAGES para preview local!)
```

## Arquitectura
- `src/dominio/` — **motor puro en TS, sin React** (aquí vive la lógica, todo testeado):
  `dinero` (céntimos, sin float), `parseo-es` (heurística de millar: `180.000`=180000),
  `iva`, `partida-doble`, `validacion` (NIF/CIF), `ventas`, `compras`, `asientos`,
  `tesoreria`, `conciliacion`, `n43`, `valoracion` (coste medio), `stock`, `inventario`,
  `amortizacion`, `vencimientos`, `prevision`, `ratios`, `alertas`, `libros` (sumas y saldos,
  balance, P&G), `registros-fiscales` (303/347), `backup` (checksum), `conectores`, `csv`,
  `importacion`, `defaults`, `tipos`, `id`.
- `src/lib/` — capa con efectos: `db` (IndexedDB), `router` (hash), `fechas`, `flujos`,
  `dashboard`, `contabilidad` (genera asientos), `exportar` (CSV/Excel/PDF), `copias`,
  `conectores` (transporte), `importacion` (lectura ficheros), `backup`.
- `src/store/store.ts` — estado global (Zustand) + persistencia con debounce + migración.
- `src/pantallas/` — una pantalla por módulo. `src/componentes/` — UI reutilizable.
- `servidor/` — microservicio Node (Umbrel) para conectores (ver abajo).

## Grupo de empresas (multi-empresa)
**Invariante**: cada sociedad es una entidad jurídica independiente y sus datos viven en un
espacio propio de IndexedDB (`finanzas:config:<id>` / `finanzas:datos:<id>`). NUNCA se mezclan
libros de dos empresas. El índice del grupo (`finanzas:grupo`) solo guarda las fichas y las
participaciones.
- `dominio/grupo.ts` (puro): validación de participaciones (rango, capital ≤ 100 %, sin
  duplicados, **sin ciclos**), `porcentajeEfectivo` (multiplica por cadena y suma caminos),
  `relacionPorPorcentaje` (>50 dependiente, ≥20 asociada), organigrama y `agregarGrupo`.
- `lib/grupo.ts`: lee el espacio de cada empresa y calcula sus cifras con el mismo motor.
- `store.ts`: `grupo` + `cambiarEmpresa`/`crearEmpresa`/`eliminarEmpresa`/`guardarParticipacion`.
  El debounce **captura la empresa destino en el momento de la llamada** y `cambiarEmpresa`
  vacía lo pendiente antes de soltar el espacio: un guardado tardío nunca cae en otra sociedad.
- Migración desde la versión de empresa única en `db.ts` (`migrarDesdeEmpresaUnica`): copia
  `finanzas:configuracion`/`finanzas:datos` al espacio de la primera empresa y **solo borra las
  claves antiguas tras verificar** que las nuevas se escribieron.
- **La suma del grupo NO es consolidación** (no elimina tráfico intragrupo). La pantalla lo
  advierte; no sirve para depositar cuentas consolidadas.
- Restaurar un backup afecta **solo a la empresa activa**; si el CIF/razón social no coinciden
  (`mismaEmpresa`) se muestra un aviso rojo antes de sobrescribir.
- Fiscalidad decidida: **cada empresa declara por separado** (303/347/IS propios).

### Accionariado (`dominio/socios.ts`)
Libro registro de socios por empresa, dentro de `grupo.socios`.
- **El % NUNCA se teclea**: se deriva del `capitalNominal` de cada socio sobre el capital de
  referencia (el `capitalSocial` escriturado de la empresa; si es 0, la suma de lo aportado).
- `capTable` une socios personas/terceros **+ las empresas del grupo que participan**, para que
  el cuadro sume el 100 % real. A las empresas del grupo se les deduce el nominal desde su %.
- `primaEmision` engorda fondos propios (110) pero **no da más %**; `pendienteDesembolso` se
  registra aparte y no puede superar lo suscrito.
- Bajas **lógicas** (`fechaBaja`): salen del reparto y quedan en el histórico, nunca se borran.
- `resumenAccionariado` expone el **descuadre** entre escriturado y repartido; la UI lo pinta en
  rojo, nunca se oculta. `avisosAccionariado` señala unipersonalidad (S.L.U.), capital sin
  repartir, pendiente de desembolso y nominales unitarios incoherentes.
- **El backup incluye ahora `grupo`** (empresas, participaciones y socios). El checksum se
  calcula sobre `{config,datos,grupo}` solo si hay grupo, así los backups antiguos siguen siendo
  válidos con la fórmula antigua.

## Reglas de negocio clave
- **Partida doble interna**: cada venta/compra/regularización genera su asiento cuadrado.
  El **balance de sumas y saldos cuadra por construcción** y coincide con Balance de Situación
  y P&G (criterio 4). Un descuadre **nunca se oculta**: se muestra en rojo.
- IVA con separación base/cuota/total en cualquier dirección; exento/no sujeto/ISP.
- **Impuesto especial de vapeo (modelo 573, desde 01/04/2025):** 0,15 €/ml (≤15 mg/ml o sin
  nicotina) y 0,20 €/ml (>15 mg/ml). **Editable**, con vigencia; nunca hardcodeado.
- **Límite de pago en efectivo entre empresarios: 1.000 €** (Ley 11/2021). Editable.
- Ventas: cobros deben cuadrar con el bruto; no se cierra el día con descuadre. Firma responsable.
- Compras: deducibilidad con motivo obligatorio si no es deducible.
- Stock: **coste medio ponderado** por artículo y almacén; inventario → asiento 300/610.
- Deudas: cuadro francés/lineal. Deudores: antigüedad + provisión escalonada.

## Estado — Fases 0–12 + seguridad + multi-empresa + accionariado (187 tests en verde)
Configuración · Ventas · Compras · Caja/arqueos · Bancos (N43+conciliación) · Stock ·
Importación (Excel/CSV, 4 pasos) · Deudas/Deudores · Presupuesto+Cash flow · Previsión de
tesorería (alerta de tensión) · Dashboard interactivo · Informes (IVA/303/347, balance, P&G,
PDF ejecutivo) · Copias de seguridad (JSON+Excel, checksum, restauración) · Pulido
(accesibilidad, densidad, iconos PWA) · **Conectores** (Fase 11).

## Despliegue (importante)
- El workflow `.github/workflows/deploy.yml` (raíz del repo) compila **el vóley en la raíz**
  y **finanzas en `/finanzas/`** (instala deps, tests y build de finanzas, y combina el artefacto).
- **El entorno `github-pages` está restringido a la rama del vóley**
  (`claude/tournament-bracket-manager-gvrcdt`). Por eso `main` y la rama de finanzas **compilan
  pero no publican** (el job `deploy` se rechaza sin runner). **Para publicar hay que desplegar
  desde la rama del vóley**: se hizo con un PR de la rama de finanzas → rama del vóley
  (fast-forward, vóley idéntico + finanzas añadida). Alternativa: cambiar en Settings →
  Environments → github-pages → «Deployment branches» a «No restriction» y desplegar desde main.
- **Receta de despliegue ya probada** (desde la rama de finanzas, sin tocar el vóley):
  `git checkout -B despliegue origin/claude/tournament-bracket-manager-gvrcdt`,
  `git merge claude/preparar-aplicacion-c947u8` (comprobar que el diff **solo** toca `finanzas/`),
  correr tests+build de las dos apps, y
  `git push origin despliegue:claude/tournament-bracket-manager-gvrcdt`.
- Base en Pages: `/clauderoutine/finanzas/` (con `GITHUB_PAGES=true`). Router por hash (sin 404).
- Datos en el dispositivo (IndexedDB). Para pasar de un equipo a otro: Copias → Descargar JSON
  → Restaurar. «Borrar datos del sitio» los pierde.

## Conectores (Fase 11) y servidor Umbrel
- Arquitectura enchufable: interfaz común probar/sincronizar/**previsualizar antes de aplicar**/
  **idempotencia** (por `externalId`). Tipos: Square, banca PSD2, Stripe, Shopify, WooCommerce, Demo.
- **Tres modos** (`Configuración → Conexiones`): DEMO (simulado, para probar sin credenciales),
  DISPOSITIVO (token en IndexedDB; falla con APIs sin CORS como Square), **SERVIDOR (Umbrel,
  recomendado)** — el navegador solo habla con tu servidor, que guarda las credenciales cifradas.
- **Servicio en `finanzas/servidor/`** (Node sin dependencias, Docker). Contrato con
  `Authorization: Bearer <SECRETO>`:
  - `GET /api/estado` → `{ ok: true }`
  - `GET /api/sync/<tipo>` → `{ movimientos: [{ externalId, fecha, concepto, importe }] }`
  - Adaptador real de **Square (payouts)** + demo. `.env.example`, Dockerfile, docker-compose, README.
- **Pendiente para Square real:** levantar el servicio en el Umbrel **con HTTPS** (Tailscale /
  túnel de Cloudflare / reverse proxy), porque la app es HTTPS y bloquea http:// (contenido mixto).
  Luego: Conexiones → Square → modo Servidor → URL del Umbrel + secreto.

## Seguridad (auditoría 2026-07-31 — informe completo en `SEGURIDAD.md`)
Invariantes que **no** se deben romper al tocar el código:
- **Los backups y el export de configuración nunca llevan credenciales**: pasan por
  `redactarCredenciales()` (`dominio/backup.ts`). Si añades un campo secreto a `Conector`,
  añádelo ahí y al test correspondiente.
- **Todo JSON que entra se lee con `parseJsonSeguro()`** (descarta `__proto__`/`constructor`/
  `prototype`). Nunca `JSON.parse` directo sobre un fichero del usuario.
- **La URL del servidor de conectores pasa por `urlServidorSegura()`**: solo HTTPS o HTTP en
  red local, porque el secreto viaja en la cabecera `Authorization`.
- **El servicio `servidor/`**: sin `SECRETO` solo atiende loopback; el secreto se compara con
  `crypto.timingSafeEqual`. No volver a dejarlo abierto por defecto.
- CSP en `index.html` (`script-src 'self'`, `object-src 'none'`): sin scripts externos ni CDN.
- Pendiente asumido: `xlsx` 0.18.5 tiene avisos sin arreglo en npm (SheetJS ya no publica ahí).
  Se mitiga leyendo con `sheet_to_json({ header: 1 })`. Ver `SEGURIDAD.md` para las 2 opciones.

## Convenciones
- Interfaz y errores **en español**. Motor **sin dependencias de React** (testeable aislado).
- Formato español: coma decimal, punto de millar, € detrás; números tabulares.
- Nunca inventar un dato que no se puede leer (PDF de factura → a mano). Nunca borrado físico
  sin rastro (borrado lógico `anuladoEn`). Tipos fiscales siempre editables en Configuración.
- Verificado en cada fase con build limpio, tests en verde y captura en navegador (Playwright).

## Ampliable / pendiente
- Roles por tienda y auditoría inmutable → requieren backend.
- Facturación electrónica verificable (estructura preparada, sin certificar en v1).
- Más adaptadores de conector en el servidor (banco PSD2, Stripe, Shopify…).
- Siembra de mejores terceros, drag-and-drop, sincronización PostgreSQL.
