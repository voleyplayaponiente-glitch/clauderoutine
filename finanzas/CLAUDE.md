# CLAUDE.md — App de Gestión Financiera Integral

Memoria del proyecto para Claude Code. Léelo al empezar cualquier sesión que toque `finanzas/`.

## Qué es
Aplicación web **en español**, **client-first / PWA offline-first**, de **gestión financiera
integral** para una S.L. de retail (negocio de **vapeo**) con varios puntos de venta, stands
y venta online. Estética estilo Apple, modo claro/oscuro, responsive.

- **App en producción:** https://voleyplayaponiente-glitch.github.io/clauderoutine/finanzas/
- **Repo:** voleyplayaponiente-glitch/clauderoutine · vive en la carpeta `finanzas/`
- **Rama de desarrollo (finanzas):** `claude/preparar-aplicacion-c947u8`
- **Rama de publicación:** `claude/tournament-bracket-manager-gvrcdt` (ver «Despliegue»).
- **Convive con** la app de vóley (raíz del repo) y una de gestión laboral; **no se tocan**.
- **Último despliegue verificado:** `8ed73b2` (08/08/2026) — 384 tests, build y Pages en verde.

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
npm test         # 565 tests (Vitest) del motor
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
  · **Bancos (`ambito: 'BANCO'`)**, para lo que **no lleva factura**, con DOS sublistas según
    `flujo`. **Cargos** (`flujo: 'SALIDA'`, el valor por defecto):
    Facturas de proveedores (ya en Compras) · Comisiones de TPV · Comisiones bancarias · Gastos
    de mantenimiento · Intereses y gastos financieros · Seguro de RC · Seguro de vida · Seguro
    de salud · Tributos: trimestre corriente · Tributos: cuota de aplazamiento · **Nóminas
    (640, GASTO)** · Seguridad Social · Inversiones en empresas del grupo (2403) · Inversiones
    financieras (250) ·
    **Préstamos a socios (253)** — ojo, es lo contrario de «Préstamos de socios», que es deuda ·
    Cuota de préstamo (ya en Deudas) · Traspaso entre cuentas propias · Otros gastos sin factura.
    **Abonos** (`flujo: 'ENTRADA'`): Cobros de clientes (ya en Ventas) · Dividendos recibidos ·
    Retrocesión de comisiones bancarias · Intereses a favor · Subvenciones · Devolución de
    préstamos concedidos · Venta de inversiones · Aportación de capital de socios · Préstamo o
    póliza recibida · Devolución de Hacienda · Traspaso entre cuentas propias · Otros ingresos.
  · `ambitoDe`/`categoriasDe`/`efectoPresupuestoDe` (en `resumen-compras.ts`) son los que
    filtran. Las categorías guardadas antes de la separación **no traen `ambito`**: se deduce de
    `esBancaria`, así que los datos viejos siguen funcionando.
- **`efectoPresupuesto` evita presupuestar dos veces lo mismo** (la regla que sostiene todo esto):
  · `NINGUNO` — facturas de proveedores (el gasto ya está en Compras), cuotas de préstamo (ya
    salen del cuadro de deuda) y traspasos entre cuentas propias. **No se llevan al presupuesto.**
  · `INGRESO` — solo en abonos: dividendos, retrocesiones, intereses a favor, subvenciones.
    **No todo lo que entra es ingreso**: el capital y los préstamos recibidos son FINANCIACION y
    la devolución de un préstamo concedido o la venta de una inversión son INVERSION.
  · `INVERSION` — participaciones en empresas del grupo, inversiones financieras y préstamos a
    socios (y sus desinversiones al volver): el dinero no
    se consume, se cambia por un activo, así que no resta del resultado. **Clasificar el
    movimiento NO da de alta ni de baja la inversión**: eso se hace en la pantalla de Inversiones, que es la que lleva
    coste, valor y asientos. La app lo avisa bajo el panel.
  · `FINANCIACION` — tributos del trimestre, cuotas de aplazamiento y Seguridad Social: sale
    dinero pero se salda una deuda ya devengada, no es gasto de P&G.
    **OJO, incoherencia conocida**: las **nóminas** sí son GASTO (640) porque aquí no hay módulo
    de personal y el pago por banco es el único registro que queda; si no contaran, la partida
    más grande del negocio no aparecería en el presupuesto. Por el mismo razonamiento, la
    Seguridad Social **a cargo de la empresa** (642) es coste real y hoy no se cuenta. Planteado
    al usuario; **pendiente de su decisión** (ver «Decisiones abiertas»).
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
  · **El cuadre manda**: si base + IVA **− retención** no da el total leído (>2 cts), **no se
    rellena ningún importe** y se explica por qué. Antes que rellenar mal, no se rellena.
  · **LA RETENCIÓN DE IRPF NO ES OPCIONAL AL CUADRAR.** Un alquiler o un profesional la llevan y
    base + IVA NO da el total. Sin leerla el cuadre fallaba, se descartaban los tres importes y
    se desglosaba el total al 21 %: una factura real de 1.942,14 € (base 1.904,06 + IVA 399,85 −
    retención 361,77) salía con base 1.605,07 €. `factura-real.test.ts` es la regresión, escrita
    con el texto exacto del PDF del proveedor.
  · **«SUBTOTAL» es una etiqueta de base normal**: no filtrarla por contener «total», que es
    justo lo que dejaba la base sin leer.
  · Fechas en letra («1 de agosto de 2026») y con puntos (`08.08.2026`). Se prefiere la línea con
    «fecha» **evitando la de vencimiento**.
  · NIF con prefijo intracomunitario y guiones (`NIF:ESH-53314811`): se compactan puntos y
    guiones antes de validar, respetando los espacios para no fabricar un NIF inexistente.
  · **El proveedor se toma de las líneas que hay encima de su NIF**, no de la primera línea con
    letras: esa suele ser el logotipo del membrete (daba «Centro Comercial» en vez de «Comunidad
    de Propietarios Centro Comercial Gran Via»). Si no está de alta, el panel ofrece «Crear con
    estos datos» con nombre y CIF ya rellenos.
  · El nº de factura se saca por **tokens** tras el rótulo, descartando lo que parezca un importe:
    con la regex antigua «TOTAL FACTURA 2.238,50» colaba como número de factura «2.238».
  · Se descarta el CIF propio para no confundir emisor con receptor; NIF con letra mal → fuera.
  · La retención leída se precarga en `Compra.retencion`.
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
  año/mes con un conmutador **Cargos / Abonos**: en cargos *Gasto* · *Inversión* · *Impuestos y
  deuda*; en abonos *Ingreso de verdad* · *Desinversión* · *Capital y financiación*. Lo *Sin
  clasificar* va en rojo en ambos (sin clasificar no entra en el presupuesto).
