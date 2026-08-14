# FASE 0 — Sistema Integral de Gestión Deportiva y Financiera (CVPPB)

Respuesta al §11 del `PROMPT_Claude_Code_Gestion_Deportiva_CVPP.md`: arquitectura,
modelo de datos completo, reglas de negocio como funciones puras, plan de fases y
**las dudas que necesito que me resuelvas**. Sin código de aplicación todavía.

---

## 0. Situación de partida y decisiones ya cerradas

Este repositorio no está vacío. Hoy contiene **dos aplicaciones en producción**:

| Carpeta | Qué es | Publicada en |
|---|---|---|
| raíz | Gestor de Torneos de Vóley Playa (cuadros de torneo) | `…/clauderoutine/` |
| `finanzas/` | Gestión Financiera de la S.L. de retail (~586 tests) | `…/clauderoutine/finanzas/` + Umbrel `:3011` |

Esta sería la **tercera**. Decisiones que me has confirmado antes de escribir nada:

- **D1 · Usuarios:** solo tú (tesorería/dirección). Los demás, como mucho, reciben PDF.
- **D2 · Arquitectura:** PWA client-first, como `finanzas/`. **No** Next.js + Postgres.
- **D3 · Ubicación:** carpeta `club/` en este repo. No se toca ni el vóley ni finanzas.
- **D4 · Competición:** se escribe de cero; el gestor de torneos se queda como está.

### Qué implica D2, dicho claramente

El prompt pide Next.js + PostgreSQL + Prisma + NextAuth, y pide (§8) roles reales,
registro de accesos a datos de menores y copia cifrada. **Con un solo usuario, la mitad
de eso deja de tener sentido y la otra mitad cambia de forma:**

- **Roles y NextAuth: se descartan.** Un sistema de roles con un único usuario es
  código muerto que hay que mantener. El modelo de datos deja el hueco (`creadoPor`
  en todo) para añadirlos si algún día entran los entrenadores.
- **El "registro de accesos" a datos de menores no lo puedo garantizar en el
  navegador** y no voy a fingir que sí. Lo que sí se puede, y se hará: los datos de
  salud viven en una clave aparte de IndexedDB, **cifrada con WebCrypto tras una
  contraseña** que no se guarda; sin ella la app funciona entera menos esa ficha.
  Es protección real (si te roban el portátil), no teatro.
- **La copia de seguridad cifrada sí se cumple**, reutilizando el mecanismo de
  `finanzas/` (backup JSON con checksum + copia al Umbrel).
- **Contrapartida a favor:** funciona a pie de pista sin cobertura, se instala en el
  iPhone, se publica en Pages y se instala en el Umbrel igual que finanzas. Y el
  requisito §9 de introducir asistencia y resultados desde el móvil sin red deja de
  ser "una cola de sincronización" para ser, sencillamente, cómo funciona la app.

**Si algún día entran los entrenadores a meter sus propias convocatorias, esta
decisión hay que revisarla**, porque entonces sí hacen falta roles y control de
accesos de verdad. El motor va aislado en TS puro precisamente para eso.

### Reutilización desde `finanzas/`

Comprobado fichero a fichero: estos módulos **no tienen ninguna dependencia** (ni de
React, ni de Prisma, ni de los tipos de finanzas), así que se pueden compartir tal cual:

`dinero.ts` · `parseo-es.ts` · `texto.ts` · `id.ts` · `csv.ts` · `zip.ts` · `n43.ts`

Y con una dependencia trivial entre ellos: `extracto.ts` + `importacion.ts` (lectura de
extractos en Excel/CSV/PDF) y `conciliacion.ts`.

Eso significa que **el §5.1.3 (conciliación bancaria con extracto de CaixaBank) y buena
parte del §7 (importador) llegan ya escritos y probados con ficheros reales del banco**,
incluidas las lecciones caras: la convención numérica se deduce del fichero (CaixaBank
exporta el mismo movimiento como `3,000.00` en Excel y `3.000,00` en PDF), los extractos
españoles vienen en Windows-1252, y las posiciones del registro 22 de la Norma 43.

