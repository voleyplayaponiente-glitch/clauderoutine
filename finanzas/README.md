# Gestión Financiera Integral

Aplicación web (español, PWA offline-first) de gestión financiera para una S.L. de
retail con múltiples puntos de venta. Arquitectura **client-first**: todo el motor
contable en TypeScript puro y testeado, datos en IndexedDB, desplegable como estático.

> Vive en `finanzas/` dentro del repo `clauderoutine`. **No comparte código ni
> despliegue con la app de vóley ni con la de gestión laboral**, que siguen intactas.

## Comandos
```bash
cd finanzas
npm install
npm run dev      # desarrollo (http://localhost:5173)
npm test         # tests del motor (Vitest)
npm run build    # tsc -b && vite build
npm run preview  # previsualizar producción / PWA
```

## Estado — Fases 0 y 1 ✅
**Fase 0 (cimientos)**
- Motor puro en `src/dominio/` con tests: `dinero` (aritmética en céntimos, sin float),
  `parseo-es` (heurística de millar: `180.000` = ciento ochenta mil), `iva` (base/cuota/total
  en cualquier dirección, exento/no sujeto/ISP), `partida-doble` (detección de descuadre),
  `validacion` (NIF/NIE/CIF).
- Configuración por defecto (PGC, tipos de IVA, calendario fiscal 303/111/115/200/202/347/573,
  impuesto especial de vapeo por ml y límite de pago en efectivo) **verificada y editable,
  nunca hardcodeada** en la lógica.
- Shell: tokens de diseño, modo claro/oscuro, layout responsive con navegación a los 13
  módulos, estados vacíos cuidados, esqueletos de carga y persistencia en IndexedDB.

**Fase 1 (configuración)** — se puede configurar la empresa entera:
- **Empresa**: datos fiscales, CIF con validación (aviso, no bloqueo), logo, estructura de grupo.
- **Puntos de venta / centros de coste**: alta, edición y cierre conservando histórico, con
  tipo, coste fijo y objetivo de venta.
- **Plan contable** editable (alta/edición/borrado, buscador, restaurar PGC).
- **Impuestos**: tipos de IVA, impuestos especiales por ml/unidad y calendario fiscal.
- **Categorías de gasto** con deducibilidad y cuenta contable.
- **Umbrales y alertas** · **Apariencia** (tema, densidad, fecha, moneda).
- **Datos**: exportar/importar la configuración en JSON abierto.

**Fase 2 (ventas diarias + compras)** — ya se puede usar a diario:
- **Ventas diarias** por punto de venta: líneas por tipo de IVA, cobros por forma
  (efectivo/tarjeta/Bizum/transferencia/pasarela/aplazado), tickets, ticket medio y
  **cierre firmado**. Detecta el descuadre cobros ≠ bruto y no deja cerrar el día si no cuadra.
- **Compras**: mercadería o servicio, IVA, retención, vencimiento (auto según condiciones
  del proveedor), centro de coste, categoría, **deducibilidad con motivo obligatorio** y adjunto.
- **Proveedores** con CIF validado, condiciones de pago e IBAN; alta rápida desde la compra.
- **Partida doble interna**: cada venta y cada compra generan su asiento cuadrado
  (`asientoVenta`/`asientoCompra`), verificado en los tests.

**Fase 3 (caja y bancos)** — control de efectivo y banco completo:
- **Caja y arqueos**: una caja por punto de venta / caja central, movimientos de efectivo
  y **arqueo por denominación** (billetes y monedas) con control de descuadre; si supera el
  umbral tolerado, exige **explicación obligatoria** y genera el ajuste.
- **Bancos**: cuentas corrientes, TPV liquidadores y pasarelas; movimientos manuales e
  **importación Norma 43** (parser propio, idempotente: no duplica al reimportar).
- **Conciliación** semiautomática: bandeja de no conciliados, conciliar con un clic y
  **sugerencias caja → banco** por el motor de emparejamiento (importe + fecha + concepto).
- Motor: `tesoreria`, `conciliacion` y `n43` con tests.

**Fase 4 (stock)** — inventario operativo:
- **Maestro de artículos** (referencia, EAN, familia, PVP, stock mínimo/óptimo, impuesto
  especial por ml) y **multi-almacén** (central, tienda, tránsito).
- **Movimientos**: entradas por compra, salidas por venta, **traspasos entre almacenes**
  (pareja de apuntes), mermas, roturas, autoconsumo y aprovisionamiento de apertura.
- **Valoración a coste medio ponderado** por artículo y almacén; valor de inventario a
  coste y a PVP, alertas de bajo mínimo y **stock muerto**.
- **Inventario físico**: recuento vs. teórico y **regularización** que genera los
  movimientos y su asiento 300/610.
- Motor: `valoracion`, `stock` e `inventario` con tests.

**Fase 5 (importación universal)** — carga masiva de histórico:
- Asistente de **4 pasos**: subida y detección de tipo → **mapeo visual de columnas**
  (con sugerencia automática y **plantillas guardables**) → **previsualización validada**
  (filas verde/ámbar/rojo, celdas editables, **detección de duplicados**) → importación.
- **Excel** (SheetJS, carga diferida) y **CSV/TSV** (parser propio con detección de
  separador y comillas). Los PDF de factura se completan a mano (nunca se inventan datos).
- Destinos: artículos, proveedores/clientes y movimientos bancarios. **Deshacer la
  importación completa como bloque.** Idempotencia por clave de duplicado.
- Motor: `csv` e `importacion` con tests.

**Fase 6 (deudas y deudores)** — posición deudora y acreedora completa:
- **Deudas**: préstamos, pólizas, leasing/renting y acreedores con **cuadro de
  amortización** (francés o lineal, desglose capital/intereses), capital pendiente,
  **vencimientos por tramos** y aviso de operaciones vinculadas.
- **Deudores**: clientes aplazados, préstamos concedidos, anticipos y fianzas con
  **antigüedad de saldos** por tramos, **provisión por insolvencia** escalonada,
  historial de reclamaciones y generación de email de reclamación.
- Motor: `amortizacion` y `vencimientos` con tests. **83 tests en verde.**

## Arquitectura
- `src/dominio/` — motor contable en TS puro, sin React (testeable en aislamiento).
- `src/lib/` — persistencia (IndexedDB), router hash, registro de módulos.
- `src/store/` — estado global (Zustand) + persistencia con debounce.
- `src/componentes/` — UI reutilizable. `src/pantallas/` — pantallas por módulo.

## Roadmap
Fase 1 Configuración · 2 Ventas+Compras · 3 Caja+Bancos · 4 Stock · 5 Importación ·
6 Deudas+Deudores · 7 Presupuesto+Tesorería · 8 Dashboard · 9 Informes · 10 Copias ·
11 Conectores (Square, banca) · 12 Pulido. Ver `../PLAN_APP_FINANCIERA.md`.