- **Signo en el presupuesto**: las líneas de inversión y financiación restan, así que las
  **entradas** se apuntan en NEGATIVO (`Banco (entra): …`) para que sumen a la caja sin contarse
  como beneficio. Los ingresos de verdad van en positivo. La pantalla lo explica al pie.

## Centros de coste (puntos de venta del grupo)
`CENTROS_COSTE_DEFECTO` en `dominio/defaults.ts` precarga los cinco del grupo: **VAPESSENCE GV
ALICANTE** (stand) · **VAPESPACE SAN JUAN** (tienda) · **VAPESSENCE ALFAFAR** (stand) ·
**VAPESSENCE GV HORTALEZA** (stand) · **VAPESPACE.ES** (web).
- **Los ids son FIJOS** (`cc-gv-alicante`, `cc-san-juan`, `cc-alfafar`, `cc-gv-hortaleza`,
  `cc-vapespace-es`): cada compra y cada venta guardan el id del centro, así que cambiarlos
  dejaría los movimientos apuntando a un centro inexistente. No regenerarlos con `nuevoId()`.
- `fusionarCentros` (store) los añade a las configuraciones ya guardadas sin pisar lo que el
  usuario haya editado (nombre, tipo, `activoHasta`), igual que `fusionarCategorias`.
- Tipos confirmados por el usuario: GV Alicante, Alfafar y GV Hortaleza son **stands** en centro
  comercial; San Juan es **tienda**; VAPESPACE.ES es la **web**. Editables en Configuración.

## Tarjetas de empresa
`TARJETAS_DEFECTO`: Bankinter · BBVA · Sabadell · CaixaBank (ids `tar-<banco>`, editables).
- **«Pagado con tarjeta» a secas no vale**: sin saber cuál, el cargo no se puede cuadrar con el
  extracto del banco que la emite. Al elegir forma de pago TARJETA aparece el selector, y en el
  listado sale la tarjeta o un «tarjeta sin indicar» en ámbar.
- `Compra.tarjetaId` solo tiene sentido con `formaPago === 'TARJETA'`; al cambiar de forma de
  pago se limpia.
- **`Compra.cuentaPagoId` + `fechaPago`**: con TRANSFERENCIA o DOMICILIADO se despliega el
  selector de cuenta de tesorería. Al marcarla **PAGADA sin decir el banco**, la app avisa en
  ámbar (en el formulario y en el listado): un pago sin banco no se puede cuadrar con el extracto.

## Datáfonos y cobros con tarjeta
`DATAFONOS_DEFECTO`: uno por tienda física/stand (no en la web), todos CaixaBank de partida.
- **`Venta.cobros` es `CobroVenta[]`** (antes `{forma, importe}`): el cobro con TARJETA lleva
  `datafonoId`. Sin saber por qué terminal entró, la liquidación del banco no se puede cuadrar.
- **Se propone el datáfono PRINCIPAL de esa tienda** en cuanto se teclea un importe en Tarjeta,
  y se cambia con un clic si ese día cobró otro. El selector marca cuál es «(el principal)».
