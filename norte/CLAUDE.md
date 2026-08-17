# CLAUDE.md — Norte (control presupuestario personal)

Memoria del proyecto. Léelo al empezar cualquier sesión que toque `norte/`.

## Qué es
Aplicación web **en español** de **control presupuestario personal y compartido**,
pensada además para **venderse a terceros** (autoalojada, SaaS o App Store).
Lee documentos bancarios y **nóminas**. Estética Apple, claro y oscuro reales.

- **Plan completo y decisiones de producto:** `../PLAN_NORTE.md`
- **Encargo original del usuario:** prompt «Núcleo» (se renombró a **Norte**).
- **Repo:** voleyplayaponiente-glitch/clauderoutine · carpeta `norte/`
- **Rama de desarrollo:** `claude/app-control-presupuestario-f7omzh`
- **Convive con** la app de vóley (raíz) y `finanzas/` (empresa). **No se tocan.**

## LA decisión de arquitectura, y por qué es distinta de `finanzas/`
`finanzas/` y el vóley son *client-first* con IndexedDB. **Norte no.** Guarda en
**PostgreSQL en el servidor**, y el navegador es solo una ventana.

No es un cambio de gusto: el 11/08/2026 se perdieron los datos de tres empresas
en `finanzas/` porque vivían en el navegador, y de ahí salió todo el aparato de
copias del Umbrel. El usuario lo pidió tal cual: *«para que no tengamos los
problemas de siempre con el borrado de datos»*. Si alguna vez se plantea meter
IndexedDB como almacén principal aquí, **no**: caché sí, verdad no.

Otras dos derivas del prompt original, decididas y justificadas:
- **Supabase → PostgreSQL propio**: se vende para autoalojar, no puede depender
  de la cuenta de nadie. Las RLS se sustituyen por el guardián de `acceso.ts`
  **con tests de fuga**, que además son comprobables sin proveedor.
- **Next.js → Vite + React**: no hay nada que renderizar en servidor (es una
  herramienta tras login) y el pipeline Vite → nginx → GHCR → tienda de Umbrel
  ya estaba montado y sufrido en este repo.

## Comandos
```bash
cd norte
npm install
npm run dev            # API en :3012 + interfaz en :5173 (Vite reenvía /api)
npm test               # motor (30) + API (24) = 54 tests
npm run test:dominio   # solo el motor, sin base de datos
npm run build          # dominio + api + app
npm run migrar         # prisma migrate dev
npm run semilla        # usuario demo@norte.local
```

## Arquitectura
- `dominio/` — **motor puro, sin React ni Prisma**. Aquí vive lo que se puede
  probar sin levantar nada: `dinero` (céntimos, `repartir`, `parsearImporte`),
  `roles`, `espacios` (**`decidirAcceso`**, `esCuentaVisiblePara`),
  `contrasenas`, `categorias-defecto`.
- `api/` — Fastify + Prisma. `acceso.ts` es **el guardián**: toda ruta que toca
  datos de un espacio pasa por `exigirEspacio`. `servidor.ts` se construye por
  inyección (prisma + configuración) para que los tests levanten la API entera
  contra otra base de datos.
- `app/` — React 19 + Vite + Tailwind v4. Solo pinta. TanStack Query para datos
  de servidor, Zustand **solo** para estado de interfaz (tema, espacio activo).

## Reglas que no se negocian
- **El dinero es un entero de céntimos.** `BigInt` en la base, `number` en el
  dominio con `comprobarCentimos`. Ni un `float`, tampoco «solo para mostrar».
- **Todo lo de un espacio lleva `espacioId`** y se filtra por el del **contexto**
  devuelto por `exigirEspacio`, nunca por el de la URL sin comprobar.
- **A quien no es miembro se le responde 404, no 403.** Un 403 confirmaría que
  el espacio existe. A un miembro con rol corto sí se le dice la verdad.
- **Nada se borra**: `borradoEn` y papelera de 30 días.
- **Nunca se guarda el IBAN completo ni el número de tarjeta.** Alias y últimos 4.
- Contraseñas con **Argon2id** (19 MiB / t=2 / p=1, mínimos de OWASP). Las
  sesiones se guardan como **HMAC del testigo**, no como el testigo.
- El mismo mensaje para «ese correo no existe» y «esa contraseña no es»; y un
  hash señuelo en el camino del correo inexistente para que los tiempos no
  delaten quién tiene cuenta.

