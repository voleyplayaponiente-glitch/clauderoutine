# CLAUDE.md — Gestión Deportiva y Financiera del CVPPB

Memoria del proyecto para Claude Code. Léelo al empezar cualquier sesión que toque `club/`.

## ESTADO: FASE 0 ENTREGADA, ESPERANDO VALIDACIÓN. NO HAY CÓDIGO TODAVÍA.

El usuario se despidió con **«guarda en memoria y cuando lo vea te indico»** (14/08/2026).
Está pendiente de leer el plan. **No empieces a construir hasta que él lo diga.**

## Qué es
Sistema integral de gestión deportiva y financiera para el **Club Vóley Playa Poniente
Benidorm (CVPPB)**: competición federada + escuelas de verano. Sustituye los Excel actuales
(control de caja, informe bancario, presupuesto, listado maestro de jugadores) sin perder
histórico. Interfaz en español (España), `DD/MM/AAAA`, `1.234,56 €`.

- **Encargo original:** `/root/.claude/uploads/.../PROMPT_Claude_Code_Gestion_Deportiva_CVPP.md`
  (el usuario lo subió; si no está, pídeselo — es la fuente de las reglas de negocio).
- **Plan de la Fase 0:** `PLAN_APP_CLUB.md` en la raíz del repo.
- **Versión web del plan:** https://claude.ai/code/artifact/f7255952-fc06-4757-a448-159c89870d13
  (para actualizarla hay que republicar pasando esa URL como `url`).
- **Rama de desarrollo:** `claude/voley-playa-club-management-gczqmk`
- **Convive con** la app de vóley (raíz) y la de finanzas (`finanzas/`). **No se tocan.**

## Volumen real del club
20 equipos · 114 jugadores de competición (cadete/infantil/alevín, masc. y fem.) + 7 de
escuelas ≈ 121 participantes · ~11 personas de cuerpo técnico · cuenta en CaixaBank + caja
física · ~61.200 € de financiación (59 % instituciones, 41 % patrocinio).

## Decisiones cerradas con el usuario (no reabrir sin motivo)
- **D1 · Usuarios:** solo él (tesorería/dirección). Los demás reciben PDF.
- **D2 · Arquitectura:** **PWA client-first**, como `finanzas/`. **NO** Next.js + PostgreSQL +
  Prisma + NextAuth, aunque el encargo lo pidiera. Vite + React 19 + TS + Tailwind v4 +
  Zustand + IndexedDB. Motor puro en TS sin React, testeable aislado.
- **D3 · Ubicación:** carpeta `club/` en este repo.
- **D4 · Competición:** se escribe de cero. El gestor de torneos de la raíz no se toca.

Consecuencia de D2 que hay que recordar: **roles y NextAuth se descartan** (código muerto con
un solo usuario), y **el registro de accesos a datos de menores no se puede garantizar en el
navegador — no fingir que sí**. A cambio, datos de salud en clave aparte cifrada con WebCrypto.
**Si algún día entran los entrenadores a meter convocatorias, D2 se cae y hay que revisarla.**

## Propuesta de simplificación — PENDIENTE DE VALIDAR
Las 11 fases del encargo son para un equipo con backend. Propuesto al usuario: **3 entregas**,
cada una una app usable, y el modelo baja de ~30 entidades a **12**.

| Entrega | Sustituye | Contiene |
|---|---|---|
| **1 · Dinero** | Control de caja + informe bancario | Caja y banco, movimientos con entrada rápida, categorías, terceros, traspasos espejo, arqueo, importar su Excel, exportar |
| **2 · Gente y cobros** | Listado maestro + pagos a técnicos | Personas, fichas de jugador, cuotas e impagos, partidas técnicas, liquidación de monitores con anticipos, hoja de pago con firma |
| **3 · Escuelas y control** | Cuadrantes de verano + presupuesto | Escuelas completo, presupuesto, panel de control |

**Fuera de la v1 hasta que lo pida:** competición federada con estadísticas, viajes,
patrocinadores y subvenciones con calendario, facturas de proveedor, conciliación automática,
consentimientos RGPD y datos de salud.
**Salvedad ya advertida al usuario:** si hay una subvención con fecha límite de justificación
este curso, su calendario sube a la Entrega 1.