- **`dominio/datafonos.ts`** (puro): `datafonoPrincipal` (el marcado `principal`, y si no hay
  ninguno el primero activo de esa tienda; **nunca el de otra tienda**), `marcarPrincipal` (solo
  puede haber uno por tienda: al marcar uno se desmarcan sus compañeros, los de otras tiendas no
  se tocan) y `tiendasSinDatafono` (la web no cuenta). En Configuración se marca con un clic.
- **El datáfono es el que viaja, no la tienda**: la asignación vive en `Datafono.centroCosteId`,
  y en Configuración → Tarjetas y datáfonos se mueve de tienda con un desplegable, sin abrir
  nada. Una tienda sin datáfono se avisa allí mismo.

## Importación de ventas en CSV (`dominio/ventas-csv.ts`)
- **Columnas por cabecera, no por posición** (cada TPV exporta a su manera): fecha · tienda ·
  base · IVA · total · tipo · tickets · unidades · efectivo/tarjeta/bizum/transferencia/pasarela.
  Coincidencia exacta primero: si no, «Total» se llevaría por delante a «Total tarjeta».
- La **convención numérica se deduce del fichero** (igual que en los extractos), y la cabecera se
  busca aunque haya rótulos encima.
- `baseYCuota`: con base y cuota no calcula nada; con base y tipo calcula la cuota; solo con el
  total lo desglosa hacia atrás y lo **marca como «desglosado»** en la previsualización.
- `emparejarPunto` casa el texto de la tienda con los centros por código o nombre (y admite que
  uno contenga al otro). **Si es ambiguo o no aparece, devuelve undefined**: la fila queda en
  ámbar para elegir la tienda a mano. Nunca adivina.
- Previsualización obligatoria (`pantallas/ventas/ImportarVentas.tsx`): columnas reconocidas,
  días a importar, sin punto de venta, **ya registrados** (mismo día y tienda → no se duplica) y
  descartadas con motivo. Entran como **borrador**, sin cerrar.
- Si el CSV no trae desglose de cobros se avisa; **no se supone que se cobró todo en efectivo**.
- **Informe «Resumen de ventas» de Square** (`ventas-square.test.ts`, con el fichero REAL):
  · Viene **transpuesto**: una fila por métrica («Ventas netas», «Impuestos», «Efectivo»…) y una
    columna por **día de la semana**. Nada que ver con un CSV por columnas: se detecta por los
    nombres de los días en la cabecera y se lee aparte.
  · **NO lleva fechas dentro**: el periodo va en el nombre. Square lo escribe de varias maneras
    según de dónde se descargue —`resumenventas2026080120260807.csv` y
    `resumen-ventas-2026-08-01-2026-08-01 (1).csv` son el mismo informe—, así que `rangoDeNombre`
    busca **todas** las fechas del nombre (`AAAAMMDD` o `AAAA-MM-DD`) y toma las dos primeras;
    con una sola, el periodo es ese día. Si no hay ninguna, **la previsualización pide la fecha**
    (`necesitaPeriodo`) en vez de dejar al usuario en un callejón sin salida: el dato lo pone la
    persona, no la app.
    La fecha de cada columna sale de cruzar el día de la semana con ese rango, y **solo vale si el
    rango es de 7 días justos**. Con más, «lunes» es la suma de varios lunes: no se importa nada y
    se explica por qué. Sin fechas en el nombre, tampoco se inventa el periodo.
  · Mapeo: base = «Ventas netas» · IVA = «Impuestos» · total = «Ventas brutas» · efectivo =
    «Efectivo» · tarjeta = «Tarjeta» + «Otros» (se avisa de que «Otros» se cuenta como tarjeta) ·
    tickets = «Transacciones de ventas» (exacto, que «Transacciones de impuestos» también contiene
    «impuestos»). Un día a 0 se descarta como día cerrado, no se registra una venta vacía.
  · El fichero no dice de qué tienda es → selector único en la previsualización. **Confirmado
    por el usuario: los informes se sacan SIEMPRE tienda por tienda**, nunca agregados, así que
    una sola tienda para todo el fichero es lo correcto. Con la tienda ya elegida, la columna por
    fila se oculta (si no, la tabla no cabe).
- **Segunda variante: «Resumen de ventas - Resumen»** (un día, una tienda, UNA sola columna de
  valores). Misma regla: la fecha sale del nombre y **solo se importa si el periodo es de un día**;
  si agrega varios, no se reparte. Comprobado que cuadra con la columna del sábado del informe
  semanal, lo que valida de paso el cruce día-de-la-semana → fecha.
  · **«Origen del pago desconocido» es un detalle DENTRO de «Otros»**, no un cobro aparte:
    sumarlos duplicaría el importe (569,40 + 569,40). Solo se leen «Tarjeta» y «Otros».
    **CONFIRMADO por el usuario: «Otros» es el cobro por datáfono.** Square lo llama «origen
    desconocido» porque el terminal no es suyo. Entra como cobro con TARJETA y se asigna al
    **datáfono principal** de la tienda elegida; en la previsualización se ve cuál y se puede
    cambiar antes de importar.
