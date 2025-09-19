#!/usr/bin/env bash
set -euo pipefail

# Usage: remote-backup.sh <REMOTE_PATH>
# Example: remote-backup.sh /srv/www/static/firefly-docs
REMOTE_PATH="${1:?Usage: $0 <REMOTE_PATH>}"

TS="$(date +%Y%m%d_%H%M%S)"
PARENT_DIR="$(dirname "$REMOTE_PATH")"
BASENAME="$(basename "$REMOTE_PATH")"
BACKUP_DIR="${PARENT_DIR}/${BASENAME}_backup_${TS}"

echo "Starting remote backup…"
echo "Source: ${REMOTE_PATH}"
echo "Backup: ${BACKUP_DIR}"

# --- Validate source directory ---
if [[ ! -d "$REMOTE_PATH" ]]; then
  echo "Error: Source directory '$REMOTE_PATH' does not exist." >&2
  exit 1
fi

# --- Prepare backup destination ---
mkdir -p "$BACKUP_DIR"

# --- Helper: check if directory is non-empty ---
has_contents() {
  local d="$1"
  find "$d" -mindepth 1 -print -quit | grep -q .
}

if has_contents "$REMOTE_PATH"; then
  echo "Backing up current site content…"
  rsync -aHL "$REMOTE_PATH/" "$BACKUP_DIR/"
else
  echo "Source exists but is empty → skipping data backup."
fi

echo "Remote backup completed at $BACKUP_DIR"
