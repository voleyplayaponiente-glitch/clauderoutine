# CLAUDE.md — Web de La Forja Abogados

Guía de marca y de trabajo. Léela al empezar cualquier sesión en esta carpeta.
El dueño de la web es el abogado y **no es programador**: explícale cada paso en
lenguaje sencillo, enséñale el resultado en el navegador y espera su OK antes de publicar.

## Qué es
Web estática (HTML, CSS y JS, sin WordPress ni base de datos) del despacho
La Forja Abogados, en Finestrat (Alicante). Lema: **«Forjamos soluciones»**.

## Cómo está organizada
- `datos.json` — **único sitio** donde se cambian teléfono, email, horario, dirección, redes, NIF y nº de colegiado.
- `paginas/` — el contenido de cada página. Cada archivo empieza con una cabecera entre `---` (`titulo`, `descripcion`, `ruta`, `menu`).
- `plantillas/` — cabecera, pie y trozos comunes a todas las páginas (`base.html`).
- `estaticos/` — estilos (`css/estilo.css`), `js`, imágenes (`img`) y fuentes.
- Páginas de área: todas siguen el mismo orden (cabecera, Qué es, En qué casos ayudo, Cómo es el proceso,
  Documentación, Preguntas frecuentes, `{{> llamada}}` y `{{> otras-areas}}`). Para un área nueva, copiar una existente
  y añadirla al menú y al pie en `plantillas/base.html` y en `plantillas/otras-areas.html`.
- `construir.mjs` — junta todo y genera la web en `sitio/` (carpeta generada, no se edita a mano).

## Comandos
```bash
node construir.mjs         # genera la web en "sitio"
node construir.mjs --ver   # la genera y la sirve en http://localhost:4173
node construir.mjs --publicar  # lo que ejecuta Cloudflare Pages; falla si faltan nº de colegiado o NIF
```

## Cómo se publica
- La web se publica sola en Cloudflare Pages cada vez que se suben cambios a GitHub (rama principal).
- «Publica los cambios» = generar la web, comprobar que no hay avisos de PENDIENTE, guardar un punto de
  control en git con un mensaje claro en español y subirlo a GitHub.
- «Deshaz el último cambio» = revertir el último punto de control con `git revert` (sin borrar historial) y volver a subir.
- Antes de publicar, enseñar siempre el cambio en el navegador y esperar el OK del abogado.
- Los pasos de la primera publicación y del dominio están en `README.md`; la guía para el abogado, en `COMO-HACER-CAMBIOS.md`.
Solo hace falta Node.js; no hay dependencias que instalar.

## Marca
- Paleta exacta: azul noche `#0E182C`, azul real `#0B0D41`, oro claro `#E6C47E`,
  oro viejo `#A68948`, blanco roto `#F5F1E8`. Secciones de lectura en blanco o hueso.
- El oro claro solo va sobre fondo azul. Para texto pequeño dorado sobre fondo claro
  se usa `--oro-texto` (`#76602A`), que sí cumple contraste.
- Titulares en Cormorant Garamond (serif); texto y etiquetas en Inter. Fuentes alojadas
  en la propia web (`estaticos/fuentes`), no se cargan de Google.
- Etiquetas pequeñas en MAYÚSCULAS, oro y con espaciado (clase `.etiqueta`).
- La forja como detalle sutil (líneas de oro, brillo cálido), nunca decoración recargada.
- Animaciones: solo la aparición suave de bloques (clase `.aparece`).
- Tono: cercano, claro y serio, en primera persona del abogado y tuteando. Sin tecnicismos innecesarios.

## Normas deontológicas (obligatorias)
- Nada de promesas de resultados («ganamos tu caso», «100 % de éxito», «cancela todas tus deudas»…).
- No mencionar clientes, casos ni testimonios sin autorización expresa.
- No comparar con otros despachos ni hablar de precios sin que el abogado lo confirme.
- Solo 4 áreas, en este orden: Extranjería (principal), Penal, Civil, Segunda oportunidad.

