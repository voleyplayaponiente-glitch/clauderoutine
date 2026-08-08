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
npm test         # 356 tests (Vitest) del motor
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

## Importación de extractos bancarios
- **`dominio/n43.ts`**: las posiciones del registro 22 son las de la norma
  (fecha op. 11-16, fecha valor 17-22, debe/haber 28, importe 29-42, doc. 43-52, ref. 53-64).
  Un bug de 4 posiciones de desplazamiento daba fechas tipo «26/32/2016» e importes de miles
  de millones. **Los tests construyen cada registro campo a campo y comprueban que mide 80**,
  para que una prueba no pueda volver a validar un desplazamiento equivocado.
- Se valida la fecha (mes 1-12, día real) y el importe: lo ilegible **se descarta con motivo**,
  nunca se muestra una fecha inventada. Con el registro 33 se verifica el nº de apuntes y que
  saldo inicial − debe + haber = saldo final; si no cuadra, se avisa.
- **`dominio/texto.ts`**: los extractos españoles vienen en Windows-1252. Se prueba UTF-8 y, si
  aparece «�», se redecodifica. Sin esto salía «Aportaci�n de capital».
- **CONVENCIÓN NUMÉRICA: no se supone, se deduce del fichero.** CaixaBank exporta el Excel de
  una cuenta en anglosajón (`3,000.00`) y el PDF de ESA MISMA cuenta en español (`3.000,00`).
  Aplicar la heurística española al Excel convertía 3.000 € en 3 €. `detectarConvencionNumerica`
  mira los valores con los DOS separadores (ahí el de la derecha es el decimal sin ambigüedad) y
  `parsearImporte` la aplica. `parsearNumeroEs` se mantiene intacto para el resto de la app.
- Fechas con **mes en letra** (`1 Jul 2026`, `24 de abril de 2026`) en `parsearFechaFlexible`.
- **PDF de banca digital**: cada celda se dibuja DOS VECES en la misma coordenada (capa visible +
  accesibilidad) → se deduplica por `(x, y, texto)`. Y la fecha va 1-2 puntos por encima del resto
  de la fila, así que las filas se agrupan **por cercanía vertical** (tolerancia 4), no por
  redondeo fijo, que las separaba. Los importes admiten el signo suelto (`- 30,00 €`).
- La columna «Más datos» se añade al concepto: sin ella, `L0431-L0422/2026` no dice nada.
- `extracto-caixabank.test.ts` es la regresión con los DOS ficheros reales del banco.
- **`dominio/extracto.ts`**: hojas de banca electrónica (detecta la fila de cabeceras aunque
  haya rótulos encima, columnas fecha/concepto/importe o cargo/abono) y líneas de PDF
  (fecha al principio + importe; con dos importes el último es el saldo, se coge el penúltimo).
- **`lib/extracto.ts`**: N43 · Excel · CSV · PDF (pdf.js en carga diferida; el worker se sirve
  del propio bundle porque la CSP prohíbe CDN). Un PDF escaneado **no se adivina**: se dice que
  no tiene capa de texto y que se metan a mano.
- **Anular movimientos**: selección múltiple en la tabla de Bancos + «Anular N». Es anulación
  **lógica** (`anuladoEn`): salen de la lista y del saldo, pero queda el rastro. `esFechaIsoValida`
  (en `validacion.ts`) detecta los movimientos que quedaron con fecha imposible (`2016-32-26`)
  del parser antiguo y ofrece seleccionarlos de golpe.
- Cada importación registra un `LoteImportacion` (destino `movimientos-banco`) con los ids
  insertados, así que se puede deshacer una tanda entera.
- **Conciliar** = dejar constancia de que ese apunte se ha cotejado con el extracto del banco.
  El contador «No conciliados» es la lista de pendientes de comprobar. Se marca uno a uno con el
  Sí/No de su fila, o **en bloque** seleccionando y pulsando «Conciliar N» / «Desconciliar»
  (`conciliarMovimientos` en el store, una sola escritura). Es reversible y no altera importes.
- La importación **siempre pasa por previsualización** (`ModalImportarExtracto`): se ven los
  movimientos leídos, la suma y las líneas descartadas con su motivo antes de tocar nada.

## Inversiones (`dominio/inversiones.ts`)
Cartera de fondos, acciones, cripto, inmuebles, depósitos y préstamos concedidos.
Cuatro reglas del PGC que **no se negocian**:
1. El **coste incluye los gastos** de compra (comisiones, ITP, notaría). NRV 9.ª.
2. **La plusvalía latente NO es beneficio**: se muestra aparte, en gris y con la coletilla
   «no es beneficio», y jamás entra en el resultado ni genera asiento.
3. **La minusvalía latente SÍ**: si el valor cae bajo el coste, `deterioroSugerido` lo dice en
   rojo. La asimetría es deliberada (prudencia).
4. **El terreno no se amortiza**, solo la construcción: el inmueble guarda las dos partes y
   `amortizacionAnualInmueble` solo divide la construcción.
- Al vender se da de baja el **precio medio ponderado** (criterio del PGC, no FIFO), igual que
  el almacén. La diferencia con el neto cobrado va a 766 (beneficio) o 666 (pérdida).
- Cripto con **8 decimales**; fondos con 6.
- **Genera asientos**: `asientosInversion` se engancha en `lib/contabilidad.ts`, así que las
  inversiones entran en sumas y saldos, balance y P&G. Verificado en navegador que el libro
  cuadra (206.305 € debe = haber) y que el saldo de la 250 coincide con el coste de la cartera.