**La Entrega 1 NO depende de ninguna duda bloqueante** — se puede arrancar en cuanto valide.

## Las 3 dudas BLOQUEANTES (sin esto no se hacen las Entregas 2 y 3)
1. **Importes reales.** No hay una sola cifra en el encargo: tarifa mensual de entrenador
   principal y ayudante, tarifa/día de monitor por tramo, partida de coordinación, y qué
   excepciones individuales existen. Van a Configuración con vigencia, **nunca al código**.
2. **Cuotas de jugador.** ¿Por categoría o única? ¿Temporada, mensual o fraccionada?
   ¿Bonificación de hermanos? ¿Qué se hace con un impago a final de temporada?
3. **Régimen de cobro de los técnicos.** No está en el encargo. ¿Nómina con IRPF y SS,
   autónomos con factura, o compensación de gastos? **Si hay retención hacen falta el 111 y
   el 190**, y eso es un módulo entero no planificado. Es la que más preocupa.

## Otras dudas abiertas
- **IVA:** ¿factura con IVA por patrocinio, o exención art. 20 LIVA? Decide si hace falta 303.
- **Ficheros reales** de los 4 Excel, para escribir los lectores contra ellos y convertirlos en
  test de regresión. **Con ficheros inventados el importador funcionará con ficheros inventados.**
- **§5.1.3:** los 8.550 € de cajero vs. 4.500 € en caja, ¿caso real o ejemplo?
- **Quincenas:** fechas y **cómo se cuentan los días lectivos** (¿L-V? ¿festivos? ¿día de lluvia?).
  La nómina de monitores cuelga entera de esto.
- Alcance histórico · organizador y puntuación de la liga · subvenciones vivas y sus fechas
  límite · ¿puede descargar N43 de CaixaBank? · ¿guardamos datos de salud?

## Decisiones de proyecto pendientes
- **D5 · ¿carpeta `compartido/` en la raíz**, o `club/` lleva su copia de los módulos?
- **D6 · Rama que publica:** `deploy.yml` se dispara en `main` y en
  `claude/tournament-bracket-manager-gvrcdt`, **no en la rama de club**. ¿Se añade o se fusiona?
- **D7 · Copias desde el día uno:** el 11/08 se perdieron los datos de tres sociedades en
  finanzas. Propuesto meter backup + copia al Umbrel en lo primero que se construya, antes de
  que haya un solo dato dentro. **Es la lección más cara del repo.**

## Reutilización desde `finanzas/` (comprobado fichero a fichero)
Sin ninguna dependencia, se comparten tal cual:
`dinero.ts` · `parseo-es.ts` · `texto.ts` · `id.ts` · `csv.ts` · `zip.ts` · `n43.ts`
Con dependencia trivial entre ellos: `extracto.ts` + `importacion.ts` + `conciliacion.ts`.
→ La conciliación bancaria y buena parte del importador **llegan ya escritos y probados contra
ficheros reales del banco**, con sus lecciones dentro (la convención numérica se deduce del
fichero: CaixaBank exporta `3,000.00` en Excel y `3.000,00` en PDF para el MISMO movimiento;
extractos en Windows-1252; posiciones del registro 22 de la Norma 43).

## Reglas del modelo de datos que NO se negocian
Están razonadas en `PLAN_APP_CLUB.md`; se resumen aquí porque son las que se pierden al resumir.

- **Dinero en enteros de céntimos.** Nunca `float`. Euros solo en la frontera de E/S. Los
  repartos que no dividen exacto dan el sobrante al primero y **la suma de las partes es
  siempre igual al total**, con test que lo fija.
- **Personas por composición, no herencia.** Una misma persona es técnico y jugador a la vez;
  duplicarla rompe el «cuánto debemos a cada técnico» y el conteo de participantes.
  `FichaJugador` = persona × temporada.
- **`PartidaTecnica`, no `Tecnico`.** Lo que se retribuye es el contrato, y una persona puede
  tener varios simultáneos (entrenador + ayudante + coordinador + monitor).
