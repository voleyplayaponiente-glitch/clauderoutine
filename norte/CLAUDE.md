# CLAUDE.md — Norte (control presupuestario personal)

Memoria del proyecto. Léelo al empezar cualquier sesión que toque `norte/`.

## Qué es
Aplicación web **en español** de **control presupuestario personal y compartido**,
pensada además para **venderse a terceros** (autoalojada, SaaS o App Store).
Lee documentos bancarios y **nóminas**. Estética Apple, claro y oscuro reales.

- **Plan completo y decisiones de producto:** `../PLAN_NORTE.md`
- **Encargo original del usuario:** prompt «Núcleo» (se renombró a **Norte**).
- **Repo:** voleyplayaponiente-glitch/clauderoutine · carpeta `norte/`
- **Rama de desarrollo:** `claude/app-control-presupuestario-f7omzh`
- **Convive con** la app de vóley (raíz) y `finanzas/` (empresa). **No se tocan.**

## LA decisión de arquitectura, y por qué es distinta de `finanzas/`
`finanzas/` y el vóley son *client-first* con IndexedDB. **Norte no.** Guarda en
**PostgreSQL en el servidor**, y el navegador es solo una ventana.

No es un cambio de gusto: el 11/08/2026 se perdieron los datos de tres empresas
en `finanzas/` porque vivían en el navegador, y de ahí salió todo el aparato de
copias del Umbrel. El usuario lo pidió tal cual: *«para que no tengamos los
problemas de siempre con el borrado de datos»*. Si alguna vez se plantea meter
IndexedDB como almacén principal aquí, **no**: caché sí, verdad no.

Otras dos derivas del prompt original, decididas y justificadas:
- **Supabase → PostgreSQL propio**: se vende para autoalojar, no puede depender
  de la cuenta de nadie. Las RLS se sustituyen por el guardián de `acceso.ts`
  **con tests de fuga**, que además son comprobables sin proveedor.
- **Next.js → Vite + React**: no hay nada que renderizar en servidor (es una
  herramienta tras login) y el pipeline Vite → nginx → GHCR → tienda de Umbrel
  ya estaba montado y sufrido en este repo.

## Comandos
```bash
cd norte
npm install
npm run dev            # API en :3012 + interfaz en :5173 (Vite reenvía /api)
npm test               # motor (81) + API (62) = 143 tests
# Si no hay PostgreSQL (contenedor nuevo): norte/scripts/bd-desarrollo.sh
npm run test:dominio   # solo el motor, sin base de datos
npm run build          # dominio + api + app
npm run migrar         # prisma migrate dev
npm run semilla        # usuario demo@norte.local
```

## Arquitectura
- `dominio/` — **motor puro, sin React ni Prisma**. Aquí vive lo que se puede
  probar sin levantar nada: `dinero` (céntimos, `repartir`, `parsearImporte`),
  `roles`, `espacios` (**`decidirAcceso`**, `esCuentaVisiblePara`),
  `contrasenas`, `categorias-defecto`, y `documentos/` (lectura de extractos y
  nóminas: tabla, texto de PDF, Norma 43, enmascarado de tarjetas y huellas).
- `api/src/documentos/` — **lo único que sabe de formatos**: ZIP, `.xlsx`,
  BIFF8/OLE2 (`.xls`), PDF y CSV. Convierte bytes en cuadrícula o en texto; lo
  que sale de ahí ya es vocabulario del dominio.
- `api/` — Fastify + Prisma. `acceso.ts` es **el guardián**: toda ruta que toca
  datos de un espacio pasa por `exigirEspacio`. `servidor.ts` se construye por
  inyección (prisma + configuración) para que los tests levanten la API entera
  contra otra base de datos.
- `app/` — React 19 + Vite + Tailwind v4. Solo pinta. TanStack Query para datos
  de servidor, Zustand **solo** para estado de interfaz (tema, espacio activo).

## Reglas que no se negocian
- **El dinero es un entero de céntimos.** `BigInt` en la base, `number` en el
  dominio con `comprobarCentimos`. Ni un `float`, tampoco «solo para mostrar».
