# Imagen de la versión WEB de Gestor Laboral (para servidor/Umbrel).
FROM node:20-bookworm-slim

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

ENV NODE_ENV=production
ENV GESTOR_DATA_DIR=/datos
ENV PORT=3000
EXPOSE 3000
VOLUME ["/datos"]

CMD ["node", "dist-server/server/index.js"]
