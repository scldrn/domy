#!/usr/bin/env bash
# Domy PostgreSQL backup (release review DEPLOY-1; business master decision #28).
#
# Usage: scripts/backup.sh [TARGET_DIR]
#
# Runs pg_dump inside the production PostgreSQL container (custom format, one consistent
# snapshot), writes domy-YYYYMMDDTHHMMSSZ.dump and its .sha256 into TARGET_DIR (or
# DOMY_BACKUP_DIR), checks that pg_restore can read the archive, and keeps the newest
# DOMY_BACKUP_KEEP dumps (default 14). Any failure exits non-zero and leaves no partial dump.
#
# Environment:
#   DOMY_BACKUP_DIR           target directory when no argument is given
#   DOMY_BACKUP_KEEP          dumps to keep in TARGET_DIR (default 14)
#   DOMY_COMPOSE_FILE         compose file (default compose.production.yaml)
#   DOMY_COMPOSE_ENV_FILE     --env-file for docker compose (the variables used for `up`)
#   DOMY_DB_CONTAINER         run in this container instead of the compose `postgres` service
#
# The dump holds recipients' personal data: TARGET_DIR is created mode 0700 and every file
# 0600. Copying it off the server is the owner's decision (see README, Production).
set -euo pipefail
umask 077

die() {
  printf 'backup: %s\n' "$*" >&2
  exit 1
}

target_dir="${1:-${DOMY_BACKUP_DIR:-}}"
keep="${DOMY_BACKUP_KEEP:-14}"
[ -n "$target_dir" ] || die "usage: scripts/backup.sh TARGET_DIR (or set DOMY_BACKUP_DIR)"
[[ "$keep" =~ ^[1-9][0-9]*$ ]] || die "DOMY_BACKUP_KEEP must be a positive integer"

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

mkdir -p "$target_dir"
chmod 700 "$target_dir"

name="domy-$(date -u +%Y%m%dT%H%M%SZ).dump"
final="$target_dir/$name"
partial="$target_dir/.$name.partial"
[ ! -e "$final" ] || die "$final already exists"
trap 'rm -f "$partial"' EXIT

# pg_dump takes one consistent snapshot of the whole database. The credentials stay inside the
# container (local socket, its own POSTGRES_USER/POSTGRES_DB); nothing secret enters argv.
set -o noclobber
# shellcheck disable=SC2016 # expanded by the container's shell
"${db_exec[@]}" sh -c 'exec pg_dump --no-password --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" --format=custom --no-owner --no-acl' >"$partial" ||
  die "pg_dump failed"
set +o noclobber
[ -s "$partial" ] || die "pg_dump produced an empty archive"

# A readable table of contents proves the archive is complete enough for pg_restore.
"${db_exec[@]}" pg_restore --list <"$partial" >/dev/null || die "pg_restore cannot read the archive"

checksum="$(sha256_of "$partial")"
mv "$partial" "$final"
printf '%s  %s\n' "$checksum" "$name" >"$final.sha256"
trap - EXIT
printf 'backup: wrote %s (%s bytes, sha256 %s)\n' "$final" "$(wc -c <"$final" | tr -d ' ')" "$checksum"

# Retention by count: names sort by their UTC timestamp, newest first.
count=0
for dump in $(ls -1 "$target_dir" | grep -E '^domy-[0-9]{8}T[0-9]{6}Z\.dump$' | sort -r); do
  count=$((count + 1))
  if [ "$count" -gt "$keep" ]; then
    rm -f "$target_dir/$dump" "$target_dir/$dump.sha256"
    printf 'backup: removed %s (keeping %s)\n' "$dump" "$keep"
  fi
done
