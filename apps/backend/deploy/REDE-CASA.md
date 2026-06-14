# Rede casa — deploy só Dokploy (sem Domains)

## Higor (Dokploy)

1. App `flowdesk-ia-backend` → **Advanced** → **Ports** → Add
2. **Published Port:** `9031`
3. **Target Port:** `3001`
4. **Protocol:** TCP
5. **Publish mode:** `host` (se aparecer; senão deixar padrão)
6. **Domains:** vazio — não criar domínio no Dokploy
7. **Replicas:** `1`
8. **Redeploy**

Dentro do container (terminal Dokploy): `curl http://127.0.0.1:3001/health` → ok

## Victor (rede / DNS)

1. Na máquina do Dokploy (host): `curl http://127.0.0.1:9031/health` → ok
2. Garantir rota externa `flowdesk.victorsouza.dev` → IP público casa → porta **9031**
   (Cloudflare Tunnel, port forward roteador, Tailscale Funnel, etc.)
3. Nginx na VM, se existir: `upstream` → `127.0.0.1:9031` (ver `deploy/nginx/flowdesk-api.conf`)

## Vercel

- `NEXT_PUBLIC_WA_API_URL=https://flowdesk.victorsouza.dev`
- `BACKEND_INTERNAL_URL=https://flowdesk.victorsouza.dev`

502 com container saudável em `:3001` = **9031 não publicado no Dokploy** ou **Victor: rota externa não chega no 9031**.
