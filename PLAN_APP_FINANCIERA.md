# Plan de trabajo — Aplicación de Gestión Financiera Integral

Respuesta a `PROMPT_APP_GESTION_FINANCIERA.md`, punto 11. Nada de código todavía:
stack, modelo de datos, estructura de carpetas, riesgos y plan de Fases 0-1.

---

## 0. Situación de partida (importante)

Este repositorio (`clauderoutine`) contiene hoy el **Gestor de Torneos de Vóley Playa**,
publicado en GitHub Pages, y su workflow compila la raíz del repo. La app financiera es
un producto distinto y con arquitectura distinta, así que **dónde vive** es la primera
decisión a cerrar (ver §5, D1). El plan siguiente asume la opción recomendada:
carpeta propia `finanzas/` en este repo, sin tocar el despliegue actual del vóley.

---

## 1. Stack definitivo

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Ya validado en este entorno; arranque instantáneo, build estático. |
| Estilos | Tailwind CSS v4 + design tokens propios | Tokens (color, radio, espaciado 8 px, tipografía tabular) en un único fichero → modo claro/oscuro real y coherencia estilo Apple sin CSS disperso. |
| Gráficos | Recharts | Cubre líneas, barras apiladas y waterfall; API declarativa. Visx solo si el waterfall con drill-down se queda corto. |
| Backend | Node.js + Fastify + TypeScript | Necesario, no opcional: credenciales de conectores cifradas en servidor, auditoría inmutable, roles reales, backups. Fastify por validación de esquemas nativa (JSON Schema → tipos). |
| BD | PostgreSQL (SQLite para arranque local) | Postgres por `numeric` exacto (nunca `float` para dinero), constraints y transacciones serias. SQLite para `npm run dev` sin Docker. |
| ORM | Prisma | Migraciones versionadas y tipado end-to-end. |
| Dinero | `decimal.js` + columnas `numeric(14,2)` / `numeric(14,6)` para tipos de cambio | Un `float` en contabilidad es un descuadre esperando su turno. Prohibido en todo el código. |
| Auth | Sesión con JWT (cookie httpOnly) + Argon2id + TOTP opcional | Cookie httpOnly evita XSS-robo de token; Argon2id es el estándar actual de hashing. |
| Ingesta | SheetJS (XLSX/XLS), PapaParse (CSV/TSV), `pdf-parse` + Tesseract (`spa`) para escaneados, parser propio N43 y CAMT.053 | N43 es formato fijo español mal cubierto por librerías; se implementa y se testea con ficheros reales. |
| Jobs | Cron interno (`node-cron`) en v1, con la interfaz preparada para BullMQ | Redis es una pieza más que mantener; el volumen (sincronizaciones diarias, backup nocturno) no lo justifica todavía. |
| Tests | Vitest (lógica y API) + Playwright (flujos críticos) | |
| Empaquetado | Docker Compose (app + Postgres) y modo `npm run dev` con SQLite | Cumple "un solo comando" por las dos vías. |

**Regla transversal:** toda la lógica de cálculo vive en `packages/dominio`, TypeScript puro
sin dependencias de React ni de Prisma, testeable en aislamiento. Misma disciplina que ya
funcionó en el motor del gestor de torneos.

---

## 2. Modelo de datos

### 2.1 El apunte contable (el corazón)

```
Asiento            id, ejercicioId, periodoId, fecha, concepto, tipo,
                   origen(MANUAL|EXCEL|CSV|PDF|API), documentoId, ficheroOrigenId,
                   asientoRectificadoId?, creadoPor, creadoEn, anuladoEn?
Apunte             id, asientoId, cuentaId, debe numeric(14,2), haber numeric(14,2),
                   centroCosteId?, terceroId?, divisa, tipoCambio, importeEur,
                   conceptoLinea
```

Decisiones y por qué:

- **Un único libro diario para toda la app.** Ventas, compras, caja, banco, stock,
  amortizaciones e impuestos no escriben en la BD por su cuenta: llaman a un servicio
  `contabilizar(asiento)` que valida `Σdebe = Σhaber` y que el periodo esté abierto,
  todo en una transacción. Así el **balance de sumas y saldos cuadra por construcción**,
  no porque alguien se acuerde de cuadrarlo (criterio de aceptación 4).
- **Debe y haber como dos columnas, no un importe con signo.** Es la representación del
  PGC, hace el descuadre detectable con una sola consulta y evita discusiones de signo.
- **Asiento inmutable una vez publicado.** Corregir genera un asiento nuevo que apunta al
  anterior por `asientoRectificadoId`. Nada se borra: `anuladoEn` + auditoría.