- **Todo lo de un espacio lleva `espacioId`** y se filtra por el del **contexto**
  devuelto por `exigirEspacio`, nunca por el de la URL sin comprobar.
- **A quien no es miembro se le responde 404, no 403.** Un 403 confirmaría que
  el espacio existe. A un miembro con rol corto sí se le dice la verdad.
- **Nada se borra**: `borradoEn` y papelera de 30 días.
- **Nunca se guarda el IBAN completo ni el número de tarjeta.** Alias y últimos 4.
- Contraseñas con **Argon2id** (19 MiB / t=2 / p=1, mínimos de OWASP). Las
  sesiones se guardan como **HMAC del testigo**, no como el testigo.
- El mismo mensaje para «ese correo no existe» y «esa contraseña no es»; y un
  hash señuelo en el camino del correo inexistente para que los tiempos no
  delaten quién tiene cuenta.

## Cosas que ya costaron caras en este repositorio (no repetirlas)
- **nginx no conoce `.mjs` ni `.webmanifest`.** Sin forzar el tipo, el navegador
  se niega a ejecutar el worker de pdf.js y **no se puede leer ningún PDF**
  servido desde el Umbrel, aunque en GitHub Pages funcione. `nginx.conf` nace
  con las dos reglas. Verificado aquí **levantando nginx de verdad** y con el
  control negativo (quitando la regla sale `application/octet-stream`).
  `python3 -m http.server` sirve `.mjs` bien y por eso miente.
- **Entregar no es empujar**: después de cada push a la rama, comprobar que
  `imagen-norte.yml` acabó en verde antes de decirle al usuario que actualice.
  Publicar dos imágenes en cada despliegue disparó el límite secundario de
  GitHub en `finanzas/`; por eso `norte-api` solo se reconstruye si cambian
  `api/` o `dominio/`.
- **El `docker-compose.yml` lleva `name: norte` y no se quita.** Sin esa línea
  Compose deduce el nombre del proyecto de la carpeta (`umbrel`) y **choca con
  el proyecto del propio umbrelOS**: empieza a ver `auth` y `tor_proxy` como
  huérfanos suyos, y un `down --remove-orphans` ahí dentro se llevaría piezas
  del sistema del usuario. Salió en la primera instalación real (17/08/2026).
- **Las imágenes nuevas de GHCR nacen privadas** y `docker compose pull` falla
  con `denied`. Comprobado el 17/08/2026: `norte-web` salió pública pero
  `norte-api` **privada**. Hay que ponerlas públicas a mano una vez en
  Settings → Packages. Se verifica sin instalar nada pidiendo el manifiesto a
  `ghcr.io/v2/<usuario>/<imagen>/manifests/latest` con un token anónimo.
- **`npm --prefix <dir> exec` NO entra en la carpeta**: `prisma generate`
  buscaba el esquema en la raíz del monorepo y la imagen del servidor no se
  construía. Se usa `npm run -w <paquete>`, que sí entra.
- **Los tests de la API no arrancan sin `@norte/dominio` compilado ni sin
  `prisma generate`.** Lo tapaba tener el `dist/` de una sesión anterior; en un
  clon limpio se caían. Está resuelto en el `pretest` de `api`. Lección: antes
  de dar por bueno un CI, **clonar en limpio y correr la misma secuencia**.
- **Un «no se pudo leer» ante un fichero legible es una mentira por omisión.**
  Cuando llegue la fase 3, el buzón de documentos debe decir *qué* es el fichero
  y *adónde* va, nunca mandar a la pantalla equivocada ni callarse.
- **NO hay service worker en la instalación del usuario, y es por diseño del
  navegador.** Los service workers solo van en https o en localhost; Norte se
  sirve por `http://192.168.1.20:3012`, donde `navigator.serviceWorker` **ni
  existe** (comprobado en Chromium contra una IP de red: `isSecureContext:
  false`). Consecuencias: allí **no se puede instalar como PWA** y **cualquier
  aviso basado en el service worker es código muerto**. Se llegó a escribir uno
  con `useRegisterSW` antes de comprobarlo; por eso está esta nota.
