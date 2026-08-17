# Plan — «Norte», control presupuestario personal

Respuesta al punto 0 del prompt (`promptappfinanzas.md`): stack, modelo de datos, fases y
plan de diseño. **Nada de código hasta tu visto bueno.**

---

## 0. Las tres decisiones que cambian todo (y por qué las tomo así)

Tu encargo trae tres exigencias que el prompt original no contemplaba juntas: **subir
documentos bancarios y nóminas**, **vendérsela a terceros** y **que viva en el Umbrel para
no volver a perder datos**. Cada una empuja la arquitectura en una dirección, y hay que
elegir antes de teclear.

### D1 · Los datos dejan de vivir en el navegador. Servidor con base de datos real.

La app de empresa (`finanzas/`) es *client-first* con IndexedDB. Fue la decisión correcta
entonces y **ha costado dos sustos y una tarde entera de trabajo**: el 11/08 se perdieron
los datos de las tres empresas, y de ahí salió todo el aparato de copias en el Umbrel,
la alerta de «Sin copia fuera de este navegador» y el rescate por nombre de empresa.

Tú lo has dicho en una línea: *«para que no tengamos los problemas de siempre con el
borrado de datos»*. La respuesta no es otra capa de copias sobre IndexedDB: es que el
navegador **deje de ser el sitio donde viven los datos**.

> **Norte guarda en PostgreSQL, en el Umbrel. El navegador es una ventana, no un almacén.**
> Limpiar el navegador, cambiar de móvil o entrar desde el PC ya no significa nada.

Efecto colateral que además hacía falta: los PDF de las nóminas y los extractos se guardan
en disco del servidor, no en el dispositivo. En la app de empresa **los PDF archivados no
entran en el JSON de copia** — una limitación conocida que aquí desaparece.

### D2 · Servidor propio, no Supabase.

El prompt pide Next.js 15 + Supabase + Drizzle + RLS. **Cambio Supabase por Postgres en tu
Umbrel** por dos razones que pesan más que la comodidad: (a) una app que se vende para
autoalojarse no puede depender de la cuenta de Supabase de nadie, y (b) tú quieres tus
datos en tu casa, que es de donde viene todo este encargo. Mantengo la *idea* de RLS —
aislamiento por espacio comprobado con tests — pero implementado en el servidor, donde
puedo probarlo de verdad.

También cambio **Next.js por Vite + React**: no hay nada en esta app que necesite render
en servidor (es una herramienta privada tras login, no una web que deba posicionar), y en
cambio el pipeline Vite → nginx → imagen GHCR → tienda de Umbrel **ya está montado, sufrido
y funcionando** en este repo. Reaprovecharlo nos ahorra la fase entera de despliegue.

### D3 · Multi-usuario desde el primer día, porque se va a vender.

La app de empresa tiene «un solo administrador» escrito en su arquitectura. Norte nace con
`usuarios`, `espacios` y `roles` reales, porque un producto que se vende necesita que dos
clientes distintos no se vean, y porque el propio prompt pide modo pareja y modo negocio.

### Deriva del brief, decidida y explicada en una línea cada una

| Punto del prompt | Qué hago | Por qué |
|---|---|---|
| Next.js 15 | Vite + React 19 | No hay necesidad de SSR y el pipeline de despliegue ya existe. |
| Supabase | Postgres propio en Docker | Se vende para autoalojar; tus datos en tu casa. |
| RLS de Postgres | Aislamiento en servidor + tests de fuga | Comprobable en Vitest, sin atarse a un proveedor. |
| Drizzle | Prisma | Migraciones versionadas; ya elegido y justificado en `PLAN_APP_FINANCIERA.md`. |
| Nombre «Núcleo» | **Norte** | La promesa no es el núcleo del dato, es saber hacia dónde vas; y el mark (aguja) es mejor icono. |

---