- **BUG de `detectarSeparador` que esto destapó**: miraba solo la primera línea no vacía. En el
  fichero de Square esa línea es el principio de un campo entrecomillado de dos líneas y no tiene
  separadores, así que ganaba el `;` por descarte y el CSV entero se leía como UNA columna. Ahora
  cuenta los separadores **fuera de comillas** en las primeras 12 líneas. Afecta a todos los
  importadores, no solo a ventas.

## Archivo de documentos y carpeta para la gestoría
- **`lib/adjuntos.ts`**: cada PDF vive en su propia clave (`finanzas:adjunto:<empresa>:<id>`),
  NO dentro de `DatosOperativos`. Si fuera dentro, cada guardado reescribiría megas de PDF.
  La compra solo guarda `adjuntoId` + nombre, tipo y tamaño.
- La factura que se sube con «Subir factura en PDF» **se archiva sola**; el adjunto manual del
  formulario también. En el listado aparece un enlace «PDF» que la abre.
- **`dominio/zip.ts`** (puro): escritor de ZIP sin dependencias, método *almacenado* (un PDF ya
  viene comprimido; meter una librería de deflate no compensa y la CSP no admite CDN). CRC-32
  propio, nombres en UTF-8 (bit 11), nombres repetidos numerados. Verificado con `unzip -t` real.
- **«Carpeta para la gestoría»** (resumen de Compras) descarga `compras-AAAA-MM.zip` con el
  resumen por naturaleza, el listado de facturas y `facturas/` con los PDF. Lo que no tenga
  documento se marca **SIN DOCUMENTO** en el listado y se dice en el aviso; no se calla.
- **Los CSV que salen para la gestoría llevan coma decimal** (`numeroCsv` en `lib/exportar.ts`):
  con punto, Excel en español los trata como texto y no se pueden sumar.
- **Aviso pendiente**: los PDF NO viajan en el backup JSON (los volvería enormes). El archivo se
  lleva de un equipo a otro con el ZIP mensual.

## Alta de préstamos desde el fichero del banco (`dominio/prestamo-archivo.ts`)
Botón «Subir cuadro del banco» en Deudas. Admite **varios ficheros a la vez** porque el banco
parte la información en dos descargas, y las dos hacen falta:
- **«Amortizaciones y movimientos»** → la fila **Formalización** da importe inicial, fecha y
  comisión de apertura; el resto son las cuotas ya pagadas. La formalización **NO es una cuota**.
- **«Próximas cuotas»** → el cuadro pendiente. Si solo se sube este, el importe inicial se
  **reconstruye** sumando capital pendiente + amortizado de la primera fila (y se avisa de que es
  una reconstrucción; con el otro fichero delante ese aviso se quita, porque entonces es un dato
  leído).
- **El tipo de interés se CALCULA del propio cuadro**: intereses del periodo entre el capital
  vivo ANTES de esa cuota (= pendiente después + principal de la cuota), por la mediana de varias
  cuotas para que un redondeo no lo tuerza. Con el préstamo real de BBVA da 3,90 %. Se avisa de
  que es un cálculo y hay que confirmarlo con la escritura.
- La **entidad se propone por el código de contrato** (4 primeras cifras: 0182 BBVA, 2100
  CaixaBank, 0081 Sabadell, 0128 Bankinter…). Un código desconocido no inventa banco.
- Periodicidad por la distancia entre vencimientos; sistema FRANCÉS si la cuota es constante.
- **La previsualización compara la cuota del banco con la que calcula la app** y avisa en ámbar
  si se apartan más de 1 €: si no coinciden, el cuadro de la app no sería el del banco. Con los
  ficheros reales coinciden al céntimo (681,14 €), lo que valida de paso que la convención de
  «primera cuota un periodo después de `fechaInicio`» es la del banco.
- `prestamo-archivo.test.ts` es la regresión con los ficheros reales de BBVA **y de CaixaBank**.
- `lib/extracto.ts` → `filasDePrestamo`: Excel (SheetJS), PDF (columnas por 2+ espacios) y CSV.

### Segundo formato: PDF de CaixaBank (lectura por texto)
El PDF de CaixaBank no tiene tabla de columnas separables: las filas del cuadro van con **un
solo espacio** (`14 01/09/2026 494,43 33,01 527,44 7.150,34`) y la cabecera entera en una línea.
Cuando `cabeceraTabla` no encuentra columnas, `leerPrestamo` cae a **`leerTextoPrestamo`**:
- **`aplanar`** normaliza a minúsculas y quita acentos **conservando la longitud** (mapa 1:1). Se
  hizo así porque `normalize('NFD')` cambia el número de caracteres y las posiciones encontradas
  en el texto normalizado ya no casaban con los cortes del original.
- **`ordenColumnas`** deduce del rótulo qué importe es cada uno; busca `capital pendiente`
  **antes** que `capital`, si no «amortización» se lo tragaba.