- **El aviso de versión nueva va por `version.json`** (`vite.config.ts` sella
  cada compilación, el componente `AvisoVersion` pregunta al volver a la pestaña
  y cada 15 min). Funciona en http plano. `nginx.conf` lo sirve con `no-store`:
  cacheado, el aviso no se enteraría nunca. Probado simulando un despliegue
  contra la IP de red.

## Estado — fases 1 a 5 cerradas (316 tests en verde: 203 dominio + 113 API)
Hecho: monorepo, **esquema completo** (37 modelos: cuentas, movimientos,
documentos, nóminas, presupuestos, deudas, tarjetas, inversiones, repartos,
liquidaciones, patrimonio, licencias), migración inicial, registro/entrada con
Argon2id y cookie httpOnly, **aislamiento entre espacios con 13 tests de fuga**,
límite de intentos en la puerta, tokens de diseño (claro y oscuro diseñados por
separado), muestrario de componentes en `/#/muestra`, Dockerfiles, compose para
Umbrel y workflow de imágenes.

Verificado en navegador (Chromium, capturas en la conversación): registro real,
sesión que sobrevive a recargar, los dos temas, 375 px sin desbordamiento
horizontal y sin errores de consola.

## INSTALADA Y VERIFICADA POR EL USUARIO (17/08/2026, 22:12)
Corre en su Umbrel en **`http://192.168.1.20:3012`**. Cuenta creada
(`julionietocristobal@gmail.com`), espacio Personal con sus categorías, la
pantalla de inicio pintada y sin errores. Es donde vive; sus datos están ahí.

- Instalación **manual** (clone en `~/norte-app`), no por la tienda de Umbrel
  todavía. Falta la ficha en `bespain-umbrel-store` para que tenga icono en el
  escritorio como las otras dos apps.
- **Los datos están en `~/norte-datos`** (`postgres/` y `documentos/`), fuera de
  la carpeta del código a propósito: actualizar o volver a clonar no los toca.
  **Esa es la carpeta que hay que respaldar.**
- Su `.env` (contraseña de Postgres y secreto de sesión) está solo en el Umbrel.
  No hay copia en ningún otro sitio.
- **Copias de seguridad: hechas y automáticas desde el 19/08/2026** (ver más
  abajo). Antes de eso solo había un `pg_dump` documentado que nadie ejecutaba.

## El registro está CERRADO (18/08/2026)
La primera cuenta de una instalación es libre; a partir de ahí **solo se entra
con invitación**. Sin panel de ajustes y sin interruptor: un interruptor es algo
que alguien puede dejar abierto sin enterarse.
- `dominio/registro.ts` decide (`decidirRegistro`), con sus tests. El servidor
  solo va a buscar la invitación y traduce el «no» a un 403.
- Invitación = enlace de **un solo uso**, caduca a los **7 días**, anulable, y
  opcionalmente atada a un correo. En la base de datos se guarda el **HMAC** del
  testigo, no el testigo, igual que las sesiones.
- El testigo viaja en el **fragmento** (`#/invitacion/…`), que el navegador no
  manda al servidor, y las consultas van por **POST con el testigo en el cuerpo**:
  Fastify registra la URL de cada petición y en la ruta acabaría en los logs.
- `marcarInvitacionUsada` va con `updateMany` filtrando por `aceptadaEn: null`:
  es un pulso atómico. Con `findUnique` + `update` habría un hueco por el que
  dos personas usarían el mismo enlace a la vez.
- **El ayudante `registrar()` de los tests cambió**: solo la primera cuenta pasa
  por la API; las demás se crean por dentro y entran por `/auth/entrar`. Si un
  test nuevo necesita registrar de verdad, mira `test/registro.test.ts`.
- Verificado en navegador con dos personas: alta de Julio, espacio «Casa»,
  enlace, alta de Marta ya dentro de Casa, y el mismo enlace rechazado después.

## Fase 2 cerrada (18/08/2026): cuentas, movimientos, recurrentes y Cmd+K
- **`Ctrl/Cmd + K`** con lenguaje natural. La frase se interpreta **en el
  navegador** con `dominio/lenguaje-natural.ts`, el mismo motor que los tests:
  la vista previa se actualiza al teclear y lo que se ve es lo que se guarda.