**Propuesta (D5, a confirmar):** carpeta `compartido/` en la raíz con esos módulos y sus
tests, consumida por `club/`. `finanzas/` se queda **como está** en esta fase: es una app
en producción y no la voy a desestabilizar para ahorrar una duplicación. Se migraría más
adelante, cuando `club/` haya demostrado que la interfaz compartida aguanta.

---

## 1. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | React 19 + TypeScript estricto + Vite | Igual que las otras dos apps del repo. |
| Estilos | Tailwind v4 + tokens propios | Modo claro/oscuro, densidad tipo hoja de cálculo. |
| Estado | Zustand + IndexedDB (`idb-keyval`) con debounce | Patrón ya validado en finanzas. |
| Gráficos | Recharts (carga diferida) | |
| Excel | SheetJS (`xlsx`), carga diferida | Importación del histórico y exportación de 3 hojas. |
| PDF | jsPDF + autotable (salida), pdf.js (lectura) | Hojas de pago, recibos, memoria económica. |
| Tests | Vitest | Obligatorio en todo el motor. |
| Dinero | **enteros en céntimos**, nunca `float` | Ver abajo. |

**Decimales.** El prompt admite `Decimal` de Prisma o enteros en céntimos; sin Prisma,
**enteros en céntimos** es la única opción honesta en JavaScript. Todos los importes se
almacenan y se calculan en céntimos (`number` entero); euros solo en la frontera de
entrada/salida. Se reutilizan `aCentimos` / `aEuros` / `formatearEuro` de finanzas.
Convención: los repartos que no dividen exacto (coste de un viaje entre 3 equipos)
reparten el céntimo sobrante al primer equipo y **la suma de las partes es siempre
igual al total**, con test que lo fija.

---

## 2. Modelo de datos

Notación TypeScript abreviada. Todo importe en **céntimos enteros**. Todas las entidades
llevan `id`, `creadoEn`, `creadoPor` y borrado **lógico** (`anuladoEn`); nada se borra.

### 2.1 Núcleo

```
Temporada        id, nombre "2025-26", inicio, fin, estado(ABIERTA|CERRADA), esActual
Club             id, nombre, cif, direccion, logo, umbralCaja, iban
Adjunto          id, nombre, tipo, tamano, clave        ← el binario vive en SU PROPIA clave
RegistroAuditoria id, fecha, accion, entidad, entidadId, antes(JSON), despues(JSON), motivo
Duda             id, ambito, entidad?, entidadId?, texto, responsable, abiertaEl,
                 resueltaEl?, resolucion
```

- **`Adjunto` guarda solo metadatos; el PDF va en `club:adjunto:<id>`.** Lección directa
  de finanzas: si el binario vive dentro del objeto de datos, cada guardado reescribe
  megas de PDF y la app se arrastra.
- **`Duda` sustituye al "resaltado en amarillo" del Excel** (§4.5). Es una entidad de
  primera clase, no un campo `notas`: tiene responsable, fecha y resolución, se puede
  colgar de cualquier registro y sale en su propia hoja al exportar.

### 2.2 Personas

El prompt dice "`Jugador` hereda `Persona`". **Propongo composición, no herencia**, por
dos motivos que se dan de hecho en el club:

1. Una misma persona es **técnico y jugador** a la vez, o monitor de escuelas y ayudante
   de un equipo. Con herencia habría que duplicarla, y duplicar personas rompe el
   "cuánto debemos a cada técnico" y el conteo de participantes.
2. Una persona **atraviesa temporadas**; su equipo, su dorsal y su cuota no.

```
Persona          id, nombre, apellidos, nifNie?, fechaNacimiento, telefono, email,
                 direccion, fotoAdjuntoId?, bajaEl?
DatosSalud       personaId, alergias, observaciones, contactoUrgencia   ← CLAVE CIFRADA APARTE
Tutor            id, personaId(el tutor), menorPersonaId, parentesco, telefono, email
Consentimiento   id, personaId, tipo(IMAGEN|DATOS|COMUNICACIONES|SALUD), otorgado,
                 fecha, otorgadoPorTutorId?, adjuntoId?

FichaJugador     id, personaId, temporadaId, equipoId, dorsal?, nLicencia?,
                 tallaEquipacion, estado(PREINSCRITO|INSCRITO|BAJA), cuotaId, notas
```

