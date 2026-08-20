# Paquete de diseño · ALMA PIEBALD

Documento único de la Fase 5. Se escribe antes de generar y se consume en la Fase 8.
Toda la copy de aquí se monta **literal**. Los rangos numéricos son puntos de partida,
los valida el test de flick.

---

## 1. La premisa de marca

**El alma es la pieza de dentro que aguanta todo.** En una viga, en un cable, en un
violín, el alma es lo que no se ve y sostiene la estructura. Y *piebald* es el caballo
pío: nace con dos capas, una oscura y una clara, en el mismo cuerpo, y nadie le pregunta
nunca cuál de las dos mitades es el caballo de verdad.

ALMA PIEBALD vende una sola idea, y la página entera la enseña: **dos naturalezas, un
solo cuerpo**. El oficio de siempre y la máquina que no duerme, trabajando en el mismo
negocio. No sustituimos a nadie. Doblamos a todo el mundo.

Si una sección no sirve a esa idea, no entra en la página.

## 2. La paleta como tokens CSS

Sacada del mundo del vídeo: tierra tostada y luz ámbar en aire con polvo. Los valores
finales se ajustan del fotograma aprobado, después de la puerta del vídeo.

```css
:root{
  --canvas:#0E0C0B;              /* pardo casi negro, nunca negro puro */
  --canvas-deep:#080706;         /* pozos de sombra entre secciones */
  --panel:#191512;               /* tarjetas y superficies elevadas */
  --panel-edge:#2A231D;          /* bordes de 1px */
  --accent:#E9A542;              /* ámbar: el CTA y el énfasis raro */
  --accent-hover:#F7BC63;
  --accent-muted:rgba(233,165,66,.16); /* bordes, brillos, partículas */
  --earth:#8A5A38;               /* la capa oscura del pío */
  --text-primary:#F4EFE8;        /* blanco cálido, nunca blanco puro */
  --text-secondary:#A2968A;
}
```

## 3. El trío tipográfico

| Papel | Fuente | Pesos | Por qué |
|---|---|---|---|
| Display | **Fraunces** | 400, 600, 900 (opsz variable, SOFT/WONK) | Serif con oficio, escrita a mano hace siglos. Es "lo tradicional" en forma de letra. |
| Cuerpo | **Manrope** | 400, 500, 700 | Limpia y cálida, se lee sin esfuerzo. Es "lo que se entiende". |
| Mono | **Space Mono** | 400, 700 | Etiquetas pequeñas, cifras y numeración. Sabe a máquina de escribir y a terminal a la vez. |

Ni Inter ni Roboto en ningún sitio.

## 4. El mapa de bandas del héroe

| Banda | Rango (partida) | Momento del vídeo | Copy (literal) | Entrada |
|---|---|---|---|---|
| 1 | 0.00 a 0.27 | Las dos corrientes empiezan a caer, separadas y limpias | "Dos naturalezas." | fundido con subida de 24px |
| 2 | 0.22 a 0.50 | Descienden en paralelo, ganan velocidad, el polvo se enciende | "El oficio de siempre." | palabra a palabra, desenfoque a foco |
| 3 | 0.45 a 0.73 | Empiezan a trenzarse sin llegar a mezclarse | "La máquina que no duerme." | escala 0.96 a 1 con brillo ámbar |
| 4 | 0.68 a 0.97 | La trenza baja unida y se asienta | "En el mismo cuerpo." | fundido lento, resplandor que crece |
| settle | 0.90 a 0.97 | Fotograma final en reposo, trenza a la derecha | titular + subtítulo + CTA | escalonada, 90ms entre piezas |

Las bandas se solapan un tramo igual a la rampa: el relevo es un fundido cruzado, nunca un hueco. Validado con el test de flick.

La acción vive a la derecha del encuadre, así que **todas las bandas van a la izquierda**
y el carril de la acción se queda limpio.

## 5. Bloque del héroe estático (móvil y movimiento reducido)

