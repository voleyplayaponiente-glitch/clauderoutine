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

- `${APP_DATA_DIR}/postgres` — la base de datos. **Esto es lo que hay que
  respaldar.**
- `${APP_DATA_DIR}/documentos` — los PDF de nóminas y extractos subidos.

Los dos están fuera de los contenedores: actualizar la app no los toca.

Copia manual, en caliente:

```bash
sudo docker exec norte_db pg_dump -U norte norte | gzip > norte-$(date +%F).sql.gz
```

## Antes de tocar nada del Umbrel

Reglas que se siguieron con las otras dos apps y conviene mantener:

- Comprueba que el puerto está libre con `ss -lntp` (3000 lo tiene gestor
  laboral, 3011 gestión financiera).
- Proyecto de Compose aparte, nunca mezclado con otro.
- **Nunca** `docker system prune` ni parar contenedores ajenos: ahí conviven un
  nodo Bitcoin, LND, electrs, public-pool y Tor.
