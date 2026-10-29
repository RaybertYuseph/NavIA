#!/usr/bin/env bash
# Prueba las migraciones y el seed en un Postgres 16 temporal, sin Docker ni Supabase.
# Uso: npm run db:test   (requiere initdb/pg_ctl de Postgres 15+ en el PATH o en /usr/lib/postgresql/16/bin)
set -euo pipefail
cd "$(dirname "$0")/../.."
PGBIN=${PGBIN:-$(dirname "$(command -v initdb 2>/dev/null || echo /usr/lib/postgresql/16/bin/initdb)")}
TMP=$(mktemp -d)
PORT=${PORT:-55432}
trap '"$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c timezone=UTC" -l "$TMP/log" start -w >/dev/null
PSQL=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f supabase/tests/stub_auth.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f supabase/seed.sql
for t in supabase/tests/corte*.test.sql; do "${PSQL[@]}" -f "$t"; done
echo "OK: migraciones, seed y pruebas"
