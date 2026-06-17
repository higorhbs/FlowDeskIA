# Rede casa — deploy só Dokploy (sem Domains)

## Higor (Dokploy)

1. App `flowdesk-ia-backend` → **Advanced** → **Ports** → Add
2. **Published Port:** `9031`
3. **Target Port:** `9031` (igual `PORT` no Environment e Dockerfile)
4. **Protocol:** TCP
5. **Publish mode:** `host` (se aparecer; senão deixar padrão)
6. **Domains:** `flowdesk.victorsouza.dev` → porta container **`9031`**
7. **Environment:** `PORT=9031`, `HOST=0.0.0.0`, `ENABLE_WORKERS=true`
8. **Redeploy** (Clean Cache se build antigo)

Dentro do container (terminal Dokploy): `curl http://127.0.0.1:9031/health` → ok

## Victor (rede / DNS)

1. Na máquina do Dokploy (host): `curl http://127.0.0.1:9031/health` → ok
2. Garantir rota externa `flowdesk.victorsouza.dev` → IP público casa → porta **9031**
   (Cloudflare Tunnel, port forward roteador, Tailscale Funnel, etc.)
3. Nginx na VM, se existir: `upstream` → `127.0.0.1:9031` (ver `deploy/nginx/flowdesk-api.conf`)

## Vercel

- `NEXT_PUBLIC_WA_API_URL=https://flowdesk.victorsouza.dev`
- `BACKEND_INTERNAL_URL=https://flowdesk.victorsouza.dev`

502 com container saudável em `:9031` = **porta publicada errada no Dokploy** (ex.: target 3001) ou **Cloudflare/rota externa não chega no 9031**.

Front Vercel: WhatsApp usa proxy `/api/backend` (mesma origem). `BACKEND_INTERNAL_URL=https://flowdesk.victorsouza.dev` na Vercel.
