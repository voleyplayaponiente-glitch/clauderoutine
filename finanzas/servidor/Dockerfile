FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server.mjs ./
ENV PUERTO=3001
EXPOSE 3001
CMD ["node", "server.mjs"]