## 1. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | React 19 + TypeScript estricto + Vite | Build estático, arranque instantáneo, ya validado aquí. |
| Estilos | Tailwind v4 + tokens propios | Modo claro y oscuro **diseñados los dos**, no uno derivado. |
| Estado servidor | TanStack Query | Mutaciones optimistas → la UI responde al instante (principio 4). |
| Estado UI | Zustand | Solo UI: espacio activo, paleta de comandos, filtros. |
| Gráficos | Recharts envuelto en componentes propios | Ningún estilo por defecto de la librería llega a pantalla. |
| Animación | Motion | Curvas de resorte; respeta `prefers-reduced-motion`. |
| Backend | Node 22 + Fastify + TypeScript | Validación por esquema nativa; huella pequeña para el Umbrel. |
| BD | **PostgreSQL 16** | `numeric` exacto, transacciones, constraints. Un contenedor más, ya lo tienes en casa. |
| ORM | Prisma | Migraciones versionadas y tipado extremo a extremo. |
| Dinero | **Enteros en céntimos**, `bigint` en BD | Nunca `float`. Ni una sola vez. |
| Auth | Cookie httpOnly + Argon2id + TOTP opcional | Estándar actual; sin tokens en `localStorage`. |
| Ingesta | pdf.js + SheetJS + PapaParse + parser N43 propio + OCR Tesseract (`spa`) | Los formatos españoles reales que ya sabemos leer. |
| Ficheros | Disco del servidor (`APP_DATA_DIR`) + checksum | Fuera de los contenedores: actualizar no los toca. |
| Tests | Vitest (dominio y API) + Playwright (flujos críticos) | Cada fórmula del §5 con su test, sin excepción. |
| Empaquetado | Docker Compose (web + api + postgres) | Una app más en tu tienda de Umbrel. |

**Regla transversal, la misma que funcionó dos veces ya:** toda la lógica de cálculo vive en
`dominio/`, TypeScript puro, sin React y sin Prisma. Testeable en aislamiento.

---

## 2. Modelo de datos

Todas las tablas llevan `espacio_id`, `creado_en`, `actualizado_en` y borrado lógico
(`borrado_en`) con 30 días de papelera. Importes en céntimos (`bigint`).

**Núcleo**
- `usuarios` — email, hash Argon2id, divisa base, zona horaria, TOTP, preferencias.
- `espacios` — `personal` | `pareja` | `negocio`. Un usuario pertenece a varios.
- `miembros_espacio` — rol (`propietario` | `editor` | `lector`), % de participación, alta.
- `sesiones`, `invitaciones` (enlace con caducidad), `registro_actividad` (quién tocó qué).

**Cuentas y movimientos**
- `cuentas` — tipo `corriente`|`ahorro`|`efectivo`|`tarjeta_credito`|`inversion`|`prestamo`|`activo_no_liquido`; saldo, divisa, si computa en patrimonio, si es visible en el espacio compartido.
- `movimientos` — importe, fecha, cuenta, categoría, comercio, notas, etiquetas, `es_compartido`, `reparto_id`, `documento_id`, `id_externo` (idempotencia al importar).
- `reglas_recurrentes` — periodicidad (semanal…anual, día concreto, último día hábil) → generan movimientos **previstos** que se confirman o ajustan.
- `categorias` — jerárquicas, tipo `fijo`|`variable`|`discrecional`, flag de esencialidad. Set inicial en español y realista para España.
- `reglas_categorizacion` — «si el comercio contiene X → categoría Y», aprendidas del uso.

**Documentos (tu requisito central)**
- `documentos` — fichero original en disco, tipo detectado, hash (anti-duplicado), estado de proceso, quién lo subió, y **de qué movimientos es origen**.
- `extracciones` — lo que se leyó de cada documento, campo a campo, con su confianza. Nada entra en las cuentas sin que lo confirmes en una pantalla de revisión.

**Ingresos**
- `fuentes_ingreso` — `nomina`|`autonomo`|`alquiler`|`dividendos`|`intereses`|`negocio`|`otros`; bruto, retención, neto, periodicidad, variabilidad, histórico de 12 meses.
  **El presupuesto se planifica sobre el percentil 25, no sobre la media**, y la UI lo explica.
- `nominas` — el desglose leído del PDF: bruto, cotizaciones, IRPF, neto, atrasos, pagas extra.

**Presupuesto** · `presupuestos` (método `base_cero`|`50-30-20`|`sobres`, `rollover` por categoría) · `periodos_presupuesto` (cierre mensual, real vs. previsto).