**`FichaJugador` es la inscripción de una persona en una temporada.** Cambiar de equipo
o de categoría el año que viene crea una ficha nueva; la del año pasado queda intacta,
con su dorsal, su licencia y su cuota. El histórico deportivo se consulta por `personaId`.

### 2.3 Cuerpo técnico — `PartidaTecnica`, no `Tecnico`

El §5.3 dice que *una misma persona puede tener varias partidas simultáneas* (entrenador
de un equipo + ayudante en otro + coordinador + monitor) y que *coordinación va en
partida propia aunque sea la misma persona*. Eso no es una persona con un rol: **es una
persona con N contratos**. Así que la entidad retribuida es la partida, no el técnico.

```
PartidaTecnica   id, personaId, temporadaId,
                 rol(ENTRENADOR|SEGUNDO|AYUDANTE|MONITOR|COORDINADOR|
                     DIRECCION_TECNICA|INSTALACIONES),
                 programa(COMPETICION|ESCUELAS|ESTRUCTURA), equipoId?, grupoEscuelaId?,
                 tipoTarifa(MENSUAL|POR_DIA|POR_QUINCENA|FIJA|SIN_COSTE), importeTarifa,
                 altaEl, bajaEl?, estado(ABIERTA|CERRADA), totalAlCerrar?, titulacion?
```

- **`SIN_COSTE` no es una tarifa de 0 €, y la distinción importa.** El §5.3 pide que
  quien tiene sueldo fijo y además hace de monitor se impute a **0 € en escuelas**. Con
  `importeTarifa: 0` no se podría distinguir de "tarifa pendiente de fijar", que es un
  error a corregir. Con `SIN_COSTE` la app dice *por qué* vale cero, aparece igual en el
  cuadrante de monitores y no salta ninguna alerta.
- Cerrar una partida (§5.3, "abierta / cerrada") **congela `totalAlCerrar`**.

### 2.4 Deportivo y competición

```
Equipo           id, temporadaId, nombre, categoria, genero, division, competicionId?,
                 patrocinadorId?, color
Instalacion      id, nombre, direccion
Pista            id, instalacionId, nombre
HorarioEntreno   id, equipoId, pistaId, diaSemana, horaInicio, horaFin,
                 vigenteDesde, vigenteHasta?

Competicion      id, temporadaId, nombre, organizador, formato
Jornada          id, competicionId, numero, fecha, sede
Partido          id, jornadaId, equipoLocalId, equipoVisitanteId, sede, hora,
                 arbitro?, estado(PROGRAMADO|JUGADO|APLAZADO|SUSPENDIDO)
SetPartido       partidoId, numero, puntosLocal, puntosVisitante
Convocatoria     partidoId, fichaJugadorId, titular, motivoAusencia?
EstadisticaJugador partidoId, fichaJugadorId, setsJugados, puntos,
                 ataques{intentos,aciertos,errores}, saques{aces,errores},
                 recepcion{positiva,error}, bloqueos, defensas, faltas, valoracion
```

**`ClasificacionCalculada` no se almacena: se calcula.** El prompt la admite como vista.
Guardar una clasificación es garantizarse que algún día no coincida con los partidos que
la producen. Es una función pura sobre los sets, con memorización en la UI si hace falta.

### 2.5 Escuelas de verano — la tarifa se congela

```
EdicionEscuela   id, anio, inicio, fin, instalacionId
Quincena         id, edicionId, nombre "1ª de julio", inicio, fin, diasLectivos
GrupoEscuela     id, edicionId, nombre, tramoEdad, aforo,
                 tarifaParticipanteQuincena, tarifaMonitorDia

InscripcionEscuela id, personaId, grupoId, quincenaId,
                 importeAplicado,                       ← CONGELADO
                 origenTarifa{tipo:GRUPO|EXCEPCION|MANUAL, referencia, motivo},
                 bonificaciones[{tipo:HERMANOS|BECA|OTRA, importe, motivo}],
                 estadoPago(PENDIENTE|PARCIAL|PAGADO), movimientoIds[]

AsistenciaMonitor id, partidaTecnicaId, quincenaId, grupoEscuelaId?,
                 diasPrevistos, diasTrabajados,
                 importeUnitarioAplicado, tipoAplicado, origenTarifa,  ← CONGELADOS
                 importeCalculado
```

