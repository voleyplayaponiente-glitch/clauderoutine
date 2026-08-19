#!/bin/sh
#
# Copias de seguridad de Norte.
#
# OJO: este fichero está duplicado en el repositorio de la tienda
# (`bespain-umbrel-store/bespain-norte/copias.sh`), porque la ficha de una app
# de Umbrel no puede referirse a ficheros de otro repositorio. Si tocas uno,
# copia el otro.
#
# Corre en su propio contenedor, con la MISMA imagen de PostgreSQL que la base
# de datos: así `pg_dump` es exactamente de la versión del servidor, que es el
# motivo número uno por el que fallan los volcados en montajes caseros.
#
# Cada copia son dos ficheros con el mismo sello de tiempo:
#
#   norte-2026-08-19-0430.dump                 ← la base de datos (formato -Fc)
#   norte-2026-08-19-0430-documentos.tar.gz    ← los extractos y nóminas subidos
#
# Tres decisiones que conviene no deshacer:
#
#  1. **Se escribe a `.parcial` y se renombra al final.** Un volcado a medias
#     no puede llegar a parecerse a una copia buena; si el contenedor muere en
#     mitad del `pg_dump`, lo que queda es basura con nombre de basura.
#  2. **Cada copia se comprueba antes de darla por buena** (`pg_restore -l` y
#     `tar -tzf`). Un fichero de 0 bytes también «existe»: comprobarlo es la
#     diferencia entre tener copias y creer que se tienen.
#  3. **El estado se publica en `estado.json` y hay un latido cada pocos
#     minutos.** La app los lee y lo enseña en la pantalla de inicio. Una copia
#     que falla en silencio es peor que no tener copias, porque da la
#     tranquilidad sin dar el respaldo.
set -eu

BD_HOST=${NORTE_BD_HOST:-db}
BD_PUERTO=${NORTE_BD_PUERTO:-5432}
BD_USUARIO=${NORTE_BD_USUARIO:-norte}
BD_NOMBRE=${NORTE_BD_NOMBRE:-norte}

DESTINO=${NORTE_COPIAS_DIR:-/copias}
DOCUMENTOS=${NORTE_DOCUMENTOS_DIR:-/documentos}
PETICION=${NORTE_COPIAS_PETICION:-/peticion/copia-ahora}
HORA=${NORTE_COPIAS_HORA:-04:30}
DIARIAS=${NORTE_COPIAS_DIARIAS:-7}
MENSUALES=${NORTE_COPIAS_MENSUALES:-12}

ESTADO="$DESTINO/estado.json"
LATIDO="$DESTINO/.latido"
MARCA="$DESTINO/.ultimo-dia"
SELLO_OK="$DESTINO/.ultima-correcta"

export PGPASSWORD=${NORTE_BD_CONTRASENA:-}

