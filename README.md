# Gestor Laboral — Cuadrantes y control de horas

Aplicación de **escritorio, local y sin conexión** para un despacho de graduado social que
gestiona el personal de varias tiendas. Planifica cuadrantes mensuales por trabajador y por
centro, calcula las horas, controla horas complementarias, vacaciones y avisos laborales, y
exporta el **registro de jornada firmado** en PDF y Excel.

> 🔒 **Todos los datos se guardan en tu ordenador** en un único fichero SQLite. Nada se sube a
> internet ni a la nube. Cumple el requisito de RGPD de no sacar del equipo datos sensibles
> (DNI/NIE, nº de Seguridad Social, IBAN, dirección).

---

## Dos formas de usarla

1. **App de escritorio (Electron):** se instala en un ordenador y se abre como un programa
   con su ventana. Es la opción más sencilla y privada. Sigue los pasos de abajo.
2. **Versión web (para servidor/Umbrel):** se ejecuta en un servidor y se abre desde el
   navegador de cualquier dispositivo de tu red, con contraseña. Guía completa en
   **[INSTALACION-UMBREL.md](INSTALACION-UMBREL.md)**.

Ambas comparten el mismo motor de cálculo y guardan los datos **en local** (fichero SQLite),
nunca en la nube.

---

## 1. Requisitos previos (una sola vez) — versión de escritorio

Necesitas tener instalado **Node.js 18 o superior** (incluye `npm`).

- Descárgalo desde <https://nodejs.org> (botón «LTS») e instálalo con «Siguiente → Siguiente».
- Para comprobar que está instalado, abre una terminal y escribe: `node --version`

## 2. Instalación de la aplicación (una sola vez)

1. Descarga o copia esta carpeta en tu ordenador.
2. Entra en la carpeta y ejecuta:

   ```bash
   npm install
   ```

   (Descarga las piezas necesarias; puede tardar unos minutos la primera vez.)

## 3. Arrancar la aplicación

### Opción fácil: doble clic

- **Windows:** doble clic en `Iniciar-Windows.bat`
- **macOS:** doble clic en `Iniciar-macOS.command` (la primera vez: clic derecho → Abrir)
- **Linux:** ejecuta `./Iniciar-Linux.sh`

### Opción manual (terminal)

```bash
npm run dev
```

La ventana de la aplicación se abrirá sola.

## 4. Crear un instalador de escritorio (opcional)

Para tener un icono en el escritorio y no depender de la terminal, genera un instalador nativo:

```bash
npm run dist        # instalador para tu sistema operativo actual
npm run dist:win    # Windows (.exe)
npm run dist:mac    # macOS (.dmg)
npm run dist:linux  # Linux (AppImage)
```

El instalador aparecerá en la carpeta `dist/`.

---

## 5. Cómo se usa (resumen)

La barra lateral tiene las secciones en el orden natural de trabajo:

1. **Empresas** — da de alta cada empresa (razón social, CIF, administrador y **sello** para los PDF).
2. **Centros** — cada tienda: código, convenio, **horas anuales de referencia**, horario y **días de apertura** (laborables/sábados/domingos/festivos), color y **festivos**.
3. **Trabajadores** — ficha completa: identificación, contrato, jornada, coeficiente de parcialidad,
   sueldo, vacaciones y **centros donde puede trabajar** (uno principal + secundarios).
   Distingue **cuenta ajena** y **autónomo**.
4. **Cuadrantes / Agenda** — el núcleo. Elige mes y trabajador y rellena los turnos día a día
   (con turno partido). Botones de **copiar semana anterior** y **patrón rápido**. Dos vistas:
   - **Por trabajador**: todos sus días, con el centro de cada día, totales y avisos.
   - **Por centro**: qué trabajadores cubren cada día en cada tienda (código de colores).
5. **Informes** — horas por trabajador y por centro, desviaciones, complementarias y vacaciones.
6. **Exportación** — cuadrante firmado (PDF/Excel) y resumen mensual por centro.
7. **Ajustes** — copia de seguridad (exportar/importar) y ubicación del fichero de datos.

### Avisos automáticos al planificar

- Supera las horas de contrato o la media mensual.
- Se generan **horas complementarias** (Art. 12.5 ET), valoradas al precio configurado.
- Descanso inferior a **12 h** entre jornadas.
- No se respeta el **descanso semanal** de día y medio (36 h).
- Turno **fuera del horario de apertura** o en un día que el centro **no abre**.
- **Fin del periodo de prueba** próximo.
- **Solapamiento** de tramos en un mismo día.

### Cálculos que hace la app

- **Media mensual** = horas anuales del convenio × coeficiente de parcialidad ÷ 12 (constante todo el año).
- **Sueldo prorrateado** = sueldo de jornada completa × coeficiente de parcialidad.
- **Horas complementarias** = horas realizadas − horas de la jornada contratada.
- **Vacaciones pendientes** = días anuales − días disfrutados.
- Totales por trabajador y por centro, y desviaciones frente a media y contrato.

---

## 6. Copias de seguridad

En **Ajustes → Exportar copia** guardas todo en un fichero `.db`. Guárdalo en un lugar seguro
(disco externo, etc.). Para recuperarlo, **Ajustes → Restaurar copia** (sobrescribe los datos
actuales; reinicia la app después).

El fichero de datos vivo está en la carpeta de datos de usuario de la aplicación; su ruta exacta
se muestra en **Ajustes → Ubicación de los datos**.

---

## 7. Para desarrolladores

- **Stack:** Electron + React + TypeScript + Vite (`electron-vite`), SQLite (`better-sqlite3`),
  Excel (`exceljs`), PDF (impresión nativa de Electron). Empaquetado con `electron-builder`.
- **Motor de cálculo puro** en `src/shared/` (sin Electron ni React), con pruebas en Vitest:

  ```bash
  npm test          # pruebas del motor (cálculos y avisos)
  npm run typecheck # comprobación de tipos
  ```

- **Arquitectura:**
  - `src/main/` — proceso principal: base de datos, repositorios, IPC y servicios (backup, export).
  - `src/preload/` — puente seguro `window.api` (contextIsolation).
  - `src/renderer/` — interfaz React (pantallas y componentes).
  - `src/shared/` — tipos y motor de cálculo/avisos compartido.
