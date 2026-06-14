#!/usr/bin/env bash
set -euo pipefail

CONF_NAME="flowdesk-api.conf"
SRC="$(cd "$(dirname "$0")" && pwd)/${CONF_NAME}"
DEST="/etc/nginx/sites-available/${CONF_NAME}"

if [[ ! -f "$SRC" ]]; then
  echo "Arquivo não encontrado: $SRC" >&2
  exit 1
fi

sudo cp "$SRC" "$DEST"
sudo ln -sf "$DEST" "/etc/nginx/sites-enabled/${CONF_NAME}"
sudo nginx -t
sudo systemctl reload nginx
echo "Nginx recarregado. Teste: curl -fsS https://flowdesk.victorsouza.dev/health"
