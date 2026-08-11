FROM node:20-alpine
WORKDIR /app
COPY package.json ./
# Todos los módulos del servicio, no solo el arranque: `server.mjs` importa
# `copias.mjs`, y copiar únicamente el primero hacía que el contenedor muriera
# nada más levantarlo con «Cannot find module './copias.mjs'».
COPY *.mjs ./
ENV PUERTO=3001
# Aquí se montan las copias (volumen ./datos:/datos en docker-compose).
ENV COPIAS_DIR=/datos
EXPOSE 3001
CMD ["node", "server.mjs"]