**Esta es la regla que más me importa del documento entero** (§4.4: *el sistema debe
guardar la tarifa histórica aplicada, no recalcularla con la tarifa actual*):

`importeAplicado` e `importeUnitarioAplicado` son **números guardados, no derivados de
una FK a la tarifa vigente**. Si en agosto subes la tarifa del grupo de benjamines, la
1ª quincena de julio sigue valiendo lo que valió. Se guarda **además** `origenTarifa`
para poder responder "¿de dónde salió este importe?" — pero el cálculo usa el número
congelado, nunca el origen.

**Precedencia de tarifa de monitor** (§5.3), como función pura que devuelve importe *y*
motivo: `excepción individual del monitor` → `tarifa del grupo` → `tarifa del tramo`.
La excepción individual **prevalece** y la app dice cuál se aplicó y por qué.

### 2.6 Financiero — el corazón

**Decisión: movimientos con importe con signo, no partida doble.** En `finanzas/` sí hay
libro diario, porque aquella S.L. deposita cuentas. Un club que lleva caja, banco y
justifica subvención **no necesita un plan contable**, y montarlo aquí sería complicar la
entrada de datos (§ prioridad 3 del prompt: rapidez) para un beneficio que nadie va a
usar. El criterio de aceptación 1 —reproducir el saldo movimiento a movimiento— se cumple
igual. El prompt lo modela así en §4.5 y estoy de acuerdo.

```
Cuenta           id, nombre, tipo(BANCO|CAJA), iban?, saldoInicial, fechaSaldoInicial, activa
Categoria        id, nombre, tipo(INGRESO|GASTO), padreId?, orden
Tercero          id, tipos[](PATROCINADOR|INSTITUCION|PROVEEDOR|FAMILIA|TECNICO|OTRO),
                 nombreFiscal, nombreComercial?, nif?, iban?, contacto, alias[]

Movimiento       id, fecha, fechaValor?, cuentaId, importe(con signo), concepto,
                 categoriaId, terceroId?, equipoId?, programa, temporadaId,
                 estado(PREVISTO|REALIZADO|CONCILIADO), referenciaBancaria?, adjuntoId?,
                 traspasoId?, anulaAMovimientoId?, anuladoPorMovimientoId?,
                 loteImportacionId?, creadoPor, creadoEn

Traspaso         id, fecha, cuentaOrigenId, cuentaDestinoId, importe,
                 movimientoSalidaId, movimientoEntradaId
Arqueo           id, cuentaId, fecha, saldoTeorico, recuentoFisico,
                 denominaciones[{valor, cantidad}], diferencia, explicacion
LineaExtracto    id, importacionId, fecha, concepto, importe, referencia, casadaConId?
LoteImportacion  id, fecha, origen, fichero, destino, idsCreados[], resumen
```

**El traspaso espejo (§5.1.1) se hace imposible de romper, no se vigila.** El prompt pide
que el sistema "marque como incidencia" el espejo que falte. Prefiero que no pueda faltar:
`Traspaso` es el agregado que **posee** los dos movimientos; el store no acepta crear un
movimiento con `traspasoId` suelto ni borrar uno de los dos. La función
`verificarEspejos()` se queda igualmente, pero como auditoría de datos **importados del
Excel viejo**, que es donde de verdad pueden venir descuadrados.