- **Lo previsto NO toca el saldo, y tampoco el resumen.** El saldo lo excluía
  desde el principio, pero el resumen de Movimientos lo sumaba a los gastos:
  decía «has gastado 1.703 €» cuando 1.700 eran el alquiler del mes que viene.
  Se vio mirando la pantalla, no en los tests. Ahora van en líneas separadas.
- Generar previstos es **idempotente** (`idExterno = recurrente:<id>:<fecha>` +
  índice único). Pensado para que un día lo dispare un temporizador.
- La privacidad de cuentas está cableada en cuentas, movimientos Y recurrentes:
  una cuenta no compartida no aparece ni filtrando por su id.

## Fase 3 cerrada (19/08/2026): documentos

**Un solo buzón** (`/#/documentos`): se suelta el fichero y la app decide qué es
y cómo leerlo. Nada entra en las cuentas sin pasar por la pantalla de revisión.

Escrito **contra cuatro ficheros reales del usuario** (dos extractos del mismo
banco en `.xls` y PDF, un extracto del BBVA en `.xlsx` y una nómina de su
empresa). Los cuatro se leen enteros y bien. Lo que enseñaron:

- **La tabla nunca empieza en A1.** Un extracto tenía la cabecera en la fila 5
  con la columna A vacía; el otro, en la fila 8. Se busca la fila de cabecera y
  se traducen las columnas **por nombre**, nunca por posición.
- **La descripción viene repartida en varias columnas** («Concepto»,
  «Movimiento», «Observaciones»), a veces repetida palabra por palabra. Se
  juntan quitando las repetidas.
- **Un extracto real trae el número de tarjeta completo dentro del concepto.**
  `documentos/sensibles.ts` lo tapa **antes** de que el texto salga del motor;
  se comprueba con Luhn para no censurar un «Adeudo nº …» que no es una tarjeta.
  El fichero original sí se guarda entero: es suyo y está en su máquina.
- **En un PDF no hay líneas, hay fragmentos con coordenadas.** Se agrupan por
  altura **con holgura (2,5 pt)**: el guion de «01/07/2026 - 31/07/2026» de la
  nómina va dibujado dos décimas más abajo que las fechas, y agrupando por Y
  exacta el periodo de liquidación se perdía. Además el concepto se parte en dos
  líneas, con la continuación colgando de la que empieza por «Fecha valor:».
- **La nómina se lee por aritmética, no por posición**: se busca la pareja de
  números contiguos cuya resta da el líquido. Es una comprobación, no una
  adivinanza; si no cuadra, devuelve `null` y lo dice. En el recibo real la
  palabra «líquido» no aparece en ninguna parte: la cifra está marcada con «€».
- **Norma 43 (`.q43`)** implementado desde la especificación de la AEB. Es el
  formato bueno —importes ya en céntimos y signo explícito— y la interfaz lo
  recomienda en voz alta.

Decisiones que conviene no deshacer:
- **Los formatos se leen sin librería de hojas de cálculo.** La única versión de
  SheetJS que hay en el registro público de npm (0.18.5) arrastra dos
  vulnerabilidades sin parchear, y esto procesa ficheros que llegan de fuera.
  `api/src/documentos/` trae un lector de ZIP (con el `inflate` de Node), otro
  de `.xlsx` y otro de **BIFF8 dentro de OLE2** para los `.xls` antiguos —que es
  justo lo que descarga uno de sus bancos—. Del PDF sí se encarga `pdfjs-dist`,
  **fijado a ≥ 6.2.108**: las versiones anteriores tienen ejecución de código al
  abrir un PDF preparado.
- **La lectura no se guarda: se rehace en cada consulta.** Es determinista, y
  así una mejora del lector se nota en los documentos ya subidos sin volver a
  subirlos.
- **Huella estable por apunte** (`fecha|importe|concepto normalizado` + ordinal
  para los repetidos del mismo día) guardada en `idExterno`. Sale la misma
  desde el `.xls` y desde el PDF del mismo banco —comprobado con los ficheros
  reales, 6 de 6—, así que subir los dos no duplica nada. Aplicar dos veces
  tampoco: `createMany` con `skipDuplicates` sobre el único (cuenta, idExterno).
