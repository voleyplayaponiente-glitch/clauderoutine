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
| GET | `/api/estado` | `{ "ok": true, "version": 2, "copias": true }` |
| GET | `/api/sync/<tipo>` | `{ "movimientos": [{ "externalId", "fecha", "concepto", "importe" }] }` |
| PUT | `/api/copias/<empresaId>` | guarda la copia del día → `{ "ok": true, "fecha", "bytes" }` |
| GET | `/api/copias` | `{ "empresas": [{ "empresaId", "copias", "ultima", "razonSocial", "cif" }] }` |
| GET | `/api/copias/<empresaId>` | `{ "copias": [{ "fecha", "bytes" }] }` |
| GET | `/api/copias/<empresaId>/<fecha>` | el backup completo (`ultima` vale como fecha) |

`"copias": true` en `/api/estado` es lo que mira la app para saber que el servicio
está actualizado; una versión antigua responde sin ese campo y la app lo dice.

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


## Copias de seguridad de la app (lo más importante)

La app guarda todo en el navegador. **El día que el navegador limpia los datos del sitio, se
pierde todo** — y la copia automática diaria no salva, porque vive en ese mismo navegador. Este
servicio guarda las copias en un disco que es tuyo.

### Cómo se monta

```bash
cp .env.example .env          # rellena SECRETO
mkdir -p datos                # aquí viven las copias (montado en /datos)
docker compose up -d --build
```

Variables:

| Variable | Para qué | Por defecto |
|---|---|---|
| `PUERTO_HOST` | Puerto por el que se accede desde fuera | `3001` |
| `COPIAS_DIR` | Carpeta donde se guardan | `/datos` |
| `COPIAS_RETENCION` | Cuántas copias se conservan por empresa | `30` |
| `COPIAS_MAX_BYTES` | Tope de una copia, para que nadie llene el disco | 50 MB |

Las copias quedan en `datos/copias/<empresa>/<AAAA-MM-DD>.json`: **texto plano y con checksum**,
así que se pueden abrir, copiar a otro disco o restaurar a mano sin depender de nada.

### Convivencia con lo que ya haya en el servidor

Este servicio **no toca nada de lo que ya esté montado**. Es un proyecto de Docker Compose
independiente, con su propia carpeta, su propia imagen y su propio volumen:

- No comparte volumen, red ni base de datos con ninguna otra aplicación.
- Si el puerto elegido ya está ocupado, Docker **se niega a arrancar** y lo dice; no se lo quita
  a nadie. En ese caso, se cambia `PUERTO_HOST` en el `.env` y listo.
- `docker compose down` en esta carpeta para **solo este** servicio. Nunca hace falta —y nunca
  se debe— usar `docker system prune` ni parar contenedores ajenos.

Antes de arrancarlo por primera vez conviene mirar qué hay y qué puertos están cogidos:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

### Cómo se conecta la app

En **Copias de seguridad → Copias en tu servidor**: la URL y el mismo `SECRETO`. Botón
«Probar conexión», y ya. Con «Subir sola tras cada cambio» sube la copia dos minutos después de
la última modificación.

**La URL tiene que ser HTTPS**, salvo que el servidor esté en tu red local (`umbrel.local`,
`192.168.x.x`, `127.0.0.1`): la app corre en HTTPS y el navegador bloquea el contenido mixto.
Para acceder desde fuera de casa: Tailscale, un túnel de Cloudflare o un proxy inverso con
certificado.

### Recuperar después de un desastre

1. Copias de seguridad → pon la URL y el secreto → **Ver copias del servidor**.
2. Elige la empresa **por su nombre**: tras limpiarse el navegador la app arranca con un
   identificador nuevo, y las copias están guardadas con el viejo. Por eso el servidor devuelve
   la razón social además del id.
3. Restaurar. Se verifica el checksum antes de sobrescribir nada.

### Lo que NO va en la copia

- **Los PDF de las facturas** (harían la copia enorme): se llevan con el ZIP mensual de Compras.
- **Los secretos** (tokens de conectores y el propio secreto del servidor): se redactan antes de
  construir la copia. Guardar la llave dentro de la caja no protege de nada.
