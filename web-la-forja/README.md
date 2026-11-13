# Web de La Forja Abogados

Web del despacho La Forja Abogados (Finestrat, Alicante). Es una web estática: HTML, CSS y un
poco de JavaScript, sin WordPress ni base de datos. No usa cookies ni carga nada de servidores externos.

- Para hacer cambios en el día a día: **[COMO-HACER-CAMBIOS.md](COMO-HACER-CAMBIOS.md)**
- Textos que el abogado tiene que revisar: **[TEXTOS-POR-REVISAR.md](TEXTOS-POR-REVISAR.md)**
- Guía de marca y normas para Claude Code: **[CLAUDE.md](CLAUDE.md)**

## Qué hay en cada carpeta

| Carpeta o archivo | Qué es |
|---|---|
| `datos.json` | Datos del despacho: teléfono, email, horario, dirección, redes, NIF, nº de colegiado. **Único sitio donde se cambian.** |
| `paginas/` | El texto de cada página (inicio, las 4 áreas, sobre mí, contacto, legales y la página de error). |
| `plantillas/` | Lo que se repite en todas las páginas: cabecera, menú, pie y botones de contacto. |
| `estaticos/` | Estilos, imágenes ligeras, tipografías y el pequeño programa del menú y del formulario. |
| `originales/` | Logo y fotos originales. No se publican; se guardan para sacar nuevas versiones. |
| `construir.mjs` | El programa que junta todo y genera la web. |
| `sitio/` | La web ya generada. Se crea sola; no se edita a mano ni se guarda en el repositorio. |

## Ver la web en el ordenador

Hace falta tener instalado [Node.js](https://nodejs.org) (gratis, versión 18 o superior). Nada más.

```bash
node construir.mjs --ver
```

Después se abre `http://localhost:4173` en el navegador.

## Antes de publicar: lo que falta

**Obligatorio** (sin esto la publicación se detiene sola):

- [ ] **Nº de colegiado del ICALI** → `numColegiado` en `datos.json`
- [ ] **NIF** → `nif` en `datos.json`

**Necesario para que todo funcione:**

- [ ] **Clave del formulario** → crear una clave gratuita en [web3forms.com](https://web3forms.com) con el email
      del despacho y pegarla en `claveWeb3Forms` de `datos.json`. Después, enviar un mensaje de prueba y comprobar que llega.
- [ ] **Confirmar los días del horario** (ahora: lunes a viernes, de 8:00 a 18:00) → `horario` en `datos.json`
- [ ] **Revisar y aprobar los textos**, sobre todo los tres legales → ver `TEXTOS-POR-REVISAR.md`
- [ ] **Comprobar la web del Colegio** enlazada en el aviso legal (`www.icali.es`)

**Opcional:**

- [ ] Fotos genéricas de ambiente (Unsplash o Pexels, con licencia de uso comercial), optimizadas en WebP,
      en `estaticos/img/stock` y con sus créditos en un archivo `CREDITOS-FOTOS.md`. La web funciona sin ellas.
- [ ] Página de blog.
- [ ] Email profesional con el dominio propio (por ejemplo `info@laforjaabogados.es`). Si se cambia, basta
      con actualizar `email` en `datos.json` y el email de destino en Web3Forms.

## Publicar en internet (se hace una sola vez)

Todas las cuentas se crean **a nombre del abogado**, con su email y su tarjeta. Los nombres de los menús
de GitHub y Cloudflare pueden cambiar con el tiempo; si algo no coincide, se le pregunta a Claude Code.

### 1. Subir la web a GitHub

1. Crear una cuenta en [github.com](https://github.com/signup).
2. Con la carpeta `web-la-forja` abierta en Claude Code, pedir:
   «Sube la web a un repositorio **privado** en mi GitHub».

### 2. Conectar con Cloudflare Pages

1. Crear una cuenta en [cloudflare.com](https://www.cloudflare.com).
2. En el panel, ir a **Workers & Pages → Create → Pages → Connect to Git** y elegir el repositorio.
3. En la configuración de compilación, poner:

   | Campo | Valor |
   |---|---|
   | Framework preset | None |
   | Build command | `node construir.mjs --publicar` |
   | Build output directory | `sitio` |

4. Guardar y desplegar. Cloudflare dará una dirección provisional acabada en `.pages.dev`.

A partir de aquí, cada cambio que se suba a GitHub (al decir «publica los cambios») se publica solo
en un par de minutos. Si faltan el nº de colegiado o el NIF, la compilación falla a propósito y
en internet se queda la versión anterior.

### 3. Conectar el dominio `laforjaabogados.es`

1. Comprar el dominio a nombre del abogado (por ejemplo en DonDominio o en Cloudflare Registrar).
2. En el proyecto de Cloudflare Pages: **Custom domains → Set up a custom domain** y escribir `laforjaabogados.es`.
   Repetir con `www.laforjaabogados.es`.
3. Seguir las instrucciones que da Cloudflare:
   - Si el dominio se compró en Cloudflare, se configura solo.
   - Si se compró en otro sitio, hay que cambiar los servidores DNS del dominio por los de Cloudflare
     (o añadir el registro CNAME que indique) desde el panel de quien vendió el dominio.
4. Esperar a que aparezca como activo y con HTTPS. Puede tardar desde minutos hasta unas horas.

La dirección de la web está escrita en `dominio` de `datos.json`. Si al final el dominio fuera otro,
hay que cambiarla ahí: de ella salen las direcciones del sitemap y de los datos para Google.

### 4. Después de publicar

- [ ] Abrir la web en el móvil y probar: llamar, WhatsApp, formulario y enlace a Google Maps.
- [ ] Compartir el enlace por WhatsApp y comprobar que sale la imagen con el logo.
- [ ] Dar de alta la web en [Google Search Console](https://search.google.com/search-console) y enviar
      `https://laforjaabogados.es/sitemap.xml`.
- [ ] Crear o actualizar el [Perfil de Empresa en Google](https://www.google.com/intl/es_es/business/) con la web
      enlazada y los mismos datos (nombre, dirección, teléfono y horario) que aparecen en la web.
- [ ] Pasar [PageSpeed Insights](https://pagespeed.web.dev) en móvil (objetivo: más de 90).
- [ ] Comprobar los datos estructurados en [validator.schema.org](https://validator.schema.org).

## Normas que no se tocan

Son obligaciones deontológicas de la abogacía y están detalladas en `CLAUDE.md`:

- Nada de promesas de resultados.
- No se nombran clientes, casos ni testimonios sin autorización expresa.
- No se compara con otros despachos ni se habla de precios sin que el abogado lo confirme.
