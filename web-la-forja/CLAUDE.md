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
```
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

## Logo y fotos (en `estaticos/img`)
- `logo.jpg` — logo original completo (oro sobre azul). Usarlo tal cual solo sobre fondo azul.
- `simbolo.png` — balanza + yunque recortado del logo con fondo transparente; de él salen
  `simbolo.webp`, `simbolo-96.webp` (cabecera y pie), `favicon.png` e `icono-*.png`.
- `adonis-retrato.jpg` y `adonis-circular.jpg` — originales; en la web se usan las versiones
  `adonis-retrato-480/840.webp`. Siempre en blanco y negro.

## Requisitos que hay que mantener
- Perfecta en móvil: barra inferior «Llamar / WhatsApp» en móvil y botón flotante de WhatsApp en pantallas grandes.
- Sin cookies de terceros (por eso no hay banner): nada de mapas incrustados, fuentes externas ni analítica sin consultarlo antes.
- Pie con Aviso legal · Privacidad · Cookies en todas las páginas.
- Accesibilidad: textos alternativos, foco visible, contraste correcto.
- Imágenes en WebP y con carga diferida. Créditos de fotos de stock en `CREDITOS-FOTOS.md`.

## Pendiente
- **Nº de colegiado ICALI**: está como `[Nº COLEGIADO]` en `datos.json`. **No publicar la web sin él.**
- NIF: está como `[NIF]` en `datos.json`; ponerlo antes de publicar (sale en el aviso legal).
- Confirmar días del horario (ahora: lunes a viernes, 8:00–18:00).
- Fotos genéricas de stock.
- Textos: todos son borrador hasta que el abogado los revise (ver `TEXTOS-POR-REVISAR.md`).
- Páginas por hacer: Sobre mí, Contacto (formulario Web3Forms) y los 3 textos legales.