- **`importeEur` calculado y almacenado** junto a divisa y tipo de cambio: multi-divisa
  preparado sin recalcular históricos cuando cambie el cambio (v1 solo EUR).
- El usuario nunca ve esto salvo que quiera: hay una pestaña "Contabilidad" en cada
  documento que muestra su asiento.

### 2.2 Centro de coste y punto de venta

```
CentroCoste        id, codigo, nombre, tipo(PUNTO_VENTA|ESTRUCTURA|PROYECTO),
                   padreId?, activoDesde, activoHasta?
PuntoVenta         id, centroCosteId (1:1), tipo(TIENDA|STAND|WEB|MARKETPLACE|
                   MAYORISTA|EVENTO), direccion, responsableId, aperturaEl,
                   cierreEl?, costeFijoMensual, objetivoVentaMensual
```

**El centro de coste es la entidad genérica y el punto de venta una especialización 1:1.**
Motivo: el apunte contable solo necesita saber a qué centro imputar (y así "estructura",
"proyecto" o un futuro departamento funcionan igual), mientras los campos de retail
(objetivo de venta, coste fijo, responsable) no ensucian el libro. `padreId` permite
agrupar (p. ej. todos los stands de una provincia) sin duplicar informes. Cerrar un punto
de venta es poner `cierreEl`: **el histórico y sus apuntes se conservan intactos**.

### 2.3 Multi-almacén y stock

```
Almacen            id, nombre, tipo(CENTRAL|TIENDA|TRANSITO), puntoVentaId?
Articulo           id, referencia, ean, descripcion, familiaId, subfamiliaId,
                   proveedorPrincipalId, pvp, stockMinimo, stockOptimo,
                   impuestoEspecialId?, contenidoMl?, anuladoEn?
MovimientoStock    id, articuloId, almacenId, fecha, tipo(COMPRA|VENTA|TRASPASO|
                   MERMA|ROTURA|AUTOCONSUMO|REGULARIZACION), cantidad,
                   costeUnitario, esAprovisionamientoApertura bool,
                   documentoOrigenId, asientoId?, traspasoParejaId?
ExistenciaAlmacen  articuloId, almacenId, cantidad, costeMedioPonderado (derivada)
```

- **El almacén es una entidad propia con FK opcional al punto de venta**, no un campo del
  punto de venta. Así una tienda puede tener trastienda + expositor, existe el almacén
  central sin punto de venta asociado, y el **traspaso entre tiendas** es simplemente dos
  movimientos hermanos (`traspasoParejaId`) que no alteran la valoración global.
- **La fuente de verdad son los movimientos; `ExistenciaAlmacen` es una materialización**
  recalculable. Si algún día un saldo parece raro, se reconstruye desde cero y se compara:
  el descuadre se ve, no se tapa.
- `esAprovisionamientoApertura` excluye esos lotes de los ratios de rotación (§4.4 del prompt).
- Coste medio ponderado por (artículo, almacén) recalculado en cada entrada; FIFO como
  estrategia alternativa detrás de la misma interfaz `Valorador`.

### 2.4 Resto de entidades principales

- **`Tercero` unificado** (proveedor, cliente, acreedor, deudor, empleado, socio, empresa
  del grupo) con flags de rol, CIF, IBAN, condiciones de pago y `esVinculada`. Una misma
  sociedad puede ser cliente y proveedor a la vez: duplicarla rompería el 347 y el saldo neto.
- **`Factura` / `LineaFactura`** (emitida y recibida en la misma tabla con `tipo`, porque
  el libro registro de IVA las trata simétricamente). Cada línea: base, tipo de IVA, cuota,
  retención, impuesto especial, artículo, centro de coste, `deducible` + `motivoNoDeducible`
  (obligatorio si `deducible = false`).
- **`Vencimiento`** como entidad de primera clase (facturaId o deudaId, fecha, importe,
  estado) y **`AplicacionPago`** N:M entre vencimiento y movimiento de tesorería. Esto
  resuelve de una vez: pagos parciales, antigüedad de saldos, tramos de vencimiento y
  previsión de tesorería, sin cálculos ad hoc por módulo.
- **`CuentaTesoreria`** unifica banco y caja (`tipo`: BANCO | CAJA | TPV_LIQUIDADOR |
  PASARELA), con `MovimientoTesoreria` común. La posición de tesorería, la conciliación y
  la previsión trabajan sobre una sola tabla; el TPV liquidador modela el desfase de cobro
  de tarjeta como cuenta puente.
- **Caja:** `SesionCaja` (apertura/cierre por punto de venta), `ArqueoCaja` +
  `DetalleDenominacion`, con `diferencia` y `explicacion` obligatoria por encima del umbral.