- Titular: **Ponemos la IA a trabajar en negocios de verdad.**
- Subtítulo: Publicidad, contenido y agentes que atienden solos. Sin humo, sin permanencia y con las ventas a la vista.
- CTA: **Hablar por WhatsApp**

## 6. El guion de abajo del pliegue

Orden de secciones, cada una empujando al único CTA de WhatsApp.

1. **El problema** (lenguaje literal de los compradores)
   - Antetítulo: EL PROBLEMA DE SIEMPRE
   - Titular: Te mandan informes. Tú necesitas ventas.
   - Cuerpo: Impresiones, alcance, seguidores ganados. Un PDF precioso cada mes y ni una línea sobre cuánto has vendido. La agencia factura por horas de gestión, así que cuantas más horas, mejor le va. A ti eso no te paga las nóminas.
   - Remate: Aquí se cobra por lo que se mueve, no por lo que se tarda.

2. **Qué hacemos** (4 tarjetas, cada una con su imagen o su motivo SVG)
   - Publicidad que aprende sola · Campañas en Meta, Google, TikTok y LinkedIn. La IA prueba cien variantes mientras tú duermes y apaga sola lo que no vende.
   - Contenido a ritmo de máquina · Vídeo, foto de producto y publicaciones para todo el mes, generados y revisados por una persona antes de salir.
   - Agentes que atienden solos · Responden WhatsApp y web a cualquier hora, cualifican al que pregunta y te pasan solo al que va en serio.
   - Web, Kit Digital y facturación · La web, la factura electrónica y la ayuda pública tramitada. Sin cutreweb y sin desaparecer al mes siguiente.

3. **Cómo trabajamos** (3 pasos, los tres con imagen, sin asimetrías)
   - 01 Miramos · Veinte minutos mirando tu negocio para encontrar dónde se te va el tiempo y dónde se te escapa el dinero. Gratis y sin compromiso.
   - 02 Montamos · En dos semanas está funcionando lo primero. Empezamos por un solo problema concreto, no por una plataforma entera.
   - 03 Medimos · Un panel con lo único que importa: cuánto entra, cuánto cuesta traerlo y cuánto queda. Lo abres tú cuando quieras.

4. **El momento interactivo: el deslizador pío**
   - Antetítulo: PÁSALE LA MANO POR ENCIMA
   - Titular: El mismo negocio, las dos capas.
   - Panel partido que el visitante arrastra: a un lado el mes como es hoy, al otro el mes con las dos naturalezas trabajando. Cifras concretas de tiempo y respuesta, no promesas.

5. **La prueba**
   - Antetítulo: SIN MAQUILLAJE
   - Titular: Somos nuevos. Esto es lo que sí podemos enseñarte.
   - Tres datos honestos con su fuente, en vez de testimonios inventados: solo 4 de cada 10 pymes españolas usa IA a diario; la queja número uno con las agencias es el informe sin ventas; el miedo número uno con la IA no es técnico, es no saber por dónde empezar.

6. **Preguntas de verdad** (las objeciones reales encontradas en la investigación)
   - ¿Y si la IA se equivoca? · Se equivoca, claro. Por eso nada sale sin que lo mire una persona, y por eso empezamos por un trozo pequeño del negocio en vez de por todo a la vez. Si algo falla, se apaga en un minuto y sigues como estabas.
   - ¿Va a sonar todo a robot? · Los agentes hablan con tus palabras, no con las de un manual. Y cuando la conversación se pone seria, te la pasan a ti. Un cliente enfadado no habla con una máquina.
   - ¿Qué pasa con los datos de mis clientes? · Se quedan donde deben, con contrato de encargado de tratamiento firmado y borrado cuando lo pidas. Te decimos qué herramienta toca qué dato, por escrito.
   - ¿Cuánto tarda en verse algo? · Lo primero funcionando en dos semanas. Resultados de venta, entre uno y tres meses. Quien te prometa ventas en treinta días te está vendiendo humo.
   - ¿Hay permanencia? · No. Mes a mes. Si un mes no te aportamos, lo dejas y te llevas todo lo montado, cuentas y accesos incluidos.
   - ¿No sé por dónde empezar, y eso me da vergüenza? · Es la respuesta más común que hay. Nadie te ha explicado nunca cómo aplicar esto a un negocio como el tuyo. Para eso son los veinte minutos.