- **`SIN_COSTE` es un tipo de tarifa, no `importeTarifa: 0`.** Quien tiene sueldo fijo se
  imputa a cero **por un motivo**; con un 0 no se distingue de «tarifa sin rellenar», que es un
  error a corregir.
- **La tarifa de escuelas se guarda CONGELADA** en `InscripcionEscuela.importeAplicado` y en
  `AsistenciaMonitor.importeUnitarioAplicado`. **Números guardados, no derivados de la tarifa
  vigente.** Subir el precio en agosto no puede reescribir lo que se cobró en julio. Se guarda
  además `origenTarifa` para trazar de dónde salió, pero el cálculo usa el número congelado.
  Precedencia de tarifa de monitor: **excepción individual → grupo → tramo**, devolviendo
  importe **y motivo**.
- **`Traspaso` posee sus dos movimientos espejo.** No se vigila que no falte uno: se hace
  imposible. El store no acepta un movimiento con `traspasoId` suelto ni borrar uno de los dos.
  `verificarEspejos()` existe, pero **para auditar los datos importados del Excel viejo**.
- **Movimientos con importe con signo, NO partida doble.** Un club no deposita cuentas; montar
  plan contable aquí complicaría la entrada de datos (prioridad 3 del encargo: rapidez) sin que
  nadie lo use. En `finanzas/` sí hay libro diario porque allí sí hace falta.
- **La clasificación se calcula, no se almacena.** Guardarla es garantizarse que algún día no
  coincida con los partidos que la producen.
- **El adjunto guarda solo metadatos; el binario va en `club:adjunto:<id>`.** Si el PDF vive
  dentro del objeto de datos, cada guardado reescribe megas y la app se arrastra (lección de
  finanzas).
- **Nada se borra:** borrado lógico (`anuladoEn`) y `anular()` crea un contramovimiento
  enlazado al original. Todo a `RegistroAuditoria`.
- **`Duda` es entidad de primera clase**, no un campo de notas: sustituye al «resaltado en
  amarillo» del Excel, con responsable, fecha y resolución.
- **`Tercero.alias[]`** mapea nombre fiscal ↔ comercial y alimenta el casado de la
  conciliación: el banco escribe «AYTO BENIDORM» y el contrato «Excmo. Ayuntamiento de Benidorm».
- **El principio rector (§5.5.1) es una función, no un informe:** `resultadoCompeticion()`
  devuelve cuotas, coste, resultado y patrocinio consumido, y va en la cabecera, siempre visible.

## Cómo se demuestra el criterio de aceptación 1
«Reproduce **exactamente** el saldo, movimiento a movimiento». El Excel de caja trae columna de
saldo acumulado: el importador recalcula con `serieSaldos` y lo **compara línea a línea con esa
columna**, señalando la primera divergencia con su nº de fila. Si el fichero no cuadra consigo
mismo —lo probable, y justo lo que hay que descubrir— la app dice **dónde** se rompe en vez de
tragárselo.

Patrón de importación (probado en finanzas): previsualización **siempre** antes de tocar nada,
columnas **por cabecera y no por posición**, lo ilegible se descarta **con su motivo** (nunca se
inventa una fecha), y cada tanda registra un lote con los ids creados para **deshacerla entera**.
Los ~600 movimientos sin clasificar van a bandeja de pendientes, **no a la basura**.

## POR DÓNDE SEGUIR
1. El usuario lee `PLAN_APP_CLUB.md` (o el enlace web) y responde.
2. Si valida las 3 entregas → actualizar `PLAN_APP_CLUB.md` con ese plan, **republicar el
   artifact pasando su URL como `url`** (si no, se crea uno nuevo y el enlace que él tiene
   se queda viejo), y arrancar la **Entrega 1**, que no depende de las dudas bloqueantes.
3. Al montar `club/`: añadir el tercer bloque a `.github/workflows/deploy.yml` calcado del de
   finanzas (`npm ci` + `npm test` + build con `GITHUB_PAGES=true` + copia a `dist/club/`),
   **sin tocar** los dos bloques existentes. Ver D6 sobre la rama que dispara el workflow.