**Deudas** · `deudas` (hipoteca, personal, auto, estudios, familiar, revolving; TIN, TAE, sistema francés/alemán/americano, fijo/variable con diferencial sobre Euríbor, comisión de amortización anticipada) · `cuadro_amortizacion` · `amortizaciones_extra` (reducir cuota **o** reducir plazo, con el interés ahorrado de cada opción).

**Tarjetas** · `tarjetas` (límite, corte, pago, `pago_total`|`revolving`, TIN, mínimo % y suelo). Estado calculado: ciclo actual, ciclo cerrado pendiente, **días de financiación gratis restantes**, utilización.

**Inversiones** · `cuentas_inversion` · `posiciones` (ISIN/ticker, clase, región, participaciones, coste medio) · `movimientos_inversion` (con fecha, de aquí sale la TIR) · `objetivos_asignacion` (umbral ±5 pp).

**Compartido** · `repartos` (`50/50`|`proporcional_ingresos`|`porcentaje_manual`|`importe_fijo`) · `liquidaciones` (con minimización de transferencias) · `movimientos_capital` (solo negocio).

**Patrimonio** · `fotos_patrimonio` — foto mensual automática de activos, pasivos y neto. Alimenta el gráfico firma.

**Venta** · `licencias` — clave, plan, estado, dispositivos activos, caducidad. Ver §5.

---

## 3. Subir documentos: cómo funciona de verdad

Es lo que más se rompe y donde ya tenemos cicatrices, así que va con reglas explícitas:

1. **Un solo buzón.** Arrastras cualquier cosa a un único sitio. Nada de «esto va en Bancos
   y aquello en Deudas»: en la app de empresa eso confundió al usuario **dos veces**, y un
   «no se pudo leer» ante un fichero legible es una mentira por omisión.
2. **El servidor reconoce el documento** y te dice qué es y qué va a hacer con él: extracto
   bancario (N43, Excel, CSV, PDF), **nómina**, recibo, cuadro de préstamo, factura, informe
   de bróker. Si no lo reconoce, lo dice claro y te deja mapearlo a mano — no lo manda a la
   pantalla equivocada.
3. **Nada se aplica sin revisión.** Pantalla de previsualización: esto he leído, esto voy a
   crear, estos 3 movimientos ya los tenías (duplicados detectados por hash e `id_externo`).
4. **Nunca se guarda el IBAN completo ni el número de tarjeta.** Alias y últimos 4 dígitos,
   como pide el §7 del prompt. El PDF original sí se guarda, cifrado en reposo.
5. Todo el proceso corre **en el servidor**: el móvil sube el fichero y ya. Esto además
   arregla de raíz el problema de los `.mjs` del `pdf.worker` que dejó sin lectura de PDF
   al Umbrel entero.

---

## 4. Cómo se vende (tu segundo requisito)

Tres canales, **un solo código base**. Esto condiciona el diseño desde el día uno, por eso
va en el plan y no al final.

| Canal | Qué es | Coste / comisión | Cuándo |
|---|---|---|---|
| **Autoalojada** (Umbrel/Docker) | El cliente instala su instancia. Licencia de pago único o anual. | 0 % de comisión. | Fase 1 — es lo tuyo, y lo primero. |
| **Alojada por ti** (SaaS) | Tú corres una instancia multiinquilino y cobras suscripción. | Pasarela (Stripe ~1,5 % + 0,25 €). | Fase 8. El modelo ya es multi-espacio, no hay que reescribir. |
| **App Store / Google Play** | Envoltorio nativo con **Capacitor** sobre la misma app. | **Apple: 15 % (primer millón) o 30 %**, + 99 $/año de programa de desarrollador, y obliga a usar su compra integrada para lo digital. | Fase 9, y solo si compensa. |

**Te lo digo sin suavizarlo, que es el principio 3 de tu prompt:** la App Store es el canal
más caro y el más lento (revisión, requisitos de cuenta, borrado de cuenta obligatorio,
ficha de privacidad). Para una app de finanzas personales vendida a conocidos y por web, la
venta directa con licencia deja bastante más margen. Recomiendo **empezar por autoalojada +
web**, y llevar la App Store cuando haya clientes que la pidan. La decisión de arquitectura
que tomo hoy (PWA instalable, sin nada específico de navegador) mantiene esa puerta abierta
sin coste: envolverla con Capacitor luego son días, no meses.

