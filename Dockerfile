# Imagen de la versión WEB de Gestor Laboral (para servidor/Umbrel).
# Construcción en dos fases: la primera compila (necesita las herramientas de
# desarrollo) y la segunda es la imagen final, que solo lleva Node, las tres
# dependencias de producción y los ficheros ya construidos. Así la imagen es
# más pequeña y no arrastra el resto de paquetes.

# ---- Fase 1: construcción ----
FROM node:20-bookworm-slim AS construccion

# Herramientas para compilar el módulo nativo better-sqlite3.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# No descargar el binario de Electron: la versión web no lo usa.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

COPY package*.json ./
# Instala sin ejecutar scripts (evita el rebuild para Electron) y compila
# better-sqlite3 para Node, que es quien ejecuta el servidor.
RUN npm install --ignore-scripts \
  && npm rebuild better-sqlite3

COPY . .
RUN npm run build:webapp

# Deja en node_modules solo las dependencias de producción (ya compiladas).
RUN npm prune --omit=dev

# ---- Fase 2: imagen final (solo lo necesario para ejecutar) ----
FROM node:20-bookworm-slim

WORKDIR /app

COPY --from=construccion /app/node_modules ./node_modules
COPY --from=construccion /app/dist-web ./dist-web
COPY --from=construccion /app/dist-server ./dist-server
COPY package.json ./

ENV NODE_ENV=production
ENV GESTOR_DATA_DIR=/datos
ENV PORT=3000
EXPOSE 3000
VOLUME ["/datos"]

CMD ["node", "dist-server/server/index.js"]