```
Cuota            id, fichaJugadorId, temporadaId, importeTotal,
                 plazos[{numero, vencimiento, importe, estado, movimientoId?}],
                 compensaciones[{motivo, importe, movimientoId?}]
Anticipo         id, personaId, importe, fecha, estado(VIVO|REGULARIZADO),
                 movimientoOrigenId, movimientoRegularizacionId?
Presupuesto      id, temporadaId, lineas[{categoriaId, programa?, equipoId?, previsto}]
ContratoPatrocinio id, terceroId, temporadaId,
                 tipo(INSTITUCIONAL|PRINCIPAL|SECCION|COMERCIAL|ESPECIE),
                 importe, vencimientos[{fecha, importe, estado, movimientoId?}],
                 contraprestaciones, equipoId?, estado
Subvencion       id, terceroId, convocatoria, temporadaId, concedido, cobrado,
                 fechaLimiteJustificacion, gastosAfectos: movimientoId[], estado
FacturaRecibida  id, terceroId, numero, fecha, base, iva, total, estadoPago,
                 movimientoId?, adjuntoId?
Viaje            id, competicionId?, fecha, destino, equipoIds[], medioTransporte,
                 proveedorId?, participantes[{personaId, tipo}],
                 conceptos[{tipo:BUS|ALOJAMIENTO|DIETAS|INSCRIPCION|EXTRA, importe,
                            movimientoId?}],
                 reparto[{equipoId, importe}], anticipos[], liquidadoEl?
```

- **`Tercero.alias[]` resuelve el mapeo nombre fiscal ↔ comercial** (§4.5) y de paso
  alimenta el casado automático de la conciliación: el banco escribe "AYTO BENIDORM" y
  el contrato dice "Excmo. Ayuntamiento de Benidorm".
- **`Cuota.compensaciones`** cubre el caso del §6.4 (deuda compensada con clases): queda
  como línea trazada con su motivo, no como un descuento silencioso del importe.
- **Anular nunca borra** (§5.1.4): `anular(movimiento, motivo)` crea un contramovimiento
  que apunta al original por `anulaAMovimientoId` y ambos quedan enlazados.

---

## 3. Reglas de negocio como funciones puras (`club/src/dominio/`)

Todo lo del §5 del prompt, en TS puro sin React, testeado en aislamiento:

| Módulo | Qué resuelve | §  |
|---|---|---|
| `saldos.ts` | `saldoCuenta`, `saldoAFecha`, **`serieSaldos`** (saldo acumulado línea a línea) | 5.1.2 |
| `traspasos.ts` | `registrarTraspaso` (agregado con sus dos espejos), `verificarEspejos` | 5.1.1 |
| `anulacion.ts` | contramovimiento + auditoría | 5.1.4 |
| `arqueo.ts` | recuento por denominaciones vs. teórico, diferencia y explicación obligatoria | 5.1.2 |
| `conciliacion.ts` | casado por importe + fecha ±3 días + alias de tercero; bandeja de no casados | 5.1.3 |
| `tarifas.ts` | `tarifaAplicable` con precedencia excepción → grupo → tramo, **y su motivo** | 5.3 |
| `liquidacion.ts` | `días × tarifa/día ± anticipos vivos`, con el desglose en texto | 5.3 |
| `prorrateo.ts` | media mensualidad por incorporación a mitad de mes | 5.3 |
| `escuelas.ts` | importe de inscripción con bonificaciones y **tarifa congelada** | 5.4 |
| `cuotas.ts` | fraccionamiento, impagos, antigüedad de saldo, compensaciones | 6.4 |
| `presupuesto.ts` | previsto vs. real vs. desviación, con semáforo | 5.5.3 |
| `politica.ts` | **superávit/déficit de competición** y coste por participante | 5.5.1-2 |
| `prevision.ts` | tesorería a 90 días cruzando vencimientos, cuotas y compromisos | 5.5.4 |
| `clasificacion.ts` | PJ/PG/PP, coeficiente de sets y de puntos | 4.3 |
| `estadisticas.ts` | agregados por jugador y equipo, valoración +/− | 4.3 |
| `reparto.ts` | reparto de coste de viaje entre equipos sin perder céntimos | 4.6 |

**El principio rector (§5.5.1) es una función, no un informe.** `resultadoCompeticion(temporada)`
devuelve `{ingresosCuotas, costeCompeticion, resultado, patrocinioConsumido}` y la cabecera
lo enseña siempre. Cuando `resultado < 0`, la app dice cuánto patrocinio se está comiendo
el déficit. Es la regla que el club quiere vigilar, así que va en el sitio donde no se
pueda ignorar.