- Los rótulos del banco se parten entre líneas por el interleaving de columnas
  («Fecha» / «constitución»), así que hay respaldos de una sola palabra
  (`constitucion`, `formalizacion`).
- **La entidad también se saca del IBAN** (`\bES\d{2}\s?(\d{4})\b`) cuando el nº de contrato no
  empieza por código de banco.
- **`nPeriodosPorCuota`** despeja la *n* de la fórmula francesa a partir de importe, tipo y cuota:
  el PDF puede imprimir **solo las cuotas pendientes** (10 de 24) y tomar `cuotas.length` como
  plazo daba un préstamo falso. `fusionarPrestamos` prefiere el plazo deducido y avisa: «el
  fichero lista N cuotas, pero el préstamo son M: el resto no venía impreso».
- El banco **alterna los céntimos** entre cuotas (527,43 / 527,44): la diferencia con la cuota que
  calcula la app es de 1 cts, por debajo del umbral de aviso. No es un error.

### Tercer formato: Excel de Bankinter (`prestamo-bankinter.test.ts`)
Bankinter reparte el préstamo en dos descargas distintas de las de BBVA:
- **«Cuadro Amortizacion»** — rotula a su manera (`FECHA CUOTA`, `IMPORTE CUOTA`, `AMORTIZACION`,
  `IMPORTE PENDIENTE DE AMORTIZACIÓN`), así que los nombres de columna viven en las constantes
  `COLUMNAS_*` y se admiten los de los dos bancos.
- **Las fechas llegan como número de serie de Excel** (46247 = 13/08/2026): `fechaDeSerieExcel`
  las convierte, acotado a 1982-2119 para no tomar un importe por una fecha.
- **«Condiciones»** — no trae cuadro: una fila de rótulos y **una sola fila de valores** con
  importe inicial, fechas, tipo y clase de cuota. Lo lee `leerCondicionesPrestamo`, que se
  intenta antes de caer al camino por texto. `CUOTAS AMORT CTE` = amortización constante →
  sistema **LINEAL**. Los importes vienen como «15000 EUR» y «0 %», y las fechas con puntos
  (`13.07.2026`), que se normalizan solo cuando la forma es inequívocamente una fecha.
- **La entidad sale del IBAN** («Número de cuenta: ES97 0128…»): Bankinter no rotula el contrato.
- **Reconstrucción del importe inicial sin columna de capital amortizado**: capital pendiente de
  la primera fila + su principal, **solo si la suma de todos los principales da lo mismo** (es
  decir, si el cuadro trae todas las cuotas). Si no cuadra, no se rellena.
- Un préstamo al **0 %** es legítimo (este lo es): se lee y se dice en un aviso.

**Los MISMOS dos ficheros en PDF** cambian bastante y también están de regresión:
- Los rótulos van **abreviados y partidos en dos líneas** («F. Inicio /» arriba, «F. Vencimiento»
  debajo). La fila de valores es **la primera que trae cifras**, no la siguiente sin más: si no,
  se leía la segunda línea del rótulo como si fueran los datos.
- Los importes llegan como «5.000,00 EUR». `nucleoNumerico` (parseo-es) quita ahora también el
  código `EUR`, igual que ya quitaba el «€».
- El IBAN del PDF es la **cuenta de cargo**, no la del préstamo: sirve para saber el banco pero
  **no se usa como número de contrato**.
- El test comprueba campo a campo que **el PDF da exactamente el mismo préstamo que el Excel**.

## Renting y póliza de crédito: financiación que NO es un cuadro de cuotas
Los dos viven en la pantalla de Deudas, en secciones aparte, porque ninguno encaja en `Deuda`
(que reparte un principal en cuotas con intereses). El mismo botón «Subir fichero del banco»
reconoce qué documento es (`esFichaRenting` / `esFichaPoliza`) y lo manda a su lector.

### Renting (`dominio/renting.ts`) — **es gasto, no deuda**
Dicho por el usuario: *no lleva tipo de interés, es una cuota lineal durante los 48 meses y
luego se devuelve el vehículo; cuota más su IVA porque es gasto deducible.*
- Cuota **idéntica** todos los periodos: ni cuadro francés ni intereses que separar. Al acabar
  se devuelve el bien, así que **no hay capital pendiente ni opción de compra**.
- **Al presupuesto va la BASE (sin IVA)** como GASTO, porque el IVA soportado se deduce y no es
  coste; la **salida de caja** es la cuota CON IVA. La pantalla enseña las dos y lo explica.
  Lo pendiente se llama **compromiso**, no deuda.
- `Renting.tipoIva` es un campo: se propone el marcado por defecto en Configuración y se puede
  poner a 0. Nunca se da por supuesto el 21 %.
- **Aviso de doble conteo**: si además se registran las facturas del renting en Compras
  («Renting de vehículos»), el gasto estaría dos veces. Se avisa al traerlo al presupuesto.
