#!/bin/sh
# Starts as root only to hand the data folder to `bun`, then drops privileges
# for good before the server runs.
#
# Railway mounts the volume over /app/data owned by root, which hides the
# folder the image prepared, so `USER bun` alone leaves SQLite unable to create
# (or write) data/tcp-trip.sqlite and every route that touches the database
# answers 500 with SQLITE_CANTOPEN.
set -eu

DATA_DIR="$(dirname "${DATABASE_PATH:-/app/data/tcp-trip.sqlite}")"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R bun:bun "$DATA_DIR"
  exec setpriv --reuid=bun --regid=bun --init-groups -- "$@"
fi

exec "$@"
