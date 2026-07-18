# Instalar Gestor Laboral (versión web) en tu servidor Umbrel

Esta guía deja la aplicación funcionando **en tu Umbrel**, accesible desde el navegador
de cualquier dispositivo de tu red (PC, portátil, móvil, tablet), protegida con contraseña.

> ⚠️ **Importante (RGPD):** al ser accesible por la red, **pon una contraseña fuerte** y
> úsala solo dentro de tu red local. Los datos siguen guardándose en tu propio servidor,
> nunca en la nube.

Umbrel no tiene un botón de "instalar" para apps propias, así que se hace con **Docker**.
Parece técnico, pero son pocos pasos. Si te atascas, dímelo y te guío en el momento.

---

## Lo que necesitas
- Tu servidor **Umbrel** encendido y en la misma red.
- La **carpeta de la aplicación** (esta) copiada dentro de Umbrel. Ya la tienes en tu
  Umbrel, en *Files → APP LABORAL*. Si no, cópiala ahí con la app **Files**.

---

## Opción recomendada: por terminal (SSH)

### 1. Activa el acceso SSH en Umbrel
En Umbrel: **Settings (Ajustes) → Advanced settings → SSH** y actívalo. Apunta el usuario
(`umbrel`) y la contraseña que te muestra.

### 2. Conéctate desde tu PC
- **Windows:** abre **PowerShell** (botón inicio → escribe "PowerShell").
- **Mac:** abre **Terminal**.

Escribe (y pulsa Enter):
```bash
ssh umbrel@umbrel.local
```
Acepta con `yes` la primera vez e introduce la contraseña.

### 3. Entra en la carpeta de la aplicación
La carpeta que copiaste en *Files* suele estar bajo `~/umbrel/data/storage/`. Por ejemplo:
```bash
cd ~/umbrel/data/storage/APP\ LABORAL/clauderoutine-claude-labor-management-scheduling-app-jd2hcj
```
> Truco: escribe `cd ` y ve pulsando **Tab** para autocompletar los nombres largos.
> Con `ls` ves el contenido; debes ver `docker-compose.yml` y `Dockerfile`.

### 4. Pon tu contraseña
Edita el fichero `docker-compose.yml` y cambia `cambia-esta-contrasena` por la tuya:
```bash
nano docker-compose.yml
```
Cambia la línea `GESTOR_PASSWORD=cambia-esta-contrasena`, guarda con **Ctrl+O → Enter** y
sal con **Ctrl+X**.

### 5. Arranca la aplicación
```bash
docker compose up -d --build
```
La primera vez tarda unos minutos (construye la imagen). Cuando termine, ya está corriendo
y se reiniciará sola si apagas y enciendes el Umbrel.

### 6. Ábrela en el navegador
Desde cualquier dispositivo de tu red:
```
http://umbrel.local:3000
```
(o `http://LA-IP-DE-TU-UMBREL:3000`). Introduce la contraseña y a trabajar.

---

## Comandos útiles (para después)
Dentro de la carpeta de la app:
```bash
docker compose logs -f       # ver qué está pasando (Ctrl+C para salir)
docker compose restart       # reiniciar
docker compose down          # detener
docker compose up -d --build # volver a arrancar / actualizar tras cambios
```

## Copias de seguridad
Los datos viven en la subcarpeta `datos/` de esta carpeta (fichero `gestor-laboral.db`).
Puedes:
- Copiar ese fichero a lugar seguro con la app **Files** de Umbrel, o
- Desde la propia app: **Ajustes → Exportar copia** (descarga el fichero al dispositivo).

## Alternativa con Portainer (interfaz gráfica)
Si prefieres no usar la terminal y tienes **Portainer** instalado en Umbrel:
**Stacks → Add stack → Upload/Web editor**, pega el contenido de `docker-compose.yml`,
cambia la contraseña y pulsa **Deploy the stack**. (Requiere que la carpeta de la app esté
accesible para construir la imagen; si no, usa la opción por SSH de arriba.)

---

¿Te atascas en algún paso? Dime en qué punto estás y seguimos juntos.