7. **Precio honesto**
   - Antetítulo: LO QUE CUESTA
   - Titular: Los números, antes de que preguntes.
   - Tres bloques con rango real y qué incluye cada uno, más la línea: El diagnóstico de veinte minutos no cuesta nada y no lleva compromiso. Si después no te encaja, te quedas con lo que hemos visto.

8. **Cierre y CTA**
   - Titular: Cuéntanos qué te quita el tiempo.
   - Cuerpo: Escríbenos por WhatsApp con una frase. Te decimos en el momento si esto es para ti o si todavía no te hace falta.
   - Botón: Hablar por WhatsApp
   - Microcopy bajo el botón: Contesta una persona. Suele tardar menos de una hora en horario de oficina.

9. **Pie**
   - Nombre, la frase Dos naturalezas, un solo cuerpo, enlaces y aviso legal.
   - Divulgación, en positivo y a la vista: Las imágenes y el vídeo de esta página están generados con IA por nosotros mismos. Es la mejor carta de presentación que tenemos.

**Formulario:** no hay formulario. El CTA es un enlace directo a WhatsApp con el mensaje ya
escrito, que es lo que menos fricción tiene con la pyme española. No hay backend, así que
no hay nada que pueda fallar en silencio ni ningún dato que se quede en un limbo.

## 7. El plano de la capa vectorial

Todo dibujado a mano en SVG, todo respetando movimiento reducido (estado final visible,
motores parados).

- **La marca pía:** un óvalo partido por una línea irregular, la mitad tierra y la mitad ámbar. Es el logotipo del encabezado y el favicon, y se repite a tamaño diminuto como viñeta de lista.
- **La línea que se dibuja sola:** un trazo vertical que baja por el margen izquierdo de la página, cosiendo sección con sección, que se dibuja según se hace scroll. Es la trenza del vídeo, continuada en la página.
- **Separadores de mancha:** el borde irregular de la mancha pía, usado como separador entre secciones en vez de una línea recta.
- **Partículas a nivel de susurro:** polvo ámbar muy tenue flotando en las secciones oscuras, densidad baja, pausado por movimiento reducido.
- **Numeración del proceso:** cifras grandes en Space Mono con un contorno ámbar que se rellena al entrar en pantalla.

## 8. La lista de ingeniería

El héroe se construye al estándar completo: vídeo traído como Blob detrás de un anillo de
carga honesto, tiempo mostrado interpolado con lerp normalizado por delta de tiempo en un
bucle rAF que descansa, cada búsqueda de fotograma con verja para que no se solapen,
escritura al DOM solo cuando el valor cambia, ritmo de bandas con meseta larga validada
por el test de flick, sistema de legibilidad de cuatro capas (scrim local que se ahonda
solo con su banda, sombra real, contraste medido contra el PEOR fotograma, y colocación en
la zona más calmada), las cinco puertas del héroe estático vivas con sus listeners, y la
página completa y bonita aunque el vídeo no cargue nunca. Más el estándar de sitio entero
animado: SVG que se dibujan, partículas a nivel de susurro, entrada única por momento y
easing en todo.

## 9. La verja de copy

Toda la copy de arriba se monta literal. La página construida tiene que pasar la verja de
la Fase 9 antes de que la vea nadie: cero rayas largas, cero palabras de catálogo
(leverage, seamless, empower, unlock, robust, actionable, data-driven, solutions), y el
barrido de tics de IA en el cuerpo de texto. Los recursos deliberados de marca escritos en
este paquete (el tríptico "Dos naturalezas", el remate corto "Sin humo, sin permanencia")
son oficio y se quedan.