**Licenciamiento** (fase 1, sencillo y honesto): clave firmada (Ed25519) que valida el
servidor sin llamar a casa; sin conexión sigue funcionando. Sin licencia válida la app entra
en **modo solo lectura** — nunca borra ni secuestra los datos del cliente. Exportación
completa a JSON y CSV a un clic, siempre: los datos son suyos.

---

## 5. Lógica financiera

Se implementa **exactamente** como el §5 de tu prompt, en `dominio/`, con test cada una:
patrimonio neto, cuota francesa, TAE desde TIN, coste medio ponderado de la deuda, **XIRR
por Newton-Raphson con respaldo de bisección que devuelve `null` si no converge** (no se
inventa un número), TWR encadenado, reparto proporcional a ingresos, liquidación neta con
minimización de transferencias, proyección de caja a 30 días y **coste real del pago mínimo
en revolving** (meses e intereses, en pantalla y sin adornos).

Los 6 KPIs de salud financiera con sus umbrales y su semáforo, cada uno con la explicación
del umbral accesible desde la propia UI.

---

## 6. Diseño

**Tokens de color** (justificados, no decorativos):

| Token | Oscuro | Claro | Por qué |
|---|---|---|---|
| Fondo | `#0B0E13` | `#F7F8FA` | Casi negro con matiz azulado frío; no negro puro (aplana el OLED y quema el contraste). |
| Superficie 1 / 2 / 3 | `#12161D` · `#171C25` · `#1D232E` | `#FFFFFF` · `#F1F3F6` · `#E8EBF0` | Incrementos de luminosidad del 4–6 %. **Elevación por luz, jamás por borde blanco al 20 %.** |
| Texto 1 / 2 / 3 | `#F2F4F7` · `#A3ACBB` · `#6B7484` | `#0B0E13` · `#4A5361` · `#79828F` | Tres niveles bastan. AA garantizado en los tres. |
| Positivo | `#32D583` | `#12805B` | Único acento de lo positivo. |
| Negativo | `#FF5B52` | `#C4302B` | Único acento de lo negativo. |
| Marca | `#0A84FF` → `#6FD6FF` | igual | Reservado a la identidad y a la selección. **El color del dato no compite con el de la marca.** |

Nada más. Los adornos son grises; el color se reserva para el dato.

**Tipografía**: `-apple-system` / SF Pro con **Inter** de respaldo. **Todas las cifras** con
`font-variant-numeric: tabular-nums` — los números no bailan al actualizarse. Cifras héroe
con tracking negativo. Escala de tipo definida y respetada.

**Layout**: rejilla de 8 pt sin excepciones. Bento en el dashboard, sin scroll a 1440×900.
Radios coherentes y proporcionales al contenedor. Sombras en dos capas (contacto + ambiental).
`backdrop-blur` **solo** en barras fijas y modales, nunca en tarjetas de contenido.

**Movimiento**: resorte, 200–350 ms, las cifras importantes cuentan hasta su valor. Cambiar
de espacio anima el contenido, no la pantalla.

**Elemento firma**: el gráfico de patrimonio neto. Histórico en línea sólida, proyección en
trazo diferenciado, hitos marcados (deuda liquidada, cambio de trabajo), lectura al pasar el
cursor con el desglose activos/pasivos de ese mes. Dibujado a mano en SVG, no una plantilla
de Recharts.

**Suelo de calidad**: responsive real hasta 375 px, foco de teclado visible, contraste AA,
estados vacíos que invitan a actuar, *skeletons* (nunca spinners), y errores que dicen qué
pasó y cómo se arregla. Copy en español de España, tuteando: «Te quedan 340 € este mes».

---

## 7. Fases

Al terminar cada una: parada, te lo enseño funcionando, y no sigo sin tu confirmación.

