#!/usr/bin/env bash
set -euo pipefail

# Usage: remote-backup.sh <REMOTE_PATH>
# Example: remote-backup.sh /srv/www/static/firefly-docs
REMOTE_PATH="${1:?Usage: $0 <REMOTE_PATH>}"

TS="$(date +%Y%m%d_%H%M%S)"
PARENT_DIR="$(dirname "$REMOTE_PATH")"
BASENAME="$(basename "$REMOTE_PATH")"
BACKUP_DIR="${PARENT_DIR}/${BASENAME}_backup_${TS}"

run_root() { if [[ $EUID -eq 0 ]]; then "$@"; else sudo -n "$@"; fi; }

echo "Starting remote backup…"
echo "Source: ${REMOTE_PATH}"
echo "Backup: ${BACKUP_DIR}"

# Ensure target & backup dirs exist
run_root mkdir -p "$REMOTE_PATH"
run_root mkdir -p "$BACKUP_DIR"

has_contents() {
  local d="$1"
  find "$d" -mindepth 1 -print -quit | grep -q .
}

if has_contents "$REMOTE_PATH"; then
  echo "Backing up current site content…"
  # -a: archive, -H: preserve hardlinks, -L: follow symlinks (safe for static)
  run_root rsync -aHL "$REMOTE_PATH/" "$BACKUP_DIR/"
else
  echo "Source exists but is empty → skipping data backup."
fi

echo "Remote backup completed at $BACKUP_DIR"