---

## 4. Importación del histórico (§7) — el criterio de aceptación 1

El criterio 1 dice: *reproduce **exactamente** el saldo de caja y de banco del histórico
importado, movimiento a movimiento*. Cómo pienso demostrarlo, no prometerlo:

El Excel de control de caja trae una **columna de saldo acumulado**. El importador
recalcula el saldo con `serieSaldos` y lo **compara línea a línea con esa columna**,
señalando la primera divergencia con su número de fila. Si el fichero cuadra consigo
mismo, la app lo reproduce; si no cuadra (que es lo probable, y es justo lo que hay que
descubrir), la app dice **dónde** se rompe en vez de tragárselo.

El resto del §7 se cumple con el patrón ya probado en finanzas: previsualización siempre
antes de tocar nada, detección de duplicados, columnas **por cabecera y no por posición**,
lo ilegible se descarta **con su motivo** (nunca se inventa una fecha), y cada tanda
registra un `LoteImportacion` con los ids creados para poder **deshacerla entera**.
Los ~600 movimientos del informe bancario sin clasificar van a una bandeja
**"pendiente de clasificar"**, no a la basura, y cuentan en rojo hasta que se clasifican.

---

## 5. Fases

El §11 del prompt tiene 11 fases pensadas para un stack con backend y roles. Con D1 y D2
la Fase 1 casi desaparece y el orden cambia para atacar antes lo que hoy duele (el Excel).
Al final de cada fase: tests en verde, build limpio, commit, y resumen de "hecho / falta".

| Fase | Contenido | Corresponde a |
|---|---|---|
| **0** | Este documento. | F0 |
| **1** | Andamiaje `club/`, `compartido/`, tokens y layout, temporadas, configuración, auditoría, backup + copia al Umbrel. | F1 (sin auth) |
| **2** | Núcleo financiero: cuentas, movimientos, categorías, terceros, **traspasos espejo**, saldos, arqueo. Con tests. | F2 |
| **3** | Importador del histórico + bandeja de pendientes + módulo de Dudas. | F3 |
| **4** | Personas, equipos, fichas de jugador, tutores, consentimientos, cuotas e impagos. | F4 |
| **5** | Cuerpo técnico: partidas, tarifas con vigencia, devengado/pagado/pendiente, anticipos, **hoja de pago con firma**. | F5 |
| **6** | Escuelas de verano completo (el bloque con la regla de tarifa congelada). | F6 |
| **7** | Presupuesto, política financiera, previsión a 90 días, panel de control. | F9 |
| **8** | Patrocinadores, subvenciones, proveedores, viajes. | F8 |
| **9** | Competición: calendario, convocatorias, resultados set a set, estadísticas. | F7 |
| **10** | Conciliación bancaria avanzada (N43 + extracto CaixaBank), memoria económica, PWA, manual y despliegue. | F10 |

**Presupuesto (F9 del prompt) sube al puesto 7 y competición baja al 9.** Motivo: el
presupuesto y el panel son la respuesta a las cinco preguntas del criterio de aceptación 4,
y dependen solo de las fases 2-6; competición es el módulo más grande y el único cuyo
Excel actual no está ardiendo. Si prefieres el orden literal del prompt, se cambia.

**Despliegue:** se añade un tercer bloque al `.github/workflows/deploy.yml` (tests +
build + copia a `dist/club/`), calcado del de finanzas, publicando en
`…/clauderoutine/club/`. Aviso: ese workflow **solo se dispara en `main` y en la rama del
vóley**, no en esta rama de desarrollo — ver D6.

---

## 6. Dudas que necesito que me resuelvas

El §13 del prompt dice que no invente reglas financieras. No las voy a inventar. **Las
tres primeras bloquean fases enteras; el resto puede esperar.**

**Bloqueantes**