- **Los ficheros van a disco, no a la base de datos.** El backup de PostgreSQL
  tiene que ser pequeño y frecuente; un PDF por columna lo engorda para siempre.
- **En los tests no hay datos reales de nadie.** Las cuadrículas y los textos
  reproducen la maquetación exacta de los ficheros del usuario, pero con
  nombres, cuentas e importes inventados —y en la nómina, inventados **de forma
  que la resta siga cuadrando**, porque si no la prueba no probaría nada.

## Copias de seguridad automáticas (19/08/2026)

Un cuarto contenedor, `copias`: `postgres:16-alpine` **con el guion dentro**
(`Dockerfile.copias` → `ghcr.io/…/norte-copias`). Que sea la misma base que la
base de datos garantiza que `pg_dump` es exactamente de la versión del
servidor, que es la causa número uno de volcados que fallan en montajes
caseros; y las capas ya están descargadas por el servicio `db`, así que la
imagen no pesa nada.

### El guion NO se monta desde el disco (lección cara, 19/08/2026)

El primer intento montaba `./copias.sh:/copias.sh:ro`. En la instalación de la
tienda **no funciona**, por dos motivos que hay que recordar:

1. **umbreld solo copia `docker-compose.yml` y `umbrel-app.yml`** a
   `~/umbrel/app-data/<app>/`. Cualquier otro fichero de la carpeta de la app
   en el repositorio de la tienda **no llega al Umbrel**.
2. **Las rutas relativas del compose se resuelven desde el directorio de
   umbreld**, no desde el de la app. El `docker inspect` lo enseñó:
   `/opt/umbreld/source/modules/apps/legacy-compat/copias.sh -> /copias.sh`.

Resultado: Docker creaba un **directorio vacío** llamado `copias.sh`, `sh` no
leía ninguna línea y el contenedor salía con **código 0** — sin error, sin log,
sin copias. El síntoma engañoso es ese `Exited (0)`: parece que terminó bien.

Regla que se deriva: **en una app de la tienda de Umbrel, todo lo que no sea el
compose o la ficha tiene que ir dentro de una imagen.** Rutas absolutas con
`${APP_DATA_DIR}` sí funcionan (los volúmenes de datos se montaron bien).

Decisiones que sostienen el diseño:
- **Se escribe a `.parcial` y se renombra al final.** Un volcado interrumpido no
  puede llegar a parecerse a una copia buena.
- **Cada copia se comprueba** (`pg_restore --list` y `tar -tzf`) antes de darla
  por buena. Un fichero de 0 bytes también «existe».
- **El estado se publica** en `copias/estado.json` y hay un **latido** cada 5
  minutos. La app lo lee y lo enseña **en la pantalla de inicio**: una copia que
  falla en silencio es peor que no tener copias, porque da la tranquilidad sin
  dar el respaldo. El latido es lo que distingue «todo bien» de «el contenedor
  murió después de escribir que todo iba bien».
- La condición del temporizador es «hoy todavía no hay copia **y** ya ha pasado
  la hora», no «son las 04:30»: un reinicio a las 04:31 no se salta el día.
- **Retención por nombre de fichero**, sin aritmética de fechas: 7 diarias + la
  más reciente de cada uno de los últimos 12 meses. Se decide leyendo el nombre
  porque `date -d` sobre cadenas se comporta distinto en cada imagen.
- En el shell del contenedor, `$(( 08 * 60 ))` es un **octal inválido** y
  abortaría el script a las ocho de la mañana. Los ceros a la izquierda se
  quitan a mano en `minutos()`.
- La API monta la carpeta de copias en **solo lectura**; para el botón «hacer
  una copia ahora» hay un segundo volumen minúsculo donde deja una señal que el
  servicio recoge en menos de un minuto. Un fallo de la API no puede borrar el
  respaldo, y no hace falta meter `pg_dump` en la imagen de Node (Debian
  bookworm trae el cliente 15, que **se niega** a volcar un servidor 16).