decir() {
  echo "[copias $(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Los minutos desde medianoche. Se quitan los ceros a la izquierda a mano
# porque en aritmética de shell «08» es un octal inválido y aborta el script a
# las ocho de la mañana, que es la clase de fallo que solo se ve en producción.
minutos() {
  reloj=$1
  hh=${reloj%%:*}
  mm=${reloj##*:}
  echo $(( ${hh#0} * 60 + ${mm#0} ))
}

# ── Estado publicado ─────────────────────────────────────────────────────────

# Sin comillas ni barras: el mensaje se mete tal cual en un JSON escrito con
# printf, y un carácter suelto lo dejaría ilegible para la app.
limpiar_texto() {
  [ -n "${1:-}" ] || return 0
  echo "$1" | tr -d '"\\' | tr '\n' ' ' | cut -c1-300
}

publicar() {
  correcto=$1
  mensaje=$(limpiar_texto "${2:-}")

  ultimo=$(ls -1 "$DESTINO"/norte-*.dump 2>/dev/null | sort | tail -n 1 || true)
  nombre=""
  bytes=0
  if [ -n "$ultimo" ]; then
    nombre=$(basename "$ultimo")
    bytes=$(wc -c < "$ultimo" | tr -d ' ')
    documentos="${ultimo%.dump}-documentos.tar.gz"
    [ -f "$documentos" ] && bytes=$(( bytes + $(wc -c < "$documentos" | tr -d ' ') ))
  fi
  cuantas=$(ls -1 "$DESTINO"/norte-*.dump 2>/dev/null | wc -l | tr -d ' ')
  ultima=$(cat "$SELLO_OK" 2>/dev/null || echo "")

  if [ -n "$ultima" ]; then ultima="\"$ultima\""; else ultima="null"; fi
  if [ -n "$nombre" ]; then nombre="\"$nombre\""; else nombre="null"; fi
  if [ -n "$mensaje" ]; then mensaje="\"$mensaje\""; else mensaje="null"; fi

  printf '{"ultima":%s,"fichero":%s,"bytes":%s,"copias":%s,"ok":%s,"mensaje":%s}\n' \
    "$ultima" "$nombre" "$bytes" "$cuantas" "$correcto" "$mensaje" > "$ESTADO.parcial"
  mv "$ESTADO.parcial" "$ESTADO"
}

# ── Retención ────────────────────────────────────────────────────────────────

# Se guardan las últimas `DIARIAS` copias y, además, la más reciente de cada uno
# de los últimos `MENSUALES` meses. Todo se decide leyendo el nombre del
# fichero: sin llamar a `date` sobre cadenas, que es donde las variantes de
# `date` de cada imagen se comportan distinto.
podar() {
  orden=$(mktemp)
  guardar=$(mktemp)
  ls -1 "$DESTINO"/norte-*.dump 2>/dev/null | sort -r > "$orden"

  cuenta=0
  meses=""
  while read -r ruta; do
    [ -n "$ruta" ] || continue
    cuenta=$(( cuenta + 1 ))
    mes=$(basename "$ruta" | cut -c7-13)
    if [ "$cuenta" -le "$DIARIAS" ]; then
      echo "$ruta" >> "$guardar"
      # El mes de una copia diaria ya cuenta como cubierto: si no, la octava
      # copia de agosto se quedaría también «por ser la mensual de agosto».
      case " $meses " in *" $mes "*) ;; *) meses="$meses $mes" ;; esac
      continue
    fi
    case " $meses " in
      *" $mes "*) ;;
      *)
        if [ "$(echo $meses | wc -w)" -lt "$MENSUALES" ]; then
          meses="$meses $mes"
          echo "$ruta" >> "$guardar"
        fi
        ;;
    esac
  done < "$orden"

  while read -r ruta; do
    [ -n "$ruta" ] || continue
    if ! grep -Fxq "$ruta" "$guardar"; then
      rm -f "$ruta" "${ruta%.dump}-documentos.tar.gz"
      decir "Borrada copia antigua $(basename "$ruta")"
    fi
  done < "$orden"

  rm -f "$orden" "$guardar"
}

# ── La copia ─────────────────────────────────────────────────────────────────

copiar() {
  motivo=$1
  sello=$(date '+%Y-%m-%d-%H%M')
  volcado="$DESTINO/norte-$sello.dump"
  paquete="$DESTINO/norte-$sello-documentos.tar.gz"
  problemas=$(mktemp)

  decir "Copia $motivo: $(basename "$volcado")"

  if ! pg_dump -h "$BD_HOST" -p "$BD_PUERTO" -U "$BD_USUARIO" -d "$BD_NOMBRE" \
      --format=custom --compress=6 --file="$volcado.parcial" 2>"$problemas"; then
    rm -f "$volcado.parcial"
    publicar false "No se ha podido volcar la base de datos: $(tail -n 2 "$problemas")"
    decir "FALLO en pg_dump"
    cat "$problemas"
    rm -f "$problemas"
    return 1
  fi

  # Un volcado que no se puede listar no se puede restaurar. Mejor enterarse
  # ahora que el día que haga falta.
  if ! pg_restore --list "$volcado.parcial" >/dev/null 2>"$problemas"; then
    rm -f "$volcado.parcial"
    publicar false "El volcado ha salido ilegible: $(tail -n 2 "$problemas")"
    decir "FALLO al comprobar el volcado"
    rm -f "$problemas"
    return 1
  fi
  mv "$volcado.parcial" "$volcado"

  if [ -d "$DOCUMENTOS" ] && [ -n "$(ls -A "$DOCUMENTOS" 2>/dev/null)" ]; then
    if tar -czf "$paquete.parcial" -C "$DOCUMENTOS" . 2>"$problemas" &&
       tar -tzf "$paquete.parcial" >/dev/null 2>&1; then
      mv "$paquete.parcial" "$paquete"
    else
      rm -f "$paquete.parcial"
      # Los documentos son recuperables del banco; la base de datos no. Que
      # falle el paquete no invalida la copia, pero se dice.
      decir "AVISO: no se han podido empaquetar los documentos"
    fi
  fi

  date -u '+%Y-%m-%dT%H:%M:%SZ' > "$SELLO_OK"
  date '+%Y-%m-%d' > "$MARCA"
  podar
  publicar true ""
  decir "Copia terminada: $(wc -c < "$volcado" | tr -d ' ') bytes"
  rm -f "$problemas"
}

# ── Bucle ────────────────────────────────────────────────────────────────────

mkdir -p "$DESTINO" "$(dirname "$PETICION")"
decir "En marcha. Copia diaria a las $HORA (hora del contenedor), $DIARIAS diarias y $MENSUALES mensuales en $DESTINO"
publicar true ""

# Una instalación nueva no tiene por qué esperar a mañana para saber si esto
# funciona: la primera copia se hace al arrancar.
if [ -z "$(ls -1 "$DESTINO"/norte-*.dump 2>/dev/null)" ]; then
  decir "No hay ninguna copia todavía; haciendo la primera"
  copiar inicial || true
fi

vueltas=0
while :; do
  vueltas=$(( vueltas + 1 ))
  [ $(( vueltas % 5 )) -eq 1 ] && touch "$LATIDO"

  if [ -f "$PETICION" ]; then
    rm -f "$PETICION"
    copiar "a petición" || true
  elif [ "$(cat "$MARCA" 2>/dev/null || echo '')" != "$(date '+%Y-%m-%d')" ] &&
       [ "$(minutos "$(date '+%H:%M')")" -ge "$(minutos "$HORA")" ]; then
    # La condición es «hoy todavía no hay copia y ya ha pasado la hora», no
    # «son exactamente las 04:30». Así un reinicio a las 04:31 no se salta el
    # día entero, que es lo que le pasa a cualquier bucle que duerme hasta la
    # hora siguiente.
    copiar programada || true
  fi

  sleep 60
done