1. **Importes reales.** No hay una sola cifra en el prompt. Necesito, para la Fase 5 y 6:
   tarifa mensual de entrenador principal y de ayudante, tarifa/día de monitor por tramo
   (benjamines vs. jóvenes), partida de coordinación/dirección técnica, y qué excepciones
   individuales existen hoy. Van a Configuración con fecha de vigencia, **nunca al código**.
2. **Cuotas de jugador.** ¿Importe por categoría o único? ¿Temporada completa, mensual o
   fraccionada en plazos? ¿Hay bonificación de hermanos, y de cuánto? ¿Qué se hace hoy
   con un impago a final de temporada?
3. **Régimen de los técnicos.** Esto no está en el prompt y cambia el modelo: ¿cobran por
   **nómina** (con IRPF y Seguridad Social), como **autónomos con factura**, o como
   compensación de gastos? Si hay retención, hacen falta el 111 y el 190 y eso es un
   módulo que hoy no está planificado. Es la pregunta que más me preocupa.

**Importantes, no bloqueantes**

4. **IVA.** ¿El club emite factura con IVA por los patrocinios comerciales, o se acoge a
   la exención del art. 20 LIVA para entidades deportivas sin ánimo de lucro? Determina si
   hace falta libro de IVA y modelo 303.
5. **Ficheros reales.** Para el importador necesito los cuatro tal cual están hoy: control
   de caja, informe bancario, presupuesto multi-hoja y listado maestro de jugadores. Los
   lectores se escriben **contra el fichero de verdad y se convierten en test de
   regresión** — es exactamente así como se cazaron los bugs de CaixaBank en finanzas.
   Con ficheros inventados, el importador funcionará con ficheros inventados.
6. **La discrepancia del §5.1.3** (8.550 € de cajero en banco vs. 4.500 € en caja):
   ¿es un caso real pendiente de aclarar en el histórico, o un ejemplo del tipo de cosa
   que hay que detectar? Si es real, es la primera `Duda` que se crea al importar.
7. **Alcance histórico.** ¿Solo 2025-26 + verano 2026, o hay temporadas anteriores que
   cargar?
8. **Quincenas de escuelas.** Fechas exactas y **cómo se cuentan los días lectivos**
   (¿L-V?, ¿festivos descontados?, ¿se cuenta el día que llueve?). El cálculo de nóminas
   de monitores cuelga entero de esto.
9. **Competición.** Organizador (¿FVCV?) y si hay clasificación oficial publicada contra
   la que cuadrar la nuestra. Formato de puntuación de la liga (3-0/3-1 = 3 puntos, 3-2 = 2…).
10. **Subvenciones vivas** y sus fechas límite de justificación, para la alerta a 30 días.
11. **N43.** ¿Puedes descargar el extracto en Norma 43 desde la banca de CaixaBank? El
    lector ya existe y probado; sería la vía más limpia para la conciliación.
12. **Datos de salud.** ¿Quieres guardarlos (alergias, observaciones médicas)? Mi
    recomendación es sí y cifrados con contraseña; pero si prefieres no tenerlos en la
    app, se quita la entidad y se acabó el problema.

**Decisiones de proyecto**

- **D5 · `compartido/`:** ¿creo la carpeta compartida en la raíz, o prefieres que `club/`
  lleve su copia de los módulos y las apps queden totalmente independientes?
- **D6 · Rama que publica:** el workflow de Pages se dispara en `main` y en
  `claude/tournament-bracket-manager-gvrcdt`. Esta app se desarrolla en
  `claude/voley-playa-club-management-gczqmk`. ¿Añado esta rama al workflow, o el
  despliegue se hace fusionando a la rama de publicación como con finanzas?
- **D7 · Copias de seguridad desde el día uno.** El 11/08 se perdieron los datos de tres
  sociedades en finanzas. Propongo que la Fase 1 incluya ya el backup y la copia al
  Umbrel, **antes** de que haya un solo dato dentro. Es la lección más cara del repo.

---

Con las tres bloqueantes respondidas (y D5/D6), arranco la **Fase 1**.
Si algo del modelo de datos no encaja con cómo lo lleváis hoy, dímelo ahora:
cambiarlo en este documento cuesta un minuto y en la Fase 6 cuesta una semana.