- Primera cuota **un periodo después** de `fechaInicio`, igual que en los préstamos.
- `avisosRenting` compara las cuotas facturadas que dice el banco con las que salen por fechas
  (con el contrato real: 10 frente a 8, porque el recibo se gira el día 1 y no el de la firma).
  Se avisa, **no se apaña por dentro**.

### Póliza de crédito (`dominio/poliza.ts`) — **sin cuotas**
Dicho por el usuario: *se renueva una vez al año, tiene un tipo de interés del capital dispuesto
y otro por el capital no dispuesto, con liquidación mensual de intereses.*
- Tres precios: interés del **dispuesto**, comisión de **disponibilidad** sobre lo NO dispuesto
  (se paga por tenerlo reservado) y comisión de **máximo excedido**, mucho más cara.
- **El disponible se calcula con el SALDO CONTABLE, no con el dispuesto**: es lo que hace el
  banco. Con la póliza real, 28.000 − 16.783,14 = 11.216,86 € (con el dispuesto saldría
  10.111,02, que no es lo que imprime la ficha). El lector comprueba ese cuadre y avisa si falla.
- `estimarLiquidacion` prorratea con **base 360 y saldo constante**: es una ESTIMACIÓN para
  presupuestar y se dice en pantalla. El banco liquida sobre el saldo medio diario.
  La comisión de excedido **no se prorratea**: es un % sobre el mayor exceso del periodo.
- Al presupuesto: intereses y comisiones como GASTO, mes a mes. Si `seRenueva` es falso, la
  devolución del dispuesto va en **línea aparte de FINANCIACION** en el mes del vencimiento.
- Sin fechas de liquidación, el calendario se cuenta desde la constitución (dato del contrato).

#### La póliza en cuenta corriente: lo dispuesto NO se teclea
Pedido por el usuario: *yo pongo el límite concedido y el saldo real consumido tiene que
recogerlo del saldo negativo de la cuenta bancaria.*
- `Poliza.origenDispuesto = 'CUENTA'` + `cuentaTesoreriaId`: `dispuestoDeCuenta` toma el **saldo
  negativo** de esa cuenta (en positivo, la póliza no está dispuesta) y `polizaConCuenta`
  recalcula la póliza en cada pintada. Así el dispuesto se actualiza **solo al importar el
  extracto**, sin mantener un número a mano. Si la cuenta no existe, se deja lo que hubiera:
  nunca se pone un 0 por no encontrarla.
- **Alarma al 75 %** (`umbralAviso`, editable por póliza): la barra de uso lleva la marca del
  umbral, y pasado de ahí el aviso salta en la ficha **y en el centro de alertas del Dashboard**.
- **Renovación**: lo que la decide no es la foto de hoy sino el **saldo medio del año**.
  `consumoMedio` lo calcula **ponderado por días** (un pico de un día no cuenta como dos meses al
  límite) y devuelve también el máximo. Si la media pasa del umbral, alerta **crítica**: una
  póliza que vive dispuesta el banco la lee como financiación estructural, no como tesorería.
- Las dos métricas van a `MetricasAlerta` (`polizasSobreUmbral`, `polizasMediaAlta`), que es lo
  que hace que el aviso llegue sin entrar en Deudas.

### Lectura de fichas del banco (`dominio/ficha-banco.ts`)
Las fichas de contrato de la banca digital son **rótulo → valor**, no tablas. `leerFicha` recorre
el documento con una **cola de rótulos pendientes** y sabe con dos formas distintas:
- La del **renting** pone una fila de rótulos y la siguiente con los valores, y **parte los
  rótulos largos** entre líneas («Importe de la cuota» + «periódica:»).
- La de la **póliza** pone rótulo y valor en la misma fila, alternando.
El corte: una fila que alterna rótulo/valor se basta a sí misma; en las demás, un trozo final sin
dos puntos es la continuación de un rótulo **si parece prosa** (varias palabras en minúscula) y
un valor **si parece un valor** (empieza por cifra, o es una palabra suelta tipo «MENSUAL»).
`pareceValor` es lo que distingue «Fecha impresión: 09/08/2026» de «Cargo por km adicional».
**El primer valor gana**: la página 2 de estas fichas trae rótulos mal partidos y no debe pisar
lo leído en la 1.

### `celdasDePdf` (lib/extracto.ts): leer el PDF por COLUMNAS
`lineasDePdf` junta toda la fila en una cadena y eso destruye las columnas: «Cuotas contratadas
48 · Cuotas facturadas 10» acababa como **«4810»**. `celdasDePdf` trocea cada fila por el **hueco
horizontal** entre fragmentos (> 2 puntos = columna nueva; ≤ 0,5 = pegado, como el «:» suelto de
un rótulo). `filasDePrestamo` usa esta versión para los PDF.
- **Efecto colateral que hubo que arreglar**: con las columnas separadas, la fila «Importe
  pendiente · Cuota a pagar · Fecha de vencimiento» de la ficha del préstamo empezó a colarse
  como cabecera de cuadro y el fichero dejó de aportar importe, fecha y entidad. `cabeceraTabla`
  exige ahora **al menos dos columnas de importe** además de la fecha de vencimiento.

