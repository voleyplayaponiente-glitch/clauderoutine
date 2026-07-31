# Servicio de conectores (Umbrel)

Microservicio que hace de puente entre la app de Gestión Financiera y los
servicios externos (Square, banco, pasarelas). **Guarda las credenciales de los
terceros en el servidor** (variables de entorno), de modo que el navegador nunca
las ve. Cumple el requisito del proyecto: *credenciales cifradas en reposo, nunca
en el código ni en el repositorio*.

Sin dependencias: solo Node ≥ 18 (usa `http` y `fetch` nativos).

## Contrato

La app llama con `Authorization: Bearer <SECRETO>`:

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/estado` | `{ "ok": true }` |
| GET | `/api/sync/<tipo>` | `{ "movimientos": [{ "externalId", "fecha", "concepto", "importe" }] }` |

`<tipo>` en minúsculas: `square`, `demo` (y los que añadas: `banco_psd2`, `stripe`…).

## Puesta en marcha

### Opción A — Docker (recomendada en Umbrel)
```bash
cd servidor
cp .env.example .env      # y rellena SECRETO, ORIGEN_PERMITIDO y SQUARE_TOKEN
docker compose up -d
```

### Opción B — Node directo
```bash
cd servidor
cp .env.example .env      # rellena los valores
node --env-file=.env server.mjs
```

Comprobar que vive:
```bash
curl -H "Authorization: Bearer TU_SECRETO" http://localhost:3001/api/estado
# -> {"ok":true,...}
```

## Configuración (.env)

- **`SECRETO`**: cadena larga y aleatoria (`openssl rand -hex 32`). El **mismo** valor
  que pondrás en la app, en el conector, modo *Servidor*.
- **`ORIGEN_PERMITIDO`**: la URL exacta de tu app (CORS). Para GitHub Pages:
  `https://voleyplayaponiente-glitch.github.io`.
- **`SQUARE_TOKEN`**: token de acceso de Square (Dashboard de Square → Credenciales).
  `SQUARE_ENV=production` o `sandbox`.

## Conectar desde la app

1. En el Umbrel, expón este servicio en una URL accesible desde tu móvil/ordenador
   (túnel del Umbrel, Tailscale, o reverse proxy con HTTPS). **Debe ser HTTPS** si la
   app se sirve por HTTPS (GitHub Pages lo es).
2. En la app: **Configuración → Conexiones → + Conector**, elige **Square**, modo
   **Servidor propio (Umbrel)**, e introduce la **URL** del servicio y el **secreto**.
3. Pulsa **Probar** y luego **Sincronizar**. Verás la previsualización antes de aplicar;
   reimportar no duplica (idempotencia por `externalId`).

## Añadir más conectores

En `server.mjs`, añade una función adaptadora que devuelva el mismo formato de salida
y regístrala en `ADAPTADORES` con su clave (`banco_psd2`, `stripe`, `shopify`…). La app
ya sabe consumirla; no hay que tocar el núcleo.

> Nota: el fallo de un conector nunca bloquea la app; los errores se devuelven con su
> código y la app los muestra en el registro de sincronizaciones.