- `GET /api/copias` y `POST /api/copias/ahora` son **solo para el dueño de la
  instalación** = el usuario más antiguo, que es el único que pudo crearse sin
  invitación. No hay rol de administrador todavía y no hacía falta inventarlo.

Verificado de verdad, no solo con tests: se volcó una base con datos reales de
la app, se restauró en otra vacía y se comprobó que vuelven las mismas filas
(usuarios, espacios, cuentas, movimientos, documentos y las 69 categorías). La
retención se probó con 28 copias falsas repartidas por 13 meses y dejó
exactamente las 18 esperadas.

### La segunda copia, en un disco externo (19/08/2026)

El mismo servicio lleva cada copia a un disco conectado al Umbrel. Se monta
`/media` del host en `/externo`, no un disco concreto, para que valga
cualquiera.

- **La marca no basta: se comprueba que sea OTRO disco.** `df -P` del destino y
  del origen; si el dispositivo es el mismo, no se copia nada y se dice por qué.
  Salió del uso real: al montar el disco, el `mount` falló (no había disco
  conectado) pero el `mkdir` de la marca sí se ejecutó, y quedó una carpeta
  `norte-copias` **sobre el disco interno del Umbrel**. Sin esta comprobación, la
  app habría dicho «copia en el disco externo» copiando sobre el mismo disco que
  intenta proteger — la peor clase de mentira, la que se descubre el día que se
  estropea el disco. La comprobación **falla abierta**: si `df` no dijera nada,
  se copia igual, porque el riesgo de dejar de copiar a un disco bueno es peor.
- **La marca `norte-copias` es obligatoria y es el corazón del diseño.** Solo se
  escribe dentro de un directorio que contenga una carpeta con ese nombre. Es lo
  único que distingue «el disco está conectado» de «el disco no está y Docker ha
  creado un directorio vacío con el mismo nombre»; sin la marca, el servicio
  llenaría el disco de sistema del Umbrel creyendo que manda las copias fuera.
  De paso funciona como permiso explícito.
- **En el disco externo no se borra nada.** La rotación es cosa del Umbrel; el
  archivo de fuera es de solo añadir, para que ningún fallo de aquí lo vacíe.
- Se copia con `cp` y se **compara el sha256** antes de renombrar: en un USB,
  `cp` puede volver sin error dejando el fichero a medias. Y se llama a `sync`,
  porque si no lo escrito se queda en la caché y desenchufar se lo lleva.
- `vistoAlgunaVez` (un fichero `.externo-visto`) permite distinguir «aquí nunca
  hubo disco» de «el disco estaba y alguien lo desenchufó hace tres semanas».
  Sin eso, la pantalla no puede avisar de lo segundo, que es lo que de verdad
  pasa.
- Se comprueba el sitio libre antes de escribir: llenar el disco del todo deja
  copias a medias.
- **Un *bind mount* no ve los discos montados DESPUÉS de arrancar el
  contenedor.** Se decidió no usar `propagation: rslave` para no arriesgar que
  el servicio no arranque en su máquina; a cambio, hay que reiniciar la app tras
  conectar un disco, y la propia app lo dice.
- El montaje de `/media` **sí** funciona porque es una ruta absoluta; lo que
  falla en la tienda son las relativas (ver arriba).

Un fallo que solo apareció al ejecutarlo de verdad: `pg_dump` mete un
**tabulador** en sus mensajes de error, y un tabulador crudo dentro de una
cadena JSON la invalida. El `estado.json` se volvía ilegible justo cuando había
un fallo que contar. `limpiar_texto` quita ahora todos los caracteres de
control.

Verificado restaurando **desde el fichero que había viajado al disco externo**,
no solo desde el local. Y probados los cinco casos: sin disco, disco sin marcar
(no se escribe nada), disco marcado, segunda vuelta sin recopiar, y disco
desconectado después de haberlo usado.

Lo que **sigue sin cubrir**: si el disco externo vive enchufado al Umbrel, un
robo o un incendio se lleva las dos copias. Una tercera fuera de casa (otra
máquina, o cifrada en la nube) sigue pendiente.