- **Ventas:** `VentaDiaria` (única por punto de venta y fecha) + `DesgloseIvaVenta` +
  `DesgloseCobroVenta`. La unicidad impide el doble registro del mismo día.
- **`Deuda` + `CuotaAmortizacion`** (cuadro francés o lineal generado y persistido, con
  desglose capital/interés) alimentando directamente los vencimientos y la previsión.
- **Impuestos parametrizados:** `TipoIva`, `ImpuestoEspecial` (base por ml o por unidad,
  familia aplicable) y `ObligacionFiscal` — todos con `vigenciaDesde`/`vigenciaHasta`, de
  modo que un cambio de tipo no reescribe el pasado. **Cero tipos hardcodeados.**
- **`Importacion` + `LineaImportacion`** (JSON crudo, estado de validación, id del registro
  creado): permite previsualizar, detectar duplicados y **deshacer la importación como bloque**.
- **`RegistroFacturacion`**: cadena append-only con `huella`, `huellaAnterior`, timestamp y
  `estado`. Es la estructura que exige un sistema informático de facturación verificable;
  se rellena desde la v1 aunque no se certifique, así que **no habrá migración destructiva**.
- **`RegistroAuditoria`**: usuario, acción, entidad, valor anterior/nuevo (JSON), fecha, IP.
  Solo INSERT; revocado el UPDATE/DELETE a nivel de rol de BD.
- **`Periodo`** con `estado` (ABIERTO | CERRADO): cerrado, ningún módulo escribe en él.

---

## 3. Estructura de carpetas

```
finanzas/
├─ docker-compose.yml
├─ package.json                 # workspaces
├─ packages/
│  ├─ dominio/                  # TS puro, sin React ni Prisma — aquí vive el cálculo
│  │  └─ src/
│  │     ├─ dinero.ts           # Decimal, redondeo, formato es-ES
│  │     ├─ parseo-es.ts        # "180.000" → 180000  (heurística de millar)
│  │     ├─ iva.ts              # base↔cuota↔total en cualquier dirección, ISP, exento
│  │     ├─ impuesto-especial.ts
│  │     ├─ partida-doble.ts    # validación de cuadre
│  │     ├─ valoracion.ts       # coste medio ponderado / FIFO
│  │     ├─ amortizacion.ts     # cuadro francés / lineal
│  │     ├─ tesoreria.ts        # proyección de saldo diario
│  │     ├─ ratios.ts           # con deuda comercial y fiscal separadas
│  │     ├─ conciliacion.ts     # emparejamiento por importe+fecha+concepto
│  │     └─ *.test.ts
│  └─ tipos/                    # tipos y contratos compartidos web↔api
├─ apps/
│  ├─ api/
│  │  ├─ prisma/schema.prisma + migrations/
│  │  └─ src/
│  │     ├─ modulos/            # ventas, compras, caja, bancos, stock, deudas,
│  │     │                     # deudores, presupuesto, tesoreria, informes, backup
│  │     ├─ contabilidad/       # servicio contabilizar() + cierre de periodo
│  │     ├─ importacion/        # xlsx, csv, pdf, n43, camt053
│  │     ├─ conectores/         # interfaz común + square/, banca-psd2/, stripe/…
│  │     ├─ auth/  auditoria/  cripto/
│  │     └─ jobs/
│  └─ web/
│     └─ src/
│        ├─ tokens.css          # design tokens (claro/oscuro)
│        ├─ componentes/        # Tarjeta, Tabla, ImporteEuro, Semaforo, Esqueleto…
│        ├─ pantallas/          # una carpeta por módulo del §4 del prompt
│        └─ graficos/
└─ e2e/                         # Playwright
```

---

## 4. Fases (calendario propuesto)

Mismo orden que el §8 del prompt. Al final de cada fase: tests en verde, build limpio,
commit y resumen de "hecho / falta". No se avanza de fase con la anterior a medias.

---

## 5. Riesgos y decisiones abiertas — necesito tu confirmación

**D1 · ¿Dónde vive la app?**
(a) carpeta `finanzas/` en este repo *(recomendada: no toca el despliegue del vóley y es
reversible)*; (b) repositorio nuevo *(más limpio a largo plazo, requiere que yo lo cree)*;
(c) sustituir la app de vóley *(su web dejaría de publicarse)*.

**D2 · ¿Backend real o solo cliente?**
El documento pide backend, y con razón: roles por tienda, auditoría inmutable, credenciales
de conectores cifradas y backups automáticos **no se pueden garantizar en el navegador**.
La contrapartida es que **GitHub Pages no puede alojarla**: harían falta Docker en tu Mac o
un servidor pequeño. Si lo prioritario es usarla ya desde el iPhone en tienda sin montar
nada, la alternativa es PWA 100 % cliente (como el vóley) renunciando a esas cuatro cosas
hasta añadir servidor. Mi recomendación: backend real.

