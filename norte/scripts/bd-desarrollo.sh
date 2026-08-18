#!/usr/bin/env bash
# Levanta un PostgreSQL de usar y tirar para desarrollo y tests.
#
# Pensado para entornos efímeros (contenedores de Claude Code, CI local) donde
# no hay demonio de Docker y el servicio se pierde entre sesiones. Para el
# Umbrel NO se usa esto: allí PostgreSQL es un contenedor de verdad.
#
#   norte/scripts/bd-desarrollo.sh          # arranca y crea norte_dev y norte_test
#
# Va sin `fsync` a propósito: es una base de datos que se puede perder entera
# sin consecuencias, y en disco lento la diferencia es de minutos a segundos.
set -euo pipefail

PG_BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
DATOS=${DATOS:-/var/lib/postgresql/norte}
PUERTO=${PUERTO:-5433}

if [ ! -d "$DATOS/base" ]; then
  echo "→ Creando el cluster en $DATOS"
  mkdir -p "$DATOS"
  chown -R postgres:postgres "$(dirname "$DATOS")"
  chmod 700 "$DATOS"
  su postgres -c "$PG_BIN/initdb -D $DATOS -U norte --auth=trust -E UTF8" >/dev/null
fi

if su postgres -c "$PG_BIN/pg_ctl -D $DATOS status" >/dev/null 2>&1; then
  echo "→ Ya estaba arrancado"
else
  su postgres -c "$PG_BIN/pg_ctl -D $DATOS -l $DATOS/log.txt -o '-p $PUERTO -k /tmp \
    -c fsync=off -c synchronous_commit=off -c full_page_writes=off' start" >/dev/null
  sleep 2
  echo "→ Arrancado en el puerto $PUERTO"
fi

for base in norte_dev norte_test; do
  if ! su postgres -c "$PG_BIN/psql -h 127.0.0.1 -p $PUERTO -U norte -lqt" | cut -d'|' -f1 | grep -qw "$base"; then
    su postgres -c "$PG_BIN/createdb -h 127.0.0.1 -p $PUERTO -U norte $base"
    echo "→ Creada $base"
  fi
done

echo
echo "Listo. En norte/api/.env:"
echo "  DATABASE_URL=\"postgresql://norte@127.0.0.1:$PUERTO/norte_dev\""
echo "  DATABASE_URL_TEST=\"postgresql://norte@127.0.0.1:$PUERTO/norte_test\""