## Fase 4 cerrada (19/08/2026): presupuesto por sobres

`/#/presupuesto`. La pantalla gira alrededor de **una sola cifra**: lo que queda
sin repartir. Mientras no sea cero hay dinero sin un trabajo asignado, y ese es
el método entero.

- **Las cuentas se calculan al vuelo** desde los movimientos. En la base solo se
  guarda lo que el usuario decide: cuánto asigna y si arrastra. Guardar el gasto
  agregado sería tener dos verdades sobre lo mismo, y la copia siempre es la que
  se queda vieja. Lo único que se persiste calculado es la **foto del cierre**
  (`periodos_presupuesto`), para que el histórico no cambie si mañana se corrige
  un movimiento viejo.
- **El ritmo manda sobre el total.** «Llevas el 60 % de la compra» no dice nada;
  el día 10 es una alarma y el día 28 una buena noticia. Cada barra lleva la
  marca del día del mes y hay 5 puntos de margen antes de avisar.
- **El gasto por día descuenta lo previsto.** Se vio en pantalla, no en los
  tests: el sobre de vivienda con 750 € y el alquiler domiciliado sin pasar
  decía «750 € disponible, 58 €/día». Gastarlos habría dejado el recibo al
  descubierto. Ahora `porDia` sale de `disponibleTrasPrevisto` y la fila nombra
  lo previsto.
- **Los ingresos solo cuentan si están clasificados como ingreso.** En un
  extracto real, un traspaso de 5.000 € entre cuentas propias entra como apunte
  positivo; sumarlo daría un presupuesto con miles de euros que no existen. Si
  no hay nada clasificado, sale cero y la pantalla explica por qué. Hay test.
- **El arrastre lleva lo que sobra Y lo que falta.** Arrastrar solo lo bueno
  convierte el presupuesto en un marcador amable.
- **La propuesta usa la mediana** en variables y discrecionales (la revisión del
  coche no puede volverse el presupuesto mensual de transporte) y **el último
  mes** en los fijos (un recibo no es una distribución). Cada propuesta viaja
  con su `base`, para que la pantalla pueda decir de dónde sale el número.
- El presupuesto respeta la **visibilidad de cuentas**: en un espacio
  compartido no puede ser la puerta de atrás para ver el gasto de la cuenta
  privada de otro. Hay test.

Dos cosas que solo aparecieron **mirando la pantalla en el navegador**:
1. **El padre también es un sobre.** La primera versión solo pintaba las hojas,
   y como el juego de categorías por defecto tiene gasto directamente en «Ocio»
   o «Vivienda», la pantalla llegó a decir «1 sobre pasado» sin que se pudiera
   ver cuál.
2. **Cuarenta sobres a cero son una hoja de cálculo, no una pantalla.** Se
   enseñan los que están en uso y el resto queda tras un botón; en un espacio
   recién creado se enseñan todos.

Y un fallo que **arrastraban todas las pantallas**: con cinco pestañas, la barra
de navegación ya no cabía en 375 px y **empujaba el ancho del documento entero**.
Se arregló con `overflow-x-auto` en la barra y dejando encoger los selectores de
la cabecera. Medido con Playwright: `scrollWidth` 375 en las cuatro pantallas.

Pendiente de la fase: los métodos `base_cero` y `50-30-20` del enum
`MetodoPresupuesto` siguen sin implementar; hoy todo es `sobres`.

## Fase 5 cerrada (19/08/2026): deudas y tarjetas

`/#/deudas`. Es la fase con más fórmulas y la que más tests tiene.

**Las cifras esperadas de los tests están calculadas aparte, con aritmética
decimal exacta en Python, no sacadas de la propia implementación.** Un test que
compara el código consigo mismo solo prueba que no ha cambiado. Referencias
usadas: 150.000 € al 3 % a 360 meses → cuota 632,41 € e intereses 77.665,33 €;
12.000 € al 7,5 % a 60 → 240,46 €; TAE de un TIN del 20 % → 21,9391 %;
3.000 € al 24 % con mínimo del 3 % y suelo de 30 € → 159 meses y 7.436,34 €.

