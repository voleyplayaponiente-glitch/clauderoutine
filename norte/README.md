# Norte — control presupuestario personal

Tu dinero, en una pantalla. **Tus datos, en tu servidor.**

Norte es una aplicación web de control presupuestario personal y compartido:
movimientos, presupuesto por sobres, deudas, tarjetas, inversiones y patrimonio
neto, con lectura de **extractos bancarios y nóminas** en PDF, Excel, CSV y N43.

> **Estado: fase 1 de 9 (cimientos).** Están el esquema de datos completo, las
> cuentas de usuario, el aislamiento entre espacios con sus tests y el sistema
> de diseño. El plan entero está en [`../PLAN_NORTE.md`](../PLAN_NORTE.md).

## Por qué no guarda en el navegador

Las otras dos apps de este repositorio son *client-first* con IndexedDB, y esa
decisión costó una pérdida de datos real. Norte guarda en **PostgreSQL, en tu
servidor**: limpiar el navegador, cambiar de móvil o entrar desde el PC deja de
significar nada. El navegador es una ventana, no un almacén.

## Cómo está montado

```
norte/
├── dominio/   Motor puro en TypeScript. Sin React, sin Prisma, sin efectos.
│              Dinero en céntimos, permisos, categorías. Todo con tests.
├── api/       Fastify + Prisma + PostgreSQL. Es quien decide quién ve qué.
└── app/       React 19 + Vite + Tailwind v4. Solo pinta.
```

La regla que sostiene el resto: **la lógica que se puede probar sin levantar
nada vive en `dominio/`**. Si una fórmula financiera necesita un servidor para
comprobarse, está en el sitio equivocado.

## Arrancar en local

Hace falta Node 22 y un PostgreSQL. Con Docker:

```bash
docker run -d --name norte-db -p 5432:5432 \
  -e POSTGRES_USER=norte -e POSTGRES_PASSWORD=norte -e POSTGRES_DB=norte \
  postgres:16-alpine
```

Después:

```bash
cd norte
npm install
cp api/.env.example api/.env      # y ajusta DATABASE_URL si hace falta
npm run migrar                    # crea las tablas
npm run semilla                   # usuario de demostración (opcional)
npm run dev                       # API en :3012 y la interfaz en :5173
```

Abre <http://localhost:5173>. En desarrollo Vite reenvía `/api` al servidor, así
que la app y su servidor comparten origen igual que en producción: **ni CORS ni
contenido mixto que ajustar**.

## Comandos

```bash
npm test                  # motor + API (los de la API necesitan PostgreSQL)
npm run test:dominio      # solo el motor: rápido, sin base de datos
npm run build             # dominio, servidor e interfaz
npm run migrar            # prisma migrate dev
```

Los tests de la API usan **otra base de datos** (`DATABASE_URL_TEST`) y lo
primero que hacen es vaciarla. Nunca apuntan a la de desarrollo, y si falta esa
variable se niegan a arrancar.

## En el Umbrel

Tres contenedores y una sola puerta: nginx sirve la app y pasa `/api` al
servidor; ni la API ni la base de datos publican puerto. Ver
[`umbrel/README.md`](umbrel/README.md).

## Decisiones que conviene no deshacer sin pensarlo

- **El dinero es siempre un entero de céntimos.** Ni un `float`, en ningún sitio.
- **Todo lo que es de un espacio lleva `espacioId`** y pasa por `acceso.ts`.
  El 404 a quien no es miembro (en vez de un 403) es deliberado: un 403 confirma
  que el espacio existe.
- **Las contraseñas van con Argon2id** y las sesiones se guardan como HMAC del
  testigo, no como el testigo.
- **`.mjs` y `.webmanifest` llevan su tipo forzado en `nginx.conf`.** nginx no
  los conoce, y en la app de empresa eso dejó sin lectura de PDF al Umbrel
  entero durante días.
