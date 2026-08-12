# Imagen de la aplicación para servirla desde el Umbrel (como la de gestión
# laboral) en lugar de depender de GitHub Pages.
#
# Se compila con `base: './'` —sin GITHUB_PAGES— porque aquí la app cuelga de la
# raíz del servidor, no de /clauderoutine/finanzas/.
FROM node:20-alpine AS build
WORKDIR /app

# Primero las dependencias: así una compilación posterior sin cambios en
# package.json reaprovecha la capa y tarda segundos en vez de minutos.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