## Cosas que ya costaron caras en este repositorio (no repetirlas)
- **nginx no conoce `.mjs` ni `.webmanifest`.** Sin forzar el tipo, el navegador
  se niega a ejecutar el worker de pdf.js y **no se puede leer ningún PDF**
  servido desde el Umbrel, aunque en GitHub Pages funcione. `nginx.conf` nace
  con las dos reglas. Verificado aquí **levantando nginx de verdad** y con el
  control negativo (quitando la regla sale `application/octet-stream`).
  `python3 -m http.server` sirve `.mjs` bien y por eso miente.
- **Entregar no es empujar**: después de cada push a la rama, comprobar que
  `imagen-norte.yml` acabó en verde antes de decirle al usuario que actualice.
  Publicar dos imágenes en cada despliegue disparó el límite secundario de
  GitHub en `finanzas/`; por eso `norte-api` solo se reconstruye si cambian
  `api/` o `dominio/`.
- **El `docker-compose.yml` lleva `name: norte` y no se quita.** Sin esa línea
  Compose deduce el nombre del proyecto de la carpeta (`umbrel`) y **choca con
  el proyecto del propio umbrelOS**: empieza a ver `auth` y `tor_proxy` como
  huérfanos suyos, y un `down --remove-orphans` ahí dentro se llevaría piezas
  del sistema del usuario. Salió en la primera instalación real (17/08/2026).
- **Las imágenes nuevas de GHCR nacen privadas** y `docker compose pull` falla
  con `denied`. Comprobado el 17/08/2026: `norte-web` salió pública pero
  `norte-api` **privada**. Hay que ponerlas públicas a mano una vez en
  Settings → Packages. Se verifica sin instalar nada pidiendo el manifiesto a
  `ghcr.io/v2/<usuario>/<imagen>/manifests/latest` con un token anónimo.
- **`npm --prefix <dir> exec` NO entra en la carpeta**: `prisma generate`
  buscaba el esquema en la raíz del monorepo y la imagen del servidor no se
  construía. Se usa `npm run -w <paquete>`, que sí entra.
- **Los tests de la API no arrancan sin `@norte/dominio` compilado ni sin
  `prisma generate`.** Lo tapaba tener el `dist/` de una sesión anterior; en un
  clon limpio se caían. Está resuelto en el `pretest` de `api`. Lección: antes
  de dar por bueno un CI, **clonar en limpio y correr la misma secuencia**.
- **Un «no se pudo leer» ante un fichero legible es una mentira por omisión.**
  Cuando llegue la fase 3, el buzón de documentos debe decir *qué* es el fichero
  y *adónde* va, nunca mandar a la pantalla equivocada ni callarse.
- **La PWA no avisa de que hay versión nueva** en `finanzas/`, y eso costó una
  tanda entera de mensajes. Aquí `registerType: 'prompt'` está puesto desde el
  principio; **falta cablear el aviso «hay una versión nueva, recarga»** en la
  interfaz (pendiente, ver abajo).

## Estado — fase 1 cerrada (54 tests en verde)
Hecho: monorepo, **esquema completo** (37 modelos: cuentas, movimientos,
documentos, nóminas, presupuestos, deudas, tarjetas, inversiones, repartos,
liquidaciones, patrimonio, licencias), migración inicial, registro/entrada con
Argon2id y cookie httpOnly, **aislamiento entre espacios con 13 tests de fuga**,
límite de intentos en la puerta, tokens de diseño (claro y oscuro diseñados por
separado), muestrario de componentes en `/#/muestra`, Dockerfiles, compose para
Umbrel y workflow de imágenes.

Verificado en navegador (Chromium, capturas en la conversación): registro real,
sesión que sobrevive a recargar, los dos temas, 375 px sin desbordamiento
horizontal y sin errores de consola.

## Por dónde seguir
1. **Fase 2 — Movimientos y cuentas**: CRUD, categorías, recurrentes y `Cmd+K`
   con lenguaje natural («café 3,40 ayer»).
2. Pendiente concreto heredado: **aviso de versión nueva de la PWA** (el
   `registerType: 'prompt'` ya está; falta el cartel y el botón de recargar).
3. La semilla debe crecer con cada fase hasta los **18 meses de histórico** que
   pide el encargo. Hoy solo crea usuario, espacios y categorías.
4. Cuando llegue la fase 3, pedirle al usuario **una nómina y un extracto suyos
   de verdad**: con ficheros inventados la lectura sale bonita en los tests y
   falla el primer día.

## Decisiones abiertas (no decidir por él)
- **Canal de venta**: recomendado empezar por autoalojada + web (0 % de
  comisión) y dejar la App Store (15–30 % + 99 $/año) para cuando la pida un
  cliente. Sin confirmar.
- **Puerto 3012** en su Umbrel: elegido por descarte (3000 laboral, 3011
  finanzas), **pendiente de comprobar con `ss -lntp`** en su máquina.
