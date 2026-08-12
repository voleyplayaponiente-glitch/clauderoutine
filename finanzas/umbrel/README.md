# La app en el Umbrel

Instala la aplicación **en tu propio servidor**, igual que la de gestión laboral,
en vez de usarla desde GitHub Pages.

## Por qué, más allá del gusto

- **Se acaba el problema del HTTPS.** Con la app en GitHub Pages (https) llamando a
  un servidor de casa (http), el navegador bloquea la petición por contenido mixto,
  y hacía falta Tailscale con certificados para sortearlo. Sirviéndola desde el
  Umbrel, la app y su servidor comparten dirección: no hay petición cruzada.
- **Funciona sin internet.** Si se cae la línea, el Umbrel y los dispositivos de
  casa se siguen viendo.
- **Las actualizaciones las decides tú**: se despliega una imagen nueva cuando
  quieras, no cuando se publique en Pages.

## Cómo está montado

Dos contenedores y **una sola puerta**:

```
   navegador  ─────►  finanzas_web (nginx, puerto 3011)
                          │
                          ├── /          → la aplicación compilada
                          └── /api/…     → finanzas_api (Node, copias)
```

El servicio de copias **no publica puerto**: solo se llega a él a través de nginx.
Una cosa menos expuesta en la red.

## Instalación

```bash
git clone --depth 1 -b claude/tournament-bracket-manager-gvrcdt \
  https://github.com/voleyplayaponiente-glitch/clauderoutine.git ~/finanzas-app
cd ~/finanzas-app/finanzas/umbrel
cp .env.example .env
```

Genera el secreto y mételo en el `.env`:

```bash
SECRETO=$(head -c 1000 /dev/urandom | LC_ALL=C tr -dc 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' | head -c 20 | sed 's/.\{5\}/&-/g; s/-$//')
sed -i "s|^SECRETO=.*|SECRETO=$SECRETO|" .env
echo "TU SECRETO: $SECRETO"
```

Y levántalo:

```bash
mkdir -p datos
sudo docker compose up -d
```

La app queda en **`http://umbrel.local:3011`** (o en la IP del Umbrel).

## Actualizar

```bash
cd ~/finanzas-app && git pull
cd finanzas/umbrel && sudo docker compose pull && sudo docker compose up -d
```

Las copias viven en `./datos`, fuera de los contenedores: actualizar **no las toca**.

## Configurar las copias dentro de la app

En **Copias de seguridad → Copias en tu servidor**:

- **URL del servidor**: la misma dirección de la app, `http://umbrel.local:3011`
- **Secreto**: el del `.env`

Al ser el mismo origen, «Probar conexión» funciona sin CORS ni certificados.

## Ojo: los datos son de cada navegador

Cambiar de `https://…github.io/clauderoutine/finanzas/` a `http://umbrel.local:3011`
es **cambiar de sitio** a ojos del navegador: el nuevo arranca vacío, porque
IndexedDB va por origen. Para llevarte lo que tuvieras:

1. En la app vieja: **Copias de seguridad → Descargar JSON**.
2. En la app del Umbrel: **Restaurar → Elegir backup**.

Y recuerda que los PDF de las facturas no viajan en ese JSON (se llevan con el
ZIP mensual de Compras).

## Las imágenes

Las publica el workflow `.github/workflows/imagen-finanzas.yml` en cada push a la
rama de publicación, después de pasar los tests:

- `ghcr.io/voleyplayaponiente-glitch/gestor-finanzas` — la aplicación
- `ghcr.io/voleyplayaponiente-glitch/gestor-finanzas-api` — el servicio de copias

La primera vez hay que marcarlas como **públicas** en GitHub (Packages → cada
paquete → Package settings → Change visibility), o el Umbrel no podrá bajarlas
sin credenciales.