| # | Fase | Entrega |
|---|---|---|
| 1 | **Cimientos** | Proyecto, Postgres, esquema completo, auth, aislamiento por espacio con tests de fuga, tokens de diseño y página de muestra de componentes. **Y la app ya instalable en tu Umbrel** — el despliegue no se deja para el final, que es cuando duele. |
| 2 | **Movimientos y cuentas** | CRUD, categorías, recurrentes, `Cmd+K` con lenguaje natural («café 3,40 ayer»). |
| 3 | **Documentos** | Buzón único, lectura de extractos y **nóminas**, revisión antes de aplicar, detección de duplicados. |
| 4 | **Presupuesto** | Sobres, arrastre, ritmo diario, cierre mensual con propuesta del mes siguiente. |
| 5 | **Deudas y tarjetas** | Cuadros, simulador de amortización, avalancha vs. bola de nieve, ciclos de tarjeta, coste real del revolving. Batería completa de tests de fórmulas. |
| 6 | **Inversiones** | Cartera, TWR y TIR, asignación objetivo y aviso de rebalanceo. |
| 7 | **Dashboard** | Bento completo, proyección a 30 días con el día de mínimo saldo, y el gráfico firma. |
| 8 | **Espacios compartidos** | Invitaciones, repartos, liquidaciones, modo negocio. |
| 9 | **Venta y pulido** | Licencias, informes PDF, accesibilidad, rendimiento. Capacitor si decides ir a la App Store. |

**Datos semilla**: 18 meses de histórico realista de un perfil español — nómina de 2.400 €
netos, facturación variable de autónomo, hipoteca, préstamo de coche, dos tarjetas (una en
pago total y otra en revolving), cartera indexada con aportaciones mensuales y un espacio de
pareja con gastos comunes. Sin datos convincentes no puedes juzgar el diseño.

---

## 8. Dónde vive y cómo llega a tu Umbrel

- Carpeta nueva `norte/` en este mismo repo, **sin tocar** el vóley ni `finanzas/`.
- Tres contenedores: `norte-web` (nginx con la app), `norte-api` (Fastify), `norte-db`
  (Postgres). Una sola puerta: nginx sirve `/` y pasa `/api` al backend; ni la API ni la BD
  publican puerto.
- Puerto **3012** (libres comprobados: 3000 laboral · 3011 finanzas · 3001/3002/3006/3063 lo
  demás). Se verifica con `ss -lntp` antes.
- Workflow `imagen-norte.yml` publica las imágenes en GHCR tras pasar los tests, y app nueva
  en tu tienda `bespain-umbrel-store`. **Después de cada push compruebo que el workflow
  quedó en verde antes de decirte que actualices** — entregar no es empujar.
- `nginx.conf` nace ya con el arreglo de `.mjs` y `.webmanifest`, y con la verificación
  contra nginx de verdad, no contra `python3 -m http.server`.
- Datos y ficheros en `${APP_DATA_DIR}`, fuera de los contenedores: actualizar no los toca.
  Copia nocturna de Postgres (`pg_dump`) con retención, más descarga manual a un clic.
- **No se toca nada de tu Umbrel**: proyecto de Compose aparte, nunca `docker system prune`,
  nunca parar contenedores ajenos.

---

## 9. Riesgos, dichos a tiempo

1. **Es una app más grande que las dos anteriores juntas.** Nueve fases. Si quieres algo
   utilizable pronto, las fases 1–4 ya son un control presupuestario completo con lectura de
   nóminas y extractos; de la 5 en adelante es profundidad.
2. **Postgres es un contenedor más que mantener.** Vale la pena porque es exactamente lo que
   arregla el problema del borrado de datos, pero no lo escondo.
3. **Vender software financiero a terceros trae obligaciones**: RGPD (eres responsable del
   tratamiento si tú alojas; encargado si se autoaloja), aviso legal, condiciones de uso y
   política de privacidad. En la fase 9 los redacto. **No** somos entidad de pago ni damos
   asesoramiento de inversión, y la app lo dirá donde toque.
4. **La lectura de nóminas es la parte con más incertidumbre**: cada empresa las maqueta a su
   manera. Empezaré por las tuyas reales, y el diseño acepta corrección manual siempre.

---

## 10. Lo que necesito de ti para arrancar

Solo el visto bueno. Y cuando lleguemos a la fase 3, **una nómina y un extracto tuyos de
verdad** — con ficheros inventados la lectura sale bonita en los tests y falla el primer día.