**D3 · ¿Quién la usa?** Solo tú (simplifica muchísimo la v1), varios con roles por tienda,
o tú + asesoría en modo consulta.

**D4 · Tipos impositivos a verificar antes de fijar defaults.** El prompt lo pide
explícitamente y no pienso inventarlos: impuesto especial sobre líquidos (tipo por ml) y
límite legal de pago en efectivo entre empresarios. Los verificaré contra AEAT/BOE al
empezar la Fase 1 y quedarán como **valores por defecto editables con fecha de vigencia**,
nunca en el código.

**D5 · Hosting y backups.** Si va backend: ¿Docker en tu Mac, o servidor accesible desde
las tiendas? De esto depende dónde se guardan los backups cifrados y los adjuntos.

**D6 · Conector Square.** Hay un conector de Square en este entorno, pero **está sin
autorizar**; requiere que le des acceso desde tus ajustes de conectores de claude.ai. No
bloquea nada hasta la Fase 11, y la app funcionará igual con importación de ficheros.

**D7 · OCR de facturas escaneadas.** Tesseract da resultados irregulares con facturas de
proveedor. La app **nunca inventará un dato**: si la extracción no es fiable, muestra el PDF
al lado del formulario y deja los huecos vacíos y marcados. Asúmelo como ayuda, no como
automatismo.

**D8 · Alcance de facturación verificable.** La v1 deja la estructura encadenada lista,
pero no certifica ni remite a la AEAT. Si necesitas emitir facturas legalmente con el
sistema desde el día uno, dímelo: cambia el orden de las fases.

---

## 6. Fase 0 — Cimientos (entregable: app arrancable con navegación vacía)

1. Andamiaje del workspace (`packages/dominio`, `packages/tipos`, `apps/api`, `apps/web`)
   con TypeScript estricto, ESLint y Vitest configurados.
2. `docker-compose.yml` (app + Postgres) y modo `npm run dev` con SQLite. Un solo comando
   por ambas vías.
3. **Esquema Prisma completo** del §2 + primera migración + seed *vacío* (solo plan contable
   PGC por defecto, tipos de IVA y calendario fiscal; **ningún dato ficticio de negocio**).
4. Núcleo de dominio con tests desde el primer día: `dinero`, `parseo-es`
   (el caso `180.000` → 180000), `iva` en las cuatro direcciones, `partida-doble`.
5. Servicio `contabilizar()` con validación de cuadre y de periodo abierto, más
   `RegistroAuditoria` y borrado lógico como comportamiento por defecto de todo el ORM.
6. Design tokens, modo claro/oscuro, layout base (barra lateral + cabecera con filtros
   globales), navegación a los 13 módulos con estados vacíos cuidados y esqueletos de carga.
7. Componentes base: `ImporteEuro` (tabular, € detrás, coma decimal), `Tabla` con columnas
   configurables y exportación, `Semaforo`, `Tarjeta`, `EstadoVacio`.
8. Health check, manejo de errores homogéneo y CI (tests + build) en GitHub Actions,
   **sin tocar el workflow de Pages del vóley**.

## 7. Fase 1 — Configuración (entregable: se puede configurar la empresa entera)

1. Empresa: datos fiscales, CIF, ejercicio contable, logotipo, estructura de grupo.
2. Centros de coste y puntos de venta: alta, cierre con conservación de histórico,
   reconversión, coste fijo y objetivo mensual.
3. Plan contable editable + mapeo categoría → cuenta, partiendo de los valores por defecto
   del §3.2 del prompt.
4. Impuestos: tipos de IVA con vigencia, retenciones, impuestos especiales por familia
   (tipo por ml / por unidad) y calendario fiscal español precargado (303, 111, 115, 200,
   202, 347). **Verificación previa de D4.**
5. Categorías de ingreso y gasto con deducibilidad por defecto.
6. Umbrales y alertas: saldo mínimo de seguridad, descuadre de caja tolerado, días de stock
   muerto, límite de pago en efectivo, días de retraso para reclamar, meses en negativo
   para alertar de un punto de venta.
7. Usuarios y roles con permisos por módulo y acción (según D3), Argon2id, sesiones con
   caducidad y cierre remoto, 2FA opcional.
8. Ejercicios y periodos: apertura, cierre y bloqueo con asiento de ajuste trazado.
9. Apariencia: claro/oscuro, densidad, formato de fecha y moneda.
10. Tests de todo lo anterior y export/import de la configuración completa en JSON.

---

Con D1, D2 y D3 confirmadas (las demás pueden esperar), digo "adelante" y empiezo por la Fase 0.