## Logo y fotos
- `originales/` — archivos originales, **no se publican**: `logo.jpg` (logo completo, oro sobre azul),
  `simbolo.png` (balanza + yunque recortado del logo con fondo transparente), `adonis-retrato.jpg`
  y `adonis-circular.jpg`.
- `estaticos/img/` — versiones ligeras que usa la web, hechas a partir de los originales:
  `simbolo.webp`, `simbolo-96.webp` (cabecera y pie), `favicon.png`, `icono-*.png`, `logo-640.webp`,
  `adonis-retrato-480/840.webp`, `adonis-circular-400.webp` y `compartir.jpg` (imagen al compartir el enlace).
- Las fotos del abogado van siempre en blanco y negro.

## SEO (ya montado, mantenerlo al añadir páginas)
- Cada página lleva en su cabecera `titulo` (máx. ~65 caracteres, área + Finestrat/Benidorm), `descripcion`
  (70–160 caracteres, distinta en cada página) y `miga` (nombre corto para la ruta de migas).
- Un solo `<h1>` por página. `buscadores: no` en la cabecera excluye la página de Google y del sitemap.
- `construir.mjs` genera solo: canonical, Open Graph, `sitemap.xml`, `robots.txt` y los datos estructurados
  (despacho `LegalService`, abogado, migas y las preguntas frecuentes escritas con `<details>`).
- `estaticos/_headers` — cabeceras de seguridad y de caché para Cloudflare Pages.

## Requisitos que hay que mantener
- Perfecta en móvil: barra inferior «Llamar / WhatsApp» en móvil y botón flotante de WhatsApp en pantallas grandes.
- Sin cookies de terceros (por eso no hay banner): nada de mapas incrustados, fuentes externas ni analítica sin consultarlo antes.
- Pie con Aviso legal · Privacidad · Cookies en todas las páginas.
- Accesibilidad: textos alternativos, foco visible, contraste correcto.
- Imágenes en WebP y con carga diferida. Créditos de fotos de stock en `CREDITOS-FOTOS.md`.

## Estado (13 nov 2026) — para retomar
Hechas y aprobadas por el usuario las fases 1 a 4 y los documentos de entrega: 10 páginas (inicio, 4 áreas,
sobre mí, contacto, 3 legales) + página 404, SEO, logo y retrato reales, 3 fotos de stock.
- El usuario trabaja por fases: enseñar el resultado (capturas o vista previa) y esperar su OK antes de seguir.
- Vista previa privada publicada como artifact: https://claude.ai/artifact/SQPw6sqPoAzzrhTg3bdVgM
  Es una copia con rutas relativas hecha a mano desde `sitio/`; no se actualiza sola. Si cambia la web, regenerarla.
- Unsplash y Pexels bloquean el acceso automático: las fotos de stock las descarga y las sube el usuario.
- En la sesión en la nube no se pudo ejecutar Lighthouse; PageSpeed queda para cuando esté publicada.
- El zip de la carpeta que se le envió es anterior a las fotos de stock: generarle uno nuevo si lo pide.
- Siguiente paso previsto: lo que traiga el usuario (créditos de fotos, más fotos, datos pendientes o correcciones de texto).

## Pendiente
- **Nº de colegiado ICALI**: está como `[Nº COLEGIADO]` en `datos.json`. **No publicar la web sin él.**
- NIF: está como `[NIF]` en `datos.json`; ponerlo antes de publicar (sale en el aviso legal).
- Confirmar días del horario (ahora: lunes a viernes, 8:00–18:00).
- Fotos de stock: hay 3 colocadas (clase `.foto`, originales en `originales/stock`). Falta anotar su autor y
  enlace en `CREDITOS-FOTOS.md`. Si se añaden más: sin caras reconocibles, en WebP a 640 y 1200 px.
- Textos: todos son borrador hasta que el abogado los revise (ver `TEXTOS-POR-REVISAR.md`).
- Formulario de contacto: falta pegar la clave de Web3Forms en `datos.json` (`formulario.claveWeb3Forms`,
  ahora `ACCESS_KEY`) y probar que llega el email. Mientras no esté, el formulario avisa de que no está activado.
- Los 3 textos legales deben ser aprobados por el abogado.
