# Tienda personal de apps de Umbrel — BESPAIN

Contenido fuente de la *community app store* de Umbrel que instala **Gestor Laboral**
con su propio icono en el panel. Estos ficheros se publican en el repositorio
`bespain-umbrel-store` (raíz del repo), que es la URL que se añade en
Umbrel → App Store → ⋯ → Community App Stores.

- La imagen la construye GitHub Actions (`.github/workflows/publicar-imagen.yml`
  del repo principal) y se publica en `ghcr.io/voleyplayaponiente-glitch/gestor-laboral`.
- La contraseña de acceso de la app la genera Umbrel (`APP_PASSWORD`); se consulta
  en el panel de Umbrel → Gestor Laboral → ⋯ → mostrar contraseña.
- Los datos viven en `${APP_DATA_DIR}/data` (dentro de la carpeta de datos de la app
  en Umbrel). Para migrar desde el despliegue manual: exportar copia (.db, sin cifrar)
  desde la app antigua y restaurarla en la nueva desde Ajustes.
- Para publicar una actualización: subir nueva imagen (push a la rama) y aumentar
  `version` en `umbrel-app.yml` de la tienda → botón Actualizar en Umbrel.
