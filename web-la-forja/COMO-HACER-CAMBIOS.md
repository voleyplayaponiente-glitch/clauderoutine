# Cómo hacer cambios en la web

Guía para Adonis. No hace falta saber programar: los cambios se le piden a Claude Code
con frases normales, se revisan en el navegador y, si están bien, se publican.

## 1. Abrir el proyecto

1. Abre la aplicación **Claude** en el ordenador.
2. Entra en la pestaña **Code**.
3. Elige la carpeta **`web-la-forja`**.

Ya puedes escribir lo que quieres cambiar.

## 2. Pedir un cambio

Escríbelo como se lo dirías a una persona. Cuanto más concreto, mejor. Ejemplos:

**Datos del despacho**
- «Cambia el horario a lunes a viernes de 9:00 a 14:00 y de 16:30 a 19:30.»
- «Ya tengo el número de colegiado: es el XXXX. Ponlo.»
- «He cambiado de teléfono. El nuevo es 6XX XX XX XX.»

**Textos**
- «En la página de Extranjería, cambia el primer párrafo por este: …»
- «Añade una pregunta frecuente en Extranjería: "¿Cuánto tarda la nacionalidad?" con esta respuesta: …»
- «Quita la tarjeta de "Incumplimientos" de la página de Civil.»

**Fotos**
- «Cambia mi foto de "Sobre mí" por la nueva que he puesto en la carpeta `originales`.»

**Cosas más grandes**
- «Añade un área nueva de "Familia" con el mismo estilo que las demás.»
- «Quiero una página de blog para publicar artículos.»

Claude ya conoce los colores, las tipografías, el tono y las normas del despacho
(están en el archivo `CLAUDE.md`), así que no hace falta repetírselos.

## 3. Ver el cambio antes de publicar

Escribe:

> Enséñame la web en el navegador.

Claude la abrirá en una dirección como `http://localhost:4173`. Esa dirección solo funciona
en tu ordenador: nadie más la ve. Revisa el cambio y, a ser posible, míralo también en
tamaño móvil (pídele «enséñamela como se ve en un móvil»).

Si algo no te convence, dilo: «el texto es demasiado largo», «ponlo más arriba», «vuelve a como estaba».

## 4. Publicar

Cuando esté bien, escribe:

> Publica los cambios.

En un par de minutos estarán en internet. Compruébalo abriendo la web en el móvil.
Si no ves el cambio, recarga la página.

## 5. Deshacer

Cada cambio queda guardado como un punto de control, así que siempre se puede volver atrás:

> Algo ha salido mal: deshaz el último cambio y vuelve a publicar.

También puedes pedir «enséñame los últimos cambios que hemos hecho» para ver la lista y elegir a cuál volver.

## Tres cosas que conviene recordar

1. **Los datos del despacho están en un solo sitio** (`datos.json`). Al cambiar ahí el teléfono,
   el horario o el número de colegiado, se actualizan en todas las páginas a la vez.
2. **La web no se puede publicar sin número de colegiado ni NIF.** Si faltan, Claude te avisará
   y la publicación se detendrá sola. Es a propósito: el aviso legal estaría incompleto.
3. **Los textos son tuyos.** Lo que hay escrito es un borrador. La lista de lo que falta por
   revisar está en `TEXTOS-POR-REVISAR.md`. Pide «repasemos los textos por revisar» y los vais viendo uno a uno.

## Si algo no funciona

- **«No encuentra Node»**: pide «instala Node.js en mi ordenador». Solo hay que hacerlo una vez.
- **El formulario no envía mensajes**: falta la clave de Web3Forms. Pide «ayúdame a activar el formulario de contacto».
- **Cualquier otro error**: copia el mensaje y pregúntale «¿qué significa esto y cómo lo arreglamos?».

Aunque dejes de usar Claude, la web sigue publicada y funcionando. Solo pierdes la ayuda para cambiarla.
