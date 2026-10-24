#!/usr/bin/env bash
# Domy PostgreSQL restore check (release review DEPLOY-1; business master decision #28).
#
# Usage: scripts/restore.sh DUMP_FILE NEW_DATABASE
#
# Verifies DUMP_FILE against its .sha256, creates NEW_DATABASE (which must not exist) in the
# same PostgreSQL server, restores the archive into it in one transaction, and prints the row
# count of every table and the COP totals of the live and the restored database side by side.
# It never writes to the live database: it refuses the live database's name, the system
# databases, and any database that already exists. Any failure exits non-zero.
#
# The restored database stays for inspection; drop it afterwards with the command printed at
# the end. To put a backup into service after a loss, follow README, Production, "Restore".
#
# Environment: DOMY_COMPOSE_FILE, DOMY_COMPOSE_ENV_FILE, and DOMY_DB_CONTAINER as backup.sh.
set -euo pipefail
umask 077

die() {
  printf 'restore: %s\n' "$*" >&2
  exit 1
}

[ "$#" -eq 2 ] || die "usage: scripts/restore.sh DUMP_FILE NEW_DATABASE"
dump="$1"
target="$2"
script_dir="$(cd "$(dirname "$0")" && pwd)"

[ -f "$dump" ] || die "$dump is not a file"
[[ "$target" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] ||
  die "NEW_DATABASE must be lowercase letters, digits, and underscores (at most 63)"
case "$target" in
  postgres | template0 | template1) die "refusing the system database $target" ;;
esac

if [ -n "${DOMY_DB_CONTAINER:-}" ]; then
  db_exec=(docker exec -i "$DOMY_DB_CONTAINER")
elif [ -n "${DOMY_COMPOSE_ENV_FILE:-}" ]; then
  db_exec=(docker compose -f "${DOMY_COMPOSE_FILE:-compose.production.yaml}"
    --env-file "$DOMY_COMPOSE_ENV_FILE" exec -T postgres)
else
  db_exec=(docker compose -f "${DOMY_COMPOSE_FILE:-compose.production.yaml}" exec -T postgres)
fi

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d ' ' -f 1
  else
    shasum -a 256 "$1" | cut -d ' ' -f 1
  fi
}

[ -f "$dump.sha256" ] || die "missing $dump.sha256"
expected="$(cut -d ' ' -f 1 <"$dump.sha256")"
[ "$(sha256_of "$dump")" = "$expected" ] || die "checksum mismatch for $dump"

# shellcheck disable=SC2016 # expanded by the container's shell
live="$("${db_exec[@]}" sh -c 'printf %s "$POSTGRES_DB"')"
[ -n "$live" ] || die "cannot read the live database name"
[ "$target" != "$live" ] || die "refusing to restore over the live database $live"

# The name is validated above, so it can be quoted into SQL.
# shellcheck disable=SC2016
exists="$("${db_exec[@]}" sh -c 'exec psql -X -A -t --no-password --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" -v ON_ERROR_STOP=1 \
  -c "select 1 from pg_database where datname = '\''$1'\''"' sh "$target")" ||
  die "cannot query the database list"
[ -z "$exists" ] || die "database $target already exists; choose a new name"

pg_restore_list() { "${db_exec[@]}" pg_restore --list <"$dump" >/dev/null; }
pg_restore_list || die "pg_restore cannot read $dump"

# shellcheck disable=SC2016
"${db_exec[@]}" sh -c 'exec createdb --no-password --username="$POSTGRES_USER" \
  --maintenance-db="$POSTGRES_DB" "$1"' sh "$target" || die "cannot create database $target"
printf 'restore: created empty database %s\n' "$target"

# shellcheck disable=SC2016
"${db_exec[@]}" sh -c 'exec pg_restore --no-password --username="$POSTGRES_USER" --dbname="$1" \
  --exit-on-error --single-transaction --no-owner --no-acl' sh "$target" <"$dump" ||
  die "pg_restore failed; $target may be left empty for inspection"
printf 'restore: restored %s into %s\n' "$(basename "$dump")" "$target"

counts() {
  # shellcheck disable=SC2016
  "${db_exec[@]}" sh -c 'exec psql -X -A -t -F "$(printf "\t")" --no-password --username="$POSTGRES_USER" \
    --dbname="$1" -v ON_ERROR_STOP=1' sh "$1" <"$script_dir/verify-counts.sql"
}

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
counts "$live" >"$work/live" || die "cannot count the live database"
counts "$target" >"$work/restored" || die "cannot count the restored database"

printf '\n%-52s %14s %14s\n' "item" "live" "restored"
awk -F '\t' '
  NR == FNR { if (NF == 2) seen[$1] = $2; next }
  NF == 2 {
    mark = ($1 in seen && seen[$1] == $2) ? "" : "  *"
    if (mark != "") differ++
    printf "%-52s %14s %14s%s\n", $1, ($1 in seen ? seen[$1] : "-"), $2, mark
  }
  END {
    if (differ) printf "\n%d item(s) differ (*): expected when the live database changed after the dump.\n", differ
    else printf "\nEvery count and COP total matches the live database.\n"
  }
' "$work/live" "$work/restored"

printf '\nrestore: inspect %s, then drop it with:\n' "$target"
printf '  docker compose -f compose.production.yaml exec -T postgres sh -c '"'"'dropdb --username="$POSTGRES_USER" --maintenance-db="$POSTGRES_DB" %s'"'"'\n' "$target"
