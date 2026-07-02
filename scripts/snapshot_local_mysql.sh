#!/usr/bin/env bash
#
# snapshot_local_mysql.sh
# -----------------------
# Dump ALL local app MySQL databases (global + every tenant DB) into ONE
# self-contained, portable .sql file you can move to another machine and
# restore in a single command.
#
# The dump uses `mysqldump --databases`, so it embeds `CREATE DATABASE IF NOT
# EXISTS` + `USE` for each DB — the target machine does NOT need the databases
# pre-created.
#
# Connection details are read from flutter-server/.env (GLOBAL_DB_URL).
# Output goes to flutter-server/backups/ (gitignored).
#
# Usage:   ./scripts/snapshot_local_mysql.sh
#
# Restore on the OTHER machine (MySQL running, root or equivalent access):
#   mysql -u root -p < local_snapshot_<timestamp>.sql
#   # or, from the compressed copy:
#   gunzip -c local_snapshot_<timestamp>.sql.gz | mysql -u root -p
#
# NOTE: this dumps DATA + SCHEMA for the app databases only. It does NOT dump
# MySQL users/grants — the target machine must already have a MySQL login whose
# credentials match that machine's flutter-server/.env (e.g. root).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SERVER_DIR/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found"; exit 1; }

# --- parse GLOBAL_DB_URL = mysql://user:pass@host:port/db ---
URL="$(grep -E '^[[:space:]]*GLOBAL_DB_URL' "$ENV_FILE" | head -1 \
  | sed -E 's/^[^=]*=[[:space:]]*"?([^"]+)"?.*/\1/')"
[ -n "$URL" ] || { echo "ERROR: GLOBAL_DB_URL not found in .env"; exit 1; }
proto="${URL#mysql://}"
creds="${proto%@*}"; hostpart="${proto#*@}"
DB_USER="${creds%%:*}"; DB_PASS="${creds#*:}"
hostport="${hostpart%%/*}"; DB_HOST="${hostport%%:*}"; DB_PORT="${hostport#*:}"
[ "$DB_PORT" = "$DB_HOST" ] && DB_PORT=3306

# --- locate mysql/mysqldump (often not on PATH on macOS) ---
find_bin() {
  command -v "$1" 2>/dev/null && return 0
  local g
  for g in /usr/local/mysql*/bin/"$1" /opt/homebrew/opt/mysql*/bin/"$1" /opt/homebrew/bin/"$1"; do
    [ -x "$g" ] && { echo "$g"; return 0; }
  done
  return 1
}
MYSQL="$(find_bin mysql)"        || { echo "ERROR: mysql client not found";  exit 1; }
MYSQLDUMP="$(find_bin mysqldump)" || { echo "ERROR: mysqldump not found";     exit 1; }

export MYSQL_PWD="$DB_PASS"   # avoids password-on-cmdline + shell escaping

# --- enumerate every non-system database ---
DBS="$("$MYSQL" -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -e \
  "SELECT schema_name FROM information_schema.schemata \
   WHERE schema_name NOT IN ('information_schema','mysql','performance_schema','sys') \
     AND schema_name NOT LIKE '%tenant\\_db\\_name%';")"   # skip junk '{tenant_db_name}' artifact DBs
[ -n "$DBS" ] || { echo "ERROR: no app databases found"; exit 1; }
DB_LIST="$(echo "$DBS" | tr '\n' ' ')"

# --- dump them all into one file ---
OUT_DIR="$SERVER_DIR/backups"
mkdir -p "$OUT_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="$OUT_DIR/local_snapshot_${TS}.sql"

echo "Host       : $DB_HOST:$DB_PORT (user $DB_USER)"
echo "Databases  : $DB_LIST"
echo "Dumping    → $OUT"
"$MYSQLDUMP" -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
  --databases $DB_LIST \
  --single-transaction --routines --triggers --events \
  --set-gtid-purged=OFF --no-tablespaces \
  > "$OUT"

gzip -kf "$OUT"
SIZE="$(du -h "$OUT" | cut -f1)"
GZSIZE="$(du -h "$OUT.gz" | cut -f1)"

echo ""
echo "✅ Snapshot written:"
echo "   $OUT        ($SIZE)"
echo "   $OUT.gz     ($GZSIZE)"
echo ""
echo "Copy either file to the other machine, then restore (MySQL running):"
echo "   mysql -u root -p < $(basename "$OUT")"
echo "   # or:  gunzip -c $(basename "$OUT").gz | mysql -u root -p"
