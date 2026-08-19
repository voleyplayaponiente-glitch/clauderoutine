# Norte en el Umbrel

Instala Norte en **tu propio servidor**, igual que la app de gestión laboral y
la de gestión financiera.

## Cómo está montado

Tres contenedores y **una sola puerta**:

```
   navegador ──►  norte_web (nginx, puerto 3012)
                      │
                      ├── /       → la aplicación compilada
                      └── /api/…  → norte_api (Fastify)
                                        │
                                        └── norte_db (PostgreSQL)
```

Ni la API ni la base de datos publican puerto: solo se llega a ellas desde
dentro. Que la app y su servidor compartan dirección no es estética — quita de
golpe el CORS, el contenido mixto y la necesidad de un túnel para usarla dentro
de casa.

## Antes de instalar: hacer públicas las dos imágenes

GitHub publica los paquetes nuevos **en privado** por defecto, y entonces
`docker compose pull` falla en el Umbrel con un `denied`. Hay que hacerlo una
sola vez, igual que con `gestor-finanzas`:

1. <https://github.com/voleyplayaponiente-glitch?tab=packages>
2. Entra en `norte-web` y en `norte-api` → *Package settings* → *Change
   visibility* → **Public**.

Comprobado el 17/08/2026: `norte-web` salió pública y **`norte-api` privada**.
Para verificarlo sin instalar nada:

```bash
docker pull ghcr.io/voleyplayaponiente-glitch/norte-api:latest
```

## Instalación

```bash
git clone --depth 1 -b claude/app-control-presupuestario-f7omzh \
  https://github.com/voleyplayaponiente-glitch/clauderoutine.git ~/norte-app
cd ~/norte-app/norte/umbrel
cp .env.example .env
```

Genera los dos secretos y mételos en el `.env`:

```bash
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -base64 36 | tr -d '/+=' | head -c 32)|" .env
sed -i "s|^NORTE_SECRETO_SESION=.*|NORTE_SECRETO_SESION=$(openssl rand -base64 48 | tr -d '/+=' | head -c 44)|" .env
```

Y levántalo:

```bash
sudo docker compose up -d
```

Norte queda en **`http://umbrel.local:3012`** (o en la IP del Umbrel). La
primera cuenta que se registre es la tuya.

## Actualizar

```bash
cd ~/norte-app && git pull
cd norte/umbrel && sudo docker compose pull && sudo docker compose up -d
```

Las migraciones de la base de datos se aplican solas al arrancar el contenedor
de la API. Si una migración falla, **el contenedor no arranca**: es preferible a
servir con un esquema a medias.

## Dónde viven los datos

- `${APP_DATA_DIR}/postgres` — la base de datos.
- `${APP_DATA_DIR}/documentos` — los PDF de nóminas y extractos subidos.
- `${APP_DATA_DIR}/copias` — las copias de seguridad ya hechas.
- `/media/<tu disco>/norte-copias` — la segunda copia, en el disco externo.

Los tres están fuera de los contenedores: actualizar la app no los toca.

## Copias de seguridad

Se hacen **solas**, sin cron del sistema ni nada que recordar: un cuarto
contenedor (`norte_copias`) hace una copia al día a las 04:30 y la comprueba
antes de darla por buena.

Cada copia son dos ficheros con el mismo sello de tiempo:

```
norte-2026-08-19-0430.dump                 la base de datos (formato -Fc)
norte-2026-08-19-0430-documentos.tar.gz    los extractos y nóminas subidos
```

Se guardan las **7 últimas diarias** y la más reciente de cada uno de los
**12 últimos meses**; el resto se borra solo.

El estado se ve **desde la propia app**, en la pantalla de inicio: si el
servicio se para o una copia falla, ahí lo dice, y hay un botón para hacer una
copia en el momento. Es a propósito: una copia que falla en silencio es peor
que no tener copias, porque da la tranquilidad sin dar el respaldo.

Para verlo desde el terminal:

```bash
sudo docker logs --tail 20 norte_copias
cat ~/norte-datos/copias/estado.json
```

### El disco externo

Una copia que vive en la misma máquina que el original no protege de que se
estropee esa máquina. Norte se lleva las copias a un disco conectado al Umbrel,
también solo, **pero hay que decirle a cuál**:

1. Conecta el disco al Umbrel y móntalo bajo `/media`:

   ```bash
   lsblk                                   # busca tu disco, p. ej. sda1
   sudo mkdir -p /media/copias
   sudo mount /dev/sda1 /media/copias
   ```

   Para que sobreviva a un reinicio, añádelo a `/etc/fstab` con su UUID
   (`sudo blkid /dev/sda1`).

2. **Crea en el disco una carpeta llamada `norte-copias`:**

   ```bash
   sudo mkdir -p /media/copias/norte-copias
   ```

3. Reinicia Norte (desde el Umbrel, o `sudo docker compose restart copias`).

Ese paso 2 no es burocracia. Es lo único que distingue «el disco está
conectado» de «el disco no está y Docker me ha dejado un directorio vacío con
el mismo nombre»; sin la marca, el servicio escribiría gigabytes en el disco de
sistema del Umbrel creyendo que los manda fuera. Y de paso funciona como
permiso: Norte solo escribe en discos que tú has marcado.

Una vez hecho, cada copia nueva sale al disco en cuanto se crea, y si el disco
estaba desconectado, las pendientes salen solas la siguiente hora. **Del disco
externo no se borra nada nunca**: la rotación es cosa del Umbrel, y el archivo
de fuera es de solo añadir para que ningún fallo de aquí pueda vaciarlo.

El estado se ve en la pantalla de inicio de la app, junto al de las copias: si
el disco lleva días sin aparecer, lo dice.

Un aviso de fontanería: un *bind mount* **no ve** los discos que se monten
después de arrancar el contenedor. Si conectas el disco con Norte ya en marcha,
reinicia la app para que lo vea.

Y si prefieres llevártelas a otra máquina en vez de a un disco:

```bash
rsync -av umbrel@umbrel.local:~/norte-datos/copias/ ~/copias-norte/
```

### Restaurar

Con Norte parado, para que nadie escriba mientras se restaura:

```bash
cd ~/norte-app/norte/umbrel
sudo docker compose stop web api copias

# La base de datos, sobre una vacía
sudo docker compose exec -T db dropdb -U norte --if-exists norte
sudo docker compose exec -T db createdb -U norte norte
sudo docker compose exec -T db pg_restore -U norte -d norte --no-owner \
  < ~/norte-datos/copias/norte-2026-08-19-0430.dump

# Los documentos
tar -xzf ~/norte-datos/copias/norte-2026-08-19-0430-documentos.tar.gz \
  -C ~/norte-datos/documentos

sudo docker compose start api web copias
```

Comprobado de punta a punta: volcado de una base con datos reales de la app,
restaurado en una base limpia y verificado que vuelven las mismas filas.

Si quieres mirar dentro de una copia sin restaurarla:

```bash
sudo docker compose exec -T db pg_restore --list < ~/norte-datos/copias/norte-….dump
```

## Antes de tocar nada del Umbrel

Reglas que se siguieron con las otras dos apps y conviene mantener:

- Comprueba que el puerto está libre con `ss -lntp` (3000 lo tiene gestor
  laboral, 3011 gestión financiera).
- Proyecto de Compose aparte, nunca mezclado con otro.
- **Nunca** `docker system prune` ni parar contenedores ajenos: ahí conviven un
  nodo Bitcoin, LND, electrs, public-pool y Tor.
