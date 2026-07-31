# Guía de usuario — Gestión Financiera

Aplicación web (en español, PWA) para la gestión financiera integral de una S.L.
de retail con varios puntos de venta. Funciona **sin conexión** y guarda los datos
**en tu dispositivo**. Esta guía explica el uso diario módulo a módulo.

---

## 1. Primeros pasos

1. Abre la app. La primera pantalla es el **Dashboard**; al principio estará vacío.
2. Ve a **Configuración** (menú lateral, abajo) y completa, por este orden:
   - **Empresa**: razón social, CIF, ejercicio, logo (se usa en los informes PDF).
   - **Puntos de venta**: da de alta cada tienda, stand o la web, con su objetivo de
     venta y su coste fijo mensual.
   - **Impuestos**: revisa los tipos de IVA, el impuesto especial (ya viene el del vapeo:
     0,15 €/ml y 0,20 €/ml) y el calendario fiscal. **Verifica los tipos vigentes**: son
     editables, la app no los da por definitivos.
   - **Umbrales**: saldo mínimo de seguridad, descuadre de caja tolerado, etc.
3. A partir de ahí ya puedes registrar la operativa diaria.

> **Instalar en el iPhone/iPad o Mac**: abre la web, comparte → «Añadir a pantalla de
> inicio». Se instala como app y funciona offline. Tras un despliegue nuevo, basta recargar.

---

## 2. Uso diario

### Ventas diarias
Registra la venta de cada punto de venta: importe por **tipo de IVA** (la cuota se calcula
sola), reparto por **forma de cobro** (efectivo, tarjeta, Bizum…), nº de tickets y unidades.
Al cerrar el día se pide la **firma del responsable**. Si los cobros no cuadran con el bruto,
la app lo marca en rojo y **no deja cerrar** hasta corregirlo.

### Compras
Registra facturas de **mercadería** o de **servicios**: IVA, retención, vencimiento
(se calcula solo según las condiciones del proveedor), centro de coste y **deducibilidad**
(si marcas un gasto como no deducible, el motivo es obligatorio). Puedes dar de alta un
proveedor sin salir de la compra.

### Caja y arqueos
Una caja por punto de venta. Registra entradas y salidas de efectivo y, al cerrar, haz un
**arqueo** contando billetes y monedas: la app compara lo contado con el teórico y, si el
descuadre supera el umbral, exige una **explicación**.

### Bancos
Da de alta tus cuentas, importa el extracto en **Norma 43** (no duplica si reimportas) y
**concilia** los movimientos con un clic. Las sugerencias caja→banco cruzan tus ingresos.

---

## 3. Control y stock

- **Stock**: maestro de artículos, varios almacenes, movimientos (compra, venta, traspaso,
  merma…), **valoración a coste medio ponderado** e **inventario físico** con regularización.
- **Deudas**: préstamos y acreedores con **cuadro de amortización** (francés o lineal) y
  vencimientos por tramos.
- **Deudores**: cobros pendientes con **antigüedad de saldos**, provisión por insolvencia
  y generación de emails de reclamación.

---

## 4. Planificación

- **Presupuesto y cash flow**: presupuesto anual por línea y mes, comparado con el real y
  su desviación. Puedes generarlo desde el histórico con un factor de crecimiento.
- **Previsión de tesorería**: el saldo diario proyectado a 30/60/90 días y 12 meses, con
  **alerta de tensión de liquidez** antes de que ocurra. Es el módulo más importante para
  el día a día.

---

## 5. Dirección e informes

- **Dashboard**: KPIs (tesorería, ventas vs. objetivo, margen, resultado, deuda, stock),
  **centro de alertas** priorizado y gráficos. Cada KPI y alerta es **clicable**.
- **Listados e informes**: libros de IVA y **modelo 303**, **modelo 347**, **balance de
  sumas y saldos**, **balance de situación** y **P&G** en formato PGC. Todo exportable a
  **CSV, Excel y PDF**, más el **informe ejecutivo mensual en PDF** para banco o asesoría.

> El balance **cuadra siempre** (Activo = Pasivo + PN) y coincide con la P&G. Si alguna vez
> no cuadrara, se muestra en rojo: nunca se oculta.

---

## 6. Importación masiva

En **Importación** puedes cargar histórico desde Excel o CSV en 4 pasos: subida, mapeo de
columnas (guardable como plantilla), previsualización con validación (verde/ámbar/rojo y
detección de duplicados) e importación, que puedes **deshacer como bloque**. Los PDF de
factura se completan a mano junto al documento: la app nunca inventa un dato que no puede leer.

---

## 7. Copias de seguridad

- **Copia manual**: descarga todos tus datos en **JSON** (con checksum de integridad) o Excel.
- **Restaurar**: sube un backup; se verifica la integridad y se crea un **backup previo**
  antes de sobrescribir.
- **Snapshots automáticos** diarios en el dispositivo (retención de 7 días).

Exporta tus datos con regularidad: al vivir en el dispositivo, si borras los datos del
navegador se pierden. Los backups en la nube o disco externo llegarán con el módulo de servidor.

---

## 8. Apariencia y accesibilidad

En **Configuración → Apariencia**: modo **claro/oscuro**, **densidad** (cómoda o compacta),
formato de fecha y moneda. La app es **responsive** (móvil para consultar y registrar,
escritorio para analizar), navegable por teclado con foco visible y con contraste AA.

---

## 9. Límites de la versión actual

- Los **conectores externos** (Square, banca PSD2, tienda online) y el cifrado de
  credenciales requieren un servidor; llegarán en una fase posterior. Mientras tanto todo
  se cubre con importación de ficheros (Excel/CSV/N43).
- La **facturación electrónica** verificable (registro encadenado) tiene la estructura de
  datos preparada, pero no se certifica ni se remite a la AEAT en esta versión.
- Es una app **de un solo usuario administrador**; los roles por tienda requieren servidor.