- La cripto **no tiene cuenta oficial en el PGC** (el ICAC la trata como intangible si es
  inversión, o existencias si el negocio es comprar y vender): la cuenta es editable y la app
  avisa de que se confirme con la asesoría.

## Naturaleza del gasto, factura en PDF y paso al presupuesto
- **DOS LISTAS SEPARADAS, y es una decisión del usuario, no un detalle:**
  · **Compras (`ambito: 'COMPRAS'`) = «naturaleza del gasto»**, porque es donde están las
    facturas. Son estas 20 y ese es el catálogo oficial: Stock nacional · Stock internacional ·
    Alquileres · Gastos de ventas · Gasolina deducible · Gasolina NO deducible · Gastos de
    oficina · Alarma · Teléfono · Wifi · Luz · Mantenimiento · Mantenimiento NO deducible ·
    Marketing y publicidad · Gestoría · Renting de vehículos · Gastos de IA · Gastos de TPV ·
    Gastos varios de tiendas · Gastos generales. **No renombrarlas ni reordenarlas sin pedirlo.**
  · **Bancos (`ambito: 'BANCO'`) = «concepto del cargo»**, para lo que **no lleva factura**:
    Facturas de proveedores (ya en Compras) · Comisiones de TPV · Comisiones bancarias · Gastos
    de mantenimiento · Intereses y gastos financieros · Seguro de RC · Seguro de vida · Seguro
    de salud · Tributos: trimestre corriente · Tributos: cuota de aplazamiento · Seguridad
    Social · Cuota de préstamo (ya en Deudas) · Traspaso entre cuentas propias · Otros gastos
    sin factura.
  · `ambitoDe`/`categoriasDe`/`efectoPresupuestoDe` (en `resumen-compras.ts`) son los que
    filtran. Las categorías guardadas antes de la separación **no traen `ambito`**: se deduce de
    `esBancaria`, así que los datos viejos siguen funcionando.
- **`efectoPresupuesto` evita presupuestar dos veces lo mismo** (la regla que sostiene todo esto):
  · `NINGUNO` — facturas de proveedores (el gasto ya está en Compras), cuotas de préstamo (ya
    salen del cuadro de deuda) y traspasos entre cuentas propias. **No se llevan al presupuesto.**
  · `FINANCIACION` — tributos del trimestre, cuotas de aplazamiento y Seguridad Social: sale
    dinero pero se salda una deuda ya devengada, no es gasto de P&G.
  · `GASTO` — comisiones, mantenimiento, seguros, intereses. Sin indicar, se trata como gasto.
  Banderas restantes: `esStock`, `esInternacional`, `esBancaria`, `deduciblePorDefecto`.
- `fusionarCategorias` (store) añade a los datos ya guardados las categorías nuevas del catálogo
  sin tocar las que el usuario haya editado o creado.
- **La categoría manda en Compras**: al elegirla se fijan naturaleza, cuenta PGC y deducibilidad.
  «Stock internacional» abre el campo **Impuesto especial soportado** (`Compra.impuestoEspecial`);
  las NO deducibles exigen motivo.
- **`dominio/resumen-compras.ts`** (puro): `resumirCompras` calcula el **coste real** = base +
  IVA no deducible + impuesto especial (el IVA que no se deduce **es más gasto**, no desaparece),
  y separa `costeStock` de `costeEstructura`. El resumen mensual de Compras sale de aquí.
- **`dominio/factura-pdf.ts`**: lectura **asistida** de la factura en PDF. Propone, no decide.
  · **El cuadre manda**: si base + cuota no da el total leído (>2 cts), **no se rellena ningún
    importe** y se explica por qué. Antes que rellenar mal, no se rellena.
  · El nº de factura se saca por **tokens** tras el rótulo, descartando lo que parezca un importe:
    con la regex antigua «TOTAL FACTURA 2.238,50» colaba como número de factura «2.238».
  · Se descarta el CIF propio para no confundir emisor con receptor; NIF con letra mal → fuera.
  · PDF escaneado (sin capa de texto) → se dice claramente que se meta a mano.
- **Deuda aplazada y gastos del banco → presupuesto**: botón «Traer deuda y gastos del banco».
  · `cuotasDeudaPorMes` reparte por meses las cuotas que salen del **cuadro de amortización real**
    (nada estimado), agrupadas por familia: bancaria · socios · Hacienda · Seguridad Social ·
    comercial · otra. Se crean líneas `Deuda: …` de tipo FINANCIACIÓN (devolver principal no es
    gasto de P&G). **Ojo: la primera cuota vence un periodo DESPUÉS de `fechaInicio`.**
  · `gastosBancariosPorMes` lleva a líneas `Banco: …` de tipo GASTO lo que cobra el banco.
  · Es **idempotente**: se empareja por concepto, pulsarlo dos veces actualiza, no duplica.
- **Bancos**: cada salida tiene su selector de «Concepto del cargo» (lista del banco) y el panel
  **«Cargos de la cuenta: de dónde vienen»** (`gastosCuentaPorCategoria`) agrupa las salidas del
  año/mes en *Gasto* · *Impuestos y deuda* · *Ya contado* · *Sin clasificar*, esto último en rojo
  (sin clasificar no entra en el presupuesto).

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

## Estado — Fases 0–12 + seguridad + multi-empresa + accionariado + extractos + inversiones + gasto/deuda al presupuesto (356 tests en verde)
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
