# FlowDesk — Atendimento Automático para WhatsApp

SaaS de resposta automática para WhatsApp voltado a pequenos negócios (barbearia, salão, hamburgueria, dentista, comércio local).

## Funcionalidades

| Feature                 | Como funciona                                                                    |
| ----------------------- | -------------------------------------------------------------------------------- |
| **Catálogo automático** | Cliente digita "catálogo" ou "preço" → bot envia lista de serviços com valores   |
| **Agendamento**         | Cliente digita "agendar" → fluxo guiado (serviço → data → horário) → confirmação |
| **Orçamento**           | Cliente digita "orçamento" → bot envia tabela de preços                          |
| **PIX automático**      | Gera QR Code + copia-e-cola direto na conversa via Asaas                         |
| **FAQ inteligente**     | Detecta palavras-chave e responde perguntas frequentes configuradas              |
| **Atendimento humano**  | Cliente pede "atendente" → bot pausa, operador assume pelo dashboard             |

## Stack

- **Monorepo**: Turborepo
- **API**: Fastify + TypeScript
- **Frontend**: Next.js (App Router) + Tailwind CSS
- **Banco**: Firebase Firestore
- **Auth**: Firebase Authentication
- **Filas**: BullMQ + Redis
- **WhatsApp**: Baileys (WhatsApp Web Protocol)
- **PIX**: Asaas API

## Estrutura

```
flowdesk/
├── apps/
│   ├── web/          # Dashboard Next.js (porta 3000)
│   └── api/          # API Fastify (porta 3001)
└── packages/
    ├── firebase/     # Firestore + Auth (Admin + client)
    ├── shared/       # Utilitários, detecção de intent, planos
    └── whatsapp-client/ # Wrapper Baileys
```

## Início rápido

### Pré-requisitos

- Node.js 20+
- Redis (local: `docker compose up -d redis` ou `REDIS_URL` remoto)

### Setup

```bash
pnpm install
cp .env.example .env
cp apps/web/.env.example apps/web/.env
# Raiz: API, Firebase Admin, Redis, Stripe secret. Web: só NEXT_PUBLIC_*.

pnpm dev
```

Credencial Admin: `GOOGLE_APPLICATION_CREDENTIALS=.secrets/firebase-adminsdk.json` na raiz do repo.

**Login Google:** `pnpm google:oauth-setup` — no Google Cloud → Credentials → OAuth Client → **Authorized redirect URIs**, inclua obrigatoriamente `https://zapflow-higor-2026.web.app/__/auth/handler` (e as demais URLs que o script listar). `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` deve ser `zapflow-higor-2026.web.app`.

### Acesse

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:3001

## Deploy

| App     | Onde                                                                    |
| ------- | ----------------------------------------------------------------------- |
| **Web** | Firebase Hosting — https://zapflow-higor-2026.web.app                   |
| **API** | Firebase Functions (`/api/*`) — billing, webhooks, privacy, Asaas       |
| **WA**  | Repositório [flowdesk-wa](../flowdesk-wa) — Raspberry Pi / VPS contínuo   |

```bash
pnpm deploy:hosting    # front estático
pnpm deploy:firestore  # regras Firestore
```

Antes do deploy do front, crie `apps/web/.env.production` (veja `.env.production.example`) com `NEXT_PUBLIC_WA_API_URL` apontando para o agente WhatsApp (Raspberry Pi) e `NEXT_PUBLIC_API_URL` para Firebase Functions (`https://seu-projeto.web.app/api`).

**Firebase Functions:** `FIREBASE_*`, `STRIPE_*`, `ASAAS_*`, `CORS_ORIGIN` (URL do Hosting).  
**Web:** `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WA_API_URL`.  
**WhatsApp (flowdesk-wa):** `FIREBASE_*`, `REDIS_URL`, `WA_SESSION_PATH`, `CORS_ORIGIN` — processo contínuo no Pi.

## Configuração do WhatsApp

1. Dashboard → Negócios → WhatsApp
2. **Gerar QR Code** e escanear no celular
3. Bot ativo após conectar

## Planos

| Plano     | WhatsApp | Mensagens | Catálogo  | Agendamentos |
| --------- | -------- | --------- | --------- | ------------ |
| Starter   | 1        | 500/mês   | 20 itens  | 50/mês       |
| Pro       | 3        | 5.000/mês | 100 itens | 500/mês      |
| Unlimited | 10       | Ilimitado | Ilimitado | Ilimitado    |