- **Todo en céntimos y redondeando en CADA periodo**, que es lo que hace un
  banco. Calcular en euros y redondear al final da cuadros que no cuadran con
  el recibo. **La última cuota se ajusta** para cerrar exactamente en cero.
- Sistemas **francés, alemán y americano**. Con interés cero la fórmula
  francesa se indefine: se trata aparte, porque un préstamo familiar al 0 % es
  un préstamo, no un caso raro.
- **La comisión se resta del ahorro.** Un simulador que enseña «te ahorras
  8.400 €» y esconde los 500 € de comisión está vendiendo, no informando. La
  pantalla enseña **siempre las dos opciones juntas** —reducir plazo y reducir
  cuota— porque elegir sin ver las dos cifras no es elegir.
- `mesesParaCuota` **lanza** si la cuota no cubre ni los intereses, en vez de
  devolver `NaN` y dejar que se convierta en un cuadro imposible más abajo.
- **Avalancha vs bola de nieve** simuladas mes a mes, con los mínimos de las
  deudas ya liquidadas reinvertidos. Si en un mes entero la deuda total no baja,
  se devuelve `meses: null`: la respuesta honesta no es un número grande, es
  «así esto no se acaba».
- **Revolving**: el interés se devenga ANTES de calcular el mínimo, como en los
  contratos (por eso el 3 % de 3.000 € da 91,80 € y no 90). Y cuando la cuota no
  supera al interés se dice «nunca se liquida» y **cuánto haría falta** para que
  empiece a bajar.
- **El cuadro no se guarda: se calcula** desde el préstamo más las
  amortizaciones registradas. `cuadro_amortizacion` queda libre para cuando
  lleguen las revisiones de tipo variable, donde ya no se deduce de un solo tipo.
- Las tarjetas cuelgan de una cuenta `tarjeta_credito`, así que **el consumo del
  ciclo se calcula** de los movimientos. El número que casi ninguna app enseña y
  que aquí va en grande: **cuántos días de financiación gratis te quedan si
  compras hoy**.

Detalle de calendario que importa: el día de pago es **la primera vez que llega
ese día después del corte**, no «el mes siguiente». Con corte el 25 y pago el 5
es el 5 del mes que viene; con corte el 5 y pago el 25, el 25 del mismo mes. Y
un corte el 31 cae el último día de los meses que no lo tienen.

Verificado en navegador: simulador de amortización, registro real de una
amortización (5.190 € de interés ahorrado) y simulador de revolving. Cuando la
deuda más pequeña es además la más cara, las dos estrategias coinciden y **la
pantalla lo dice** en vez de enseñar dos cuadros idénticos, que parecería un
fallo.

Pendiente de la fase: las revisiones de tipo variable (hoy el cuadro se calcula
con el tipo actual y la pantalla avisa de que es la foto de ahora), y los ciclos
de tarjeta persistidos (`ciclos_tarjeta` sigue sin usarse).

## Por dónde seguir
1. **Fase 6 — Inversiones**: cartera, TWR y TIR (XIRR por Newton-Raphson con
   respaldo de bisección, y `null` si no converge), asignación objetivo y aviso
   de rebalanceo con umbral de ±5 pp.
2. La semilla debe crecer con cada fase hasta los **18 meses de histórico** que
   pide el encargo. Hoy solo crea usuario, espacios y categorías.
3. Una tercera copia **fuera de casa** (otra máquina o almacenamiento cifrado
   remoto). El disco externo protege del disco roto, no del robo ni del fuego.
4. Limpieza pendiente en el Umbrel: `~/norte-app` y `~/norte-datos` son la
   instalación manual vieja, ya sustituida por la de la tienda.

## Decisiones abiertas (no decidir por él)
- **Canal de venta**: recomendado empezar por autoalojada + web (0 % de
  comisión) y dejar la App Store (15–30 % + 99 $/año) para cuando la pida un
  cliente. Sin confirmar.
- **Puerto 3012** en su Umbrel: elegido por descarte (3000 laboral, 3011
  finanzas), **pendiente de comprobar con `ss -lntp`** en su máquina.
