#!/bin/bash
# Arranca el Gestor Laboral en macOS (doble clic).
cd "$(dirname "$0")" || exit 1
if [ ! -d node_modules ]; then
  echo "Instalando dependencias por primera vez, espera unos minutos..."
  npm install
fi
echo "Iniciando Gestor Laboral..."
npm run dev
