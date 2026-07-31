# Auditoría de seguridad — App de Gestión Financiera

Revisión realizada sobre `finanzas/` (app cliente + servicio de conectores).
Fecha: 2026-07-31.

## Modelo de amenaza

- **Un solo administrador**, sin multiusuario ni roles.
- **Todo el dato vive en el dispositivo** (IndexedDB). No hay base de datos remota
  ni backend obligatorio: no existe una superficie de servidor que atacar.
- El hosting es **estático** (GitHub Pages, HTTPS), sin lógica de servidor.
- La única pieza con red saliente y credenciales de terceros es el
  **servicio de conectores** (`servidor/`), pensado para el Umbrel del usuario.

Riesgos reales, por orden: (1) fuga de credenciales de terceros —Square, banco—,
(2) exposición del servicio de conectores a Internet, (3) ficheros maliciosos
importados (Excel/CSV/JSON), (4) pérdida o manipulación de datos contables.

## Hallazgos corregidos

| # | Severidad | Hallazgo | Corrección |
|---|-----------|----------|------------|
| 1 | **Alta** | El servicio de conectores aceptaba **cualquier** petición cuando `SECRETO` estaba vacío. Publicado en el Umbrel sin secreto, cualquiera en la red podía leer las liquidaciones de Square. | Sin `SECRETO`, solo se atienden peticiones **loopback**. Aviso en el arranque. `servidor/server.mjs` |
| 2 | **Alta** | Las copias de seguridad y el export de configuración incluían el **token de Square y el secreto del servidor en claro**. Un backup en Drive/correo filtraba las credenciales. | `redactarCredenciales()`: los backups salen sin `token` ni `secretoServidor`; el resto del conector se conserva para poder restaurar. `dominio/backup.ts` |
| 3 | **Media** | El secreto del servidor se comparaba con `===` → **ataque de temporización**. | `crypto.timingSafeEqual` con comprobación previa de longitud. `servidor/server.mjs` |
| 4 | **Media** | `JSON.parse` directo sobre ficheros importados → **contaminación de prototipo** (`__proto__`). | `parseJsonSeguro()` descarta `__proto__`/`constructor`/`prototype`. Usado en backups y en la importación de configuración. |
| 5 | **Media** | La URL del servidor de conectores se usaba tal cual: un `http://` hacia Internet enviaba el **secreto en claro**. | `urlServidorSegura()`: solo HTTPS, o HTTP contra red local (`localhost`, `.local`, 10/8, 172.16/12, 192.168/16). |
| 6 | **Media** | **jsPDF 2.5.2** con vulnerabilidad crítica (y `dompurify` moderada por dependencia). | Actualizado a **jsPDF 4.x + jspdf-autotable 5.x** (misma versión que la app de vóley). API funcional `autoTable(doc, …)`. Verificada la generación real de PDF. |
| 7 | **Baja** | Sin cabecera de política de contenido. | **CSP** en `index.html` (defensa en profundidad): `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`. |

Cobertura: **122 pruebas en verde**, incluidas las nuevas de redacción de
credenciales, parseo seguro de JSON y validación de la URL del servidor.

## Riesgos aceptados / pendientes de decisión

- **`xlsx` (SheetJS) 0.18.5 — alta, sin arreglo en npm.** Dos avisos:
  contaminación de prototipo y ReDoS al parsear una hoja manipulada.
  SheetJS **dejó de publicar en npm**; no hay versión corregida en el registro.
  Mitigación actual: la importación usa `sheet_to_json({ header: 1 })`, es decir,
  se leen **matrices de texto**, así que ninguna clave del fichero llega a los
  objetos de la app. Explotación requiere abrir un `.xlsx` hostil.
  Opciones de arreglo definitivo, a elegir:
  1. Fijar la build oficial de SheetJS: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
     (el CI debe poder alcanzar `cdn.sheetjs.com`).
  2. Usar el espejo en npm `@e965/xlsx` (0.20.3) — corrige ambos avisos, pero es
     un republicador de terceros: es una decisión de cadena de suministro.
- **`brace-expansion` (alta)** — solo dependencia **de compilación**
  (`vite-plugin-pwa` → `workbox-build`). No entra en el bundle, no afecta al
  usuario. Arreglarlo exige una actualización mayor de `vite-plugin-pwa`.
- **CORS del servicio: `ORIGEN_PERMITIDO="*"` por defecto.** Fija la URL exacta
  (`https://voleyplayaponiente-glitch.github.io`) al desplegar en el Umbrel.
  El aviso ya sale por consola al arrancar.
- **Los datos en IndexedDB no están cifrados.** Quien tenga la sesión del
  dispositivo desbloqueada, ve la contabilidad. Se mitiga con el cifrado de
  disco / bloqueo del dispositivo, no dentro de la app.

## Comprobado y correcto

- **Sin secretos en el repositorio**: `servidor/.env` está en `.gitignore`;
  solo se versiona `.env.example` con valores de ejemplo. Ningún token
  (`sq0…`, `sk_live…`, `ghp_…`, `AKIA…`) aparece en el código.
- **Sin sinks de XSS**: ni `dangerouslySetInnerHTML`, ni `innerHTML`, ni `eval`,
  ni `new Function`, ni `document.write` en toda la app ni en el servicio.
- **Credenciales de terceros nunca en el navegador** en el modo recomendado
  (SERVIDOR): el token de Square vive solo en el entorno del Umbrel.
- **Integridad de los backups**: checksum determinista; una restauración de un
  fichero alterado se rechaza con motivo explícito.
- **Sin borrado físico**: las anulaciones son lógicas (`anuladoEn`), queda rastro.
- El servicio de conectores es de **solo lectura** (`GET`), sin dependencias
  externas (menos superficie de cadena de suministro) y no registra credenciales.

## Recomendaciones de despliegue del Umbrel

1. `SECRETO` largo y aleatorio: `openssl rand -hex 32`.
2. `ORIGEN_PERMITIDO` con la URL exacta de la app.
3. Publicar **solo por HTTPS** (Tailscale o túnel de Cloudflare), nunca abrir el
   puerto 3001 directamente en el router.
4. Rotar el token de Square si alguna vez se compartió un backup antiguo
   (los anteriores a esta revisión sí lo contenían en claro).
