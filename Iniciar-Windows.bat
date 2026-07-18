@echo off
REM Arranca el Gestor Laboral en Windows.
cd /d "%~dp0"
if not exist "node_modules" (
  echo Instalando dependencias por primera vez, espera unos minutos...
  call npm install
)
echo Iniciando Gestor Laboral...
call npm run dev
pause