### Que no se pueda registrar en el sitio equivocado
El usuario intentó dar de alta la póliza desde «+ Deuda» → tipo «Póliza de crédito», que es el
camino evidente y el que produce un cuadro de cuotas inexistente. Para que no vuelva a pasar:
- La cabecera de Deudas tiene **«+ Renting» y «+ Póliza»** junto a «+ Deuda».
- Los tipos `RENTING` y `POLIZA` siguen en la lista de `Deuda` (para no romper lo ya guardado)
  pero se llaman «(usa la sección de …)», y al elegirlos el modal **explica por qué no van ahí y
  ofrece un botón que lleva lo tecleado a la sección correcta**.
- La póliza se guarda con solo entidad + capital concedido; el límite actual se rellena solo.

## Cuánto se debe en total (`dominio/financiacion.ts`)
Pedido por el usuario: *la deuda total bancaria debería sumar los préstamos, las pólizas y los
renting, identificando cada total pero con un sumatorio de todo.*
- `resumenFinanciacion` da **un total por bloque y un total general**, y cada bloque **dice con
  qué está medido**, porque no miden lo mismo: préstamos por **capital vivo**, póliza por
  **dispuesto**, tarjeta por **saldo pendiente de liquidar**, renting por **cuotas pendientes sin
  IVA**. Sumarlos sin decirlo sería engañoso.
- La póliza en cuenta corriente se **resuelve contra su cuenta** dentro del resumen: guardada con
  `dispuesto: 0`, sin resolverla el bloque sumaba cero y el total salía corto.
- El **renting se suma pero va marcado `esCompromiso`**: se paga todos los meses, pero
  contablemente es un arrendamiento operativo, no deuda del balance. La pantalla lo explica.
- `deudaTotal` del Dashboard sale ya de aquí. En Deudas **se quitaron las cuatro tarjetas
  antiguas** (Deuda total / Financiera / Comercial / Fiscal): dos cifras distintas de «deuda
  total» en la misma pantalla es justo lo que confundía.

### `Deuda.cuadroFijo`: calendarios que no salen de una fórmula
`cuadroDeuda(d)` usa el cuadro leído de un documento **por encima** de `generarCuadro`. Es lo que
permite registrar un aplazamiento tal y como viene. Lo usan la pantalla de Deudas, el presupuesto
(`cuotasDeudaPorMes`) y el resumen, así que un plazo irregular se respeta en todas partes.

## Aplazamiento de Hacienda / Seguridad Social (`dominio/aplazamiento-aeat.ts`)
El mismo botón «Subir fichero del banco» reconoce el **acuerdo de concesión** y lo manda aquí.
- Un aplazamiento **no es un préstamo**: la AEAT publica los vencimientos plazo a plazo, con su
  principal y sus intereses, y no tienen por qué ser iguales. Se guardan en `cuadroFijo`, **tal
  cual**, sin recalcular nada.
- Fila de plazo = **una fecha y al menos un importe**; con tres, el mayor es el total, el menor
  los intereses y el otro el principal.
- Se leen expediente, NIF, tipo de demora e importe aplazado, y se **comprueba el cuadre**: la
  suma de los plazos tiene que dar la deuda más sus intereses. Si no, se avisa de que puede faltar
  algún plazo por leer; no se corrige por nuestra cuenta.
- `esAplazamiento` pide **dos señales** para no tragarse cualquier escrito de Hacienda, y
  distingue AEAT de la Tesorería General de la Seguridad Social.
- **PENDIENTE de validar con un PDF real del usuario**: la disposición del test es la habitual
  del acuerdo de concesión, pero no está tomada de un documento suyo. Cuando lo mande, convertirlo
  en regresión como se hizo con las facturas.

## Tarjetas de crédito (`dominio/tarjeta-credito.ts`)
Dicho por el usuario: *es deuda financiera a corto plazo.* Sección propia en Deudas.
- Límite, saldo pendiente, **modalidad** y día del cargo. La modalidad es lo que decide si la
  tarjeta cuesta dinero: **FIN_DE_MES** no devenga intereses; **APLAZADO** sí, y suele ser la
  financiación más cara de la empresa, así que se dice el coste anual y se sugiere compararlo con
  la póliza.
- Misma alarma de consumo que la póliza (umbral editable, 75 % por defecto, con su marca en la
  barra) y aviso propio si se pasa del límite.
- **Enlazable con las tarjetas de `Configuracion.tarjetas`**: entonces la app suma las compras
  pagadas con ella ese mes y avisa si no cuadra con el saldo. **No lo cambia sola**: el saldo
  bueno es el del extracto, no lo que haya metido en Compras.

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

## Estado (565 tests en verde, desplegado)
Fases 0–12 + auditoría de seguridad + multi-empresa + accionariado + lectura de extractos +
inversiones + naturaleza del gasto / conceptos del banco / deuda al presupuesto + lectura de
facturas en PDF + centros de coste + tarjetas + archivo de documentos.

