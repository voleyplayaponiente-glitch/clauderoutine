# Estado del proyecto · Web de ALMA PIEBALD

Última actualización: 21/08/2026

## Qué es

Web de empresa para **ALMA PIEBALD**, agencia que vende servicios de marketing
y automatización con IA (el catálogo de origendigital.es, enfocado a IA).
Construida con la skill de webs cinematográficas: héroe con vídeo movido por
el scroll, y sitio real debajo.

- **Carpeta que se publica:** `sitio-alma-piebald/` (index.html + assets/)
- **Paquete de diseño:** `PAQUETE-DISENO-ALMA-PIEBALD.md` (raíz, no se publica)
- **Rama:** `claude/empresa-ia-website-8jfpwd`

## Decisiones cerradas

| Punto | Decisión |
|---|---|
| Nombre | ALMA PIEBALD |
| Premisa | Dos naturalezas, un solo cuerpo. El alma es la pieza de dentro que aguanta; el pío es el caballo de dos capas. |
| Público | Cualquier negocio que quiera vender más con IA |
| Sensación | Futuro que se entiende |
| Llamada a la acción | WhatsApp directo a **+34 681 044 795** |
| Modelo de imagen | Seedream 5 Pro (ya usado) |
| Modelo de vídeo | **Kling 2.5**, dos tomas, 650 créditos |
| Formulario | No hay. Enlace directo a WhatsApp con mensaje escrito. |

## Hecho

- Web completa y funcionando: 9 secciones, calculadora interactiva de horas
  recuperadas, marca pía en SVG dibujada a mano, costura vertical que se
  dibuja con el scroll, polvo ámbar a nivel de susurro.
- Motor del héroe al estándar completo: vídeo como Blob con anillo de carga,
  lerp normalizado por delta, verja en las búsquedas de fotograma, escritura
  al DOM solo al cambiar, bandas con meseta larga y scrim local.
- Auditoría en navegador real (Playwright + Chromium) con un clip sintético
  de prueba. Verificado: el vídeo recorre su duración con el scroll y rebobina
  al subir, ningún tramo del héroe sin texto legible, las 4 bandas llegan a
  plena opacidad, la página queda completa sin vídeo, cero desbordamiento
  horizontal en escritorio y móvil, cero elementos invisibles con movimiento
  reducido, el titular no se mete bajo la barra en ventana corta.
- Verja de copy pasada: cero rayas largas, cero palabras de catálogo, cero
  tics de IA.
- Imagen de partida del vídeo generada y **aprobada**: dos corrientes cayendo
  (tierra y ámbar líquido) en aire con polvo, 2560x1440, tercio izquierdo
  limpio para los titulares. Está en la cuenta de Magnific
  (jennifernietotv@gmail.com), proyecto Personal, identificador `huHaBjdvqL`.

## Pendiente

1. ~~Generar el vídeo.~~ **Hecho.** Dos tomas con Kling 2.5, 1080p, 5 s, 16:9,
   desde el fotograma aprobado. 650 créditos gastados. Identificadores:
   `ovC5Ukp829` (toma A, trenza suave) y `bxsOAGB5Y2` (toma B, hélice).
   Falta que el cliente elija una.
2. **Bajar el MP4 elegido a la máquina.** El proxy de red bloquea
   `magnific.com` y `pikaso.cdnpk.net`, así que hay que arrastrarlo al chat o
   pedir que desbloqueen esos dos dominios.
3. **Procesarlo:** re-codificar con fotograma clave cada 8 (`-g 8 -keyint_min 8`),
   sacar `hero-poster.jpg` y `hero-ending.jpg`, dejarlo en `assets/`.
   Los comandos exactos están en el recetario de ffmpeg de la skill.
4. **Publicar.** Falta decidir dónde: dominio propio, subdominio temporal de
   hosting, o GitHub Pages (ojo: la raíz del repo ya publica el gestor de
   torneos, habría que servir la web en una subcarpeta).

## Avisos

- El conector de Magnific se cae y vuelve constantemente. Si no responde,
  reconectarlo desde claude.ai, Ajustes, Conectores.
- La consola muestra un 404 de `assets/hero-poster.jpg` hasta que exista ese
  archivo. Desaparece solo al añadir el vídeo.
- Créditos de Magnific: unos 18.500 tras las dos imágenes y las dos tomas.

## Vista previa navegable

`construir-vista-previa.py` empaqueta la web en un solo archivo HTML y lo deja
en la raíz, fuera de la carpeta que se publica. Ese archivo está publicado como
artefacto privado en:

    https://claude.ai/code/artifact/8d2bb112-1d01-4fa1-8085-ca81a435606c

Para actualizarlo hay que volver a publicar pasando esa misma dirección, o se
crea un artefacto nuevo con otro enlace.
