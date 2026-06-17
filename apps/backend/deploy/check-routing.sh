#!/usr/bin/env bash
set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-9031}"
DOMAIN="${DOMAIN:-flowdesk.victorsouza.dev}"

echo "=== Portas no host ==="
ss -tlnp 2>/dev/null | grep -E ":${BACKEND_PORT}|:3001" || true

echo ""
echo "=== Health local (host:${BACKEND_PORT}) ==="
if curl -fsS --max-time 5 "http://127.0.0.1:${BACKEND_PORT}/health"; then
  echo ""
else
  echo "FALHOU — nginx/Cloudflare apontam pra ${BACKEND_PORT} mas nada escuta aqui."
  echo "Dokploy: ports 9031:9031, PORT=9031, Domains → container port 9031."
fi

echo ""
echo "=== Health domínio ==="
curl -fsS --max-time 10 "https://${DOMAIN}/health" && echo "" || echo "FALHOU — 502 = origem não alcança container."