Configuración · Ventas · Compras (lectura de factura en PDF, resumen mensual, archivo de
documentos, carpeta para la gestoría) · Caja/arqueos · Bancos (N43/Excel/CSV/PDF, conciliación,
cargos y abonos por concepto) · Stock · Importación (Excel/CSV, 4 pasos) · Deudas/Deudores ·
Inversiones · Presupuesto+Cash flow (con deuda y banco) · Previsión de tesorería · Dashboard ·
Informes (IVA/303/347, balance, P&G, PDF ejecutivo) · Copias de seguridad · Grupo de empresas y
accionariado · **Conectores** (Fase 11).

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
  → Restaurar. «Borrar datos del sitio» los pierde. **Los PDF archivados NO van en ese JSON**:
  se llevan con el ZIP mensual de Compras (y por tanto el archivo es por dispositivo).

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
- **`servidor/agregar.mjs`** (puro, probado desde `src/dominio/square-agregacion.test.ts`):
  agrupa los pedidos de Square en ventas diarias por tienda. **Escrito pero AÚN NO ENCHUFADO**:
  el servidor solo expone hoy `payouts` (liquidaciones), no ventas. Es el cimiento para cuando
  se decida ir por el conector en vez de por CSV.
  · La fecha es la del **cierre** del pedido, no la de creación (un ticket cobrado pasada la
    medianoche es del día siguiente), con desfase horario configurable para que cuadre con los
    informes de Square.
  · `EXTERNAL` y `THIRD_PARTY_CARD` → TARJETA: es el datáfono ajeno a Square, lo que en los
    informes sale como «Otros / origen del pago desconocido».
  · Los importes se suman en **céntimos** y se pasan a euros una sola vez.

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
- **Cómo verificar en navegador** (recetas que ya han funcionado): `npm run build` + `npm run
  preview -- --port 41xx`, y un script suelto con `playwright-core`
  (`executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`). Para sembrar datos,
  escribir directamente en IndexedDB (`keyval-store`): ojo, en un navegador limpio la clave
  `finanzas:datos:<id>` **aún no existe** —el store solo la escribe al primer cambio— así que hay
  que partir de `{}`; el store completa el resto con `datosIniciales()`. Borrar el script después.
- **Nunca `pkill -f "<algo>"` si `<algo>` aparece en la propia línea de comando** (p. ej.
  `pkill -f "vite preview"` o `pkill -f "port 4197"`): el shell se mata a sí mismo (exit 144) y
  deja a medias lo que viniera detrás. Mejor levantar la previsualización en otro puerto.

## Decisiones abiertas (esperan respuesta del usuario, NO decidir por él)
- **Tributos y Seguridad Social como FINANCIACIÓN, no como gasto** en el presupuesto (pagar el
  303 salda IVA ya recaudado). Se le planteó; si prefiere verlos como gasto, es un cambio de
  `efectoPresupuesto` en `defaults.ts`.
- **Seguridad Social: caso aparte desde que existen las Nóminas.** Las nóminas se registran como
  GASTO y la SS como FINANCIACIÓN, así que la cuota patronal —que es coste real— no aparece en el
  presupuesto. Recomendado pasarla a GASTO (642); **pendiente de su decisión**. Lo mismo, en
  menor medida, con el IRPF del modelo 111, que va dentro de «Tributos: trimestre».
- **Las entradas se presupuestan en negativo** en las líneas que restan (inversión y
  financiación). Alternativa si no le convence: vista de cash flow con entradas y salidas en
  columnas separadas.
- **Los PDF no van en el backup JSON.** Alternativas ofrecidas: incluirlos aunque pese mucho, o
  sincronizar con un servidor propio. Sin respuesta.
- **La cuota de deuda entra completa (principal + intereses)** en la línea de financiación. Se
  ofreció separar los intereses como gasto.
- **App de vóley**: se tocó `src/engine/groups.ts` sin que lo pidiera, para corregir un fallo de
  sorteo que violaba el keep-apart en el 2,4 % de los casos y ponía el CI en rojo de forma
  intermitente. Está desplegado y **sigue sin decir si lo deja o lo revierte**.

## Ampliable / pendiente
- Roles por tienda y auditoría inmutable → requieren backend.
- Facturación electrónica verificable (estructura preparada, sin certificar en v1).
- Más adaptadores de conector en el servidor (banco PSD2, Stripe, Shopify…).
- Siembra de mejores terceros, drag-and-drop, sincronización PostgreSQL.
- **Más formatos de factura**: cada PDF real que falle debe convertirse en un test como
  `factura-real.test.ts`. Nunca ajustar el lector «a ojo» sin el fichero delante.
- El archivo de documentos es **por dispositivo**: si sube facturas desde el ordenador no las
  verá en el iPhone. Pendiente decidir si se sincroniza o basta con el ZIP mensual.
