# FlowDesk IA — Atendimento automático no WhatsApp

SaaS de resposta automática para WhatsApp voltado a pequenos negócios: salão de beleza, restaurante, dentista, loja e comércio local.

Automatize atendimento, agendamentos, catálogo, FAQ, fluxo conversacional com botões e cobrança PIX — com painel web e bot no WhatsApp.

---

## Funcionalidades

### Bot WhatsApp (agente externo)

| Feature | Descrição |
| --- | --- |
| **Menu automático** | Menu numerado personalizado por tipo de negócio (agenda, catálogo, dúvidas, PIX, atendente) |
| **Catálogo / orçamento** | Cliente pede catálogo ou preço → bot envia serviços/produtos com valores |
| **Agendamento** | Fluxo guiado: serviço → data → horário → confirmação automática |
| **Consulta de agendamento** | Cliente pergunta “meu agendamento” → bot localiza e informa |
| **FAQ inteligente** | Palavras-chave configuradas no painel → respostas automáticas |
| **Fluxo conversacional** | Passos com botões clicáveis, imagens e ramificações — ideal para captação de leads e vendas guiadas |
| **PIX automático** | QR Code + copia-e-cola na conversa via Mercado Pago (planos Pro e Unlimited) |
| **Atendimento humano** | Cliente pede atendente → bot pausa; operador responde pelo painel |
| **Fora do horário** | Mensagem de ausência configurável quando o negócio está fechado |

### Painel web

| Área | Descrição |
| --- | --- |
| **Dashboard** | Conversas, agendamentos pendentes, receita PIX e métricas do mês |
| **Negócio** | Cadastro, tipo (salão de beleza, restaurante, etc.), horários, saudação e mensagem de ausência |
| **Catálogo** | Serviços/produtos com preço, descrição e limite por plano |
| **Agendamentos** | Calendário, confirmação/rejeição (tipos com aprovação manual) |
| **Conversas** | Histórico, assumir/liberar atendimento, enviar mensagem manual |
| **WhatsApp** | Conectar via QR Code, status da sessão, desconectar |
| **FAQ + fluxo IA** | Perguntas frequentes, menu numérico e fluxo conversacional (botões + imagens) |
| **Plano** | Assinatura Stripe, trial, portal de cobrança |
| **Perfil** | Conta, LGPD (exportar, anonimizar, excluir dados) |

### Tipos de negócio

Vocabulário e fluxos adaptados para: **Salão de Beleza**, **Restaurante**, **Consultório**, **Loja** e **Outro** (rótulo customizado).

### Conta e conformidade

- Login com **Google** ou **e-mail/senha** (Firebase Auth)
- **Trial de 7 dias** no plano Starter
- **LGPD**: exportação de dados, solicitações de titular, exclusão de conta
- Retenção automática de dados (configurável na API)

---

## Arquitetura

O monorepo é dividido em três camadas em produção:

```
┌─────────────────┐     Firestore (direto)     ┌──────────────────┐
│  Dashboard Web  │ ◄──────────────────────► │  Firebase Auth   │
│  (Next.js SPA)  │                            │  + Firestore     │
└────────┬────────┘                            └──────────────────┘
         │ REST (billing, privacy, Mercado Pago, WhatsApp)
         ▼
┌─────────────────┐
│  Backend Hono   │  VM Oracle (Docker) ou local :3001
└─────────────────┘
```

- **Dashboard**: lê e grava negócios, catálogo, FAQ, conversas e agendamentos **direto no Firestore** (regras de segurança por `tenantId`).
- **Backend**: WhatsApp (Baileys), cobrança Stripe, webhooks, integração Mercado Pago, privacidade/LGPD e auth sync.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Monorepo | Turborepo + pnpm |
| Frontend | Next.js 16 (App Router), Tailwind CSS 4, TanStack Query |
| Backend | Hono + Node.js (WhatsApp em TypeScript) |
| Banco / Auth | Firebase Firestore + Firebase Authentication |
| Pagamentos assinatura | Stripe |
| Pagamentos PIX | Mercado Pago |
| WhatsApp | Baileys (agente externo `flowdesk-wa`) |
| Deploy web | Vercel (Next.js SSR, Root Directory `apps/web`) |
| Deploy backend | Node.js na VM/servidor (`pnpm build` + `node src/index.js`) |

---

## Estrutura

```
flowdesk/
├── apps/
│   ├── web/                 # Dashboard Next.js (porta 3000)
│   └── backend/             # Backend Hono (porta 3001)
├── packages/
│   ├── firebase/            # Admin SDK + client Firestore (client-ops)
│   ├── shared/              # Intents, planos, vocabulário, menu do bot
│   └── whatsapp-client/     # Wrapper Baileys (usado pelo flowdesk-wa)
└── scripts/                 # Build hosting, Stripe, env de produção
```

---

## Início rápido

### Pré-requisitos

- Node.js 20+
- pnpm 10+
- Projeto Firebase (Auth + Firestore + Hosting)
- Service account Firebase (project_id, client_email, private_key) nas variáveis do backend

> Redis e o agente WhatsApp só são necessários para testar conexão/bot localmente (`flowdesk-wa`).

### Setup

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
# Preencha FIREBASE_* no backend e NEXT_PUBLIC_* no web
```

Credencial Admin no backend (`apps/backend/.env`):

```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Login Google:** rode `pnpm google:oauth-setup` e adicione no Google Cloud → OAuth Client → **Authorized redirect URIs** e **Authorized JavaScript origins** todas as URLs que o script listar. Com domínio customizado (ex.: `https://flowdesk.ia.br`), defina `WEB_ORIGIN` em `apps/backend/.env` antes de rodar o script e inclua `flowdesk.ia.br` em Firebase → Authentication → Settings → **Authorized domains**. Erro `origin_mismatch` = falta a origem JS `https://seu-dominio` no OAuth Client.

### Desenvolvimento

```bash
pnpm dev          # web :3000 + backend :3001
pnpm dev:web      # só frontend
pnpm dev:backend  # só backend
```

| Serviço | URL |
| --- | --- |
| Dashboard | http://localhost:3000 |
| Backend | http://localhost:3001 |
| Health | http://localhost:3001/health |
| Swagger | http://localhost:3001/swagger |

Configure `NEXT_PUBLIC_WA_API_URL` e `NEXT_PUBLIC_API_URL` para a mesma URL do backend.

---

## Planos

| Plano | Preço | Mensagens/mês | Catálogo | Agendamentos/mês | Extras |
| --- | --- | --- | --- | --- | --- |
| **Starter** | R$ 69,90 | 500 | 3 itens | 30 | Trial 7 dias |
| **Pro** | R$ 99 | 5.000 | 100 itens | 500 | PIX Mercado Pago |
| **Unlimited** | R$ 199 | Ilimitado | Ilimitado | Ilimitado | — |

Sincronizar preços Stripe: `pnpm stripe:sync-prices`

---

## Deploy

Firebase (Auth, Firestore rules, índices) é configurado no **Firebase Console**. O front roda na **Vercel** com Next.js SSR.

| Componente | Onde | Como |
| --- | --- | --- |
| **Web** | Vercel | Root Directory `apps/web` + Git ou `vercel deploy` |
| **Firestore** | Firebase Console | Rules e índices no painel |
| **Backend** | VM/servidor | `pnpm --filter @flowdesk/backend build` + processo Node na porta 3001 |

### Front de produção (Vercel)

1. Conecte o repositório na Vercel com **Root Directory** = `apps/web`.
2. Configure env vars (ver `apps/web/.env.example`), incluindo Admin SDK server-side:
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
3. Build: `pnpm turbo run build --filter=@flowdesk/web` (já em `vercel.json` na raiz).
4. Domínio `flowdesk.ia.br`: DNS na Vercel; adicione domínio autorizado no Firebase Auth.

```bash
pnpm setup:billing-env    # gera apps/web/.env.production a partir de apps/web/.env (referência local)
vercel deploy             # preview ou produção
```

Variáveis essenciais no painel Vercel:

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend (billing/privacy/Mercado Pago) — mesma URL do WA |
| `NEXT_PUBLIC_WA_API_URL` | Backend WhatsApp (ex.: `https://wa.seudominio.com`) |
| `NEXT_PUBLIC_FIREBASE_*` | Config do projeto Firebase |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Login Google |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | SSR (Admin SDK) |

Deixe os Payment Links Stripe vazios em produção — checkout passa pela API para ativar o plano.

### API (`apps/backend/.env`)

| Variável | Uso |
| --- | --- |
| `FIREBASE_WEB_API_KEY` | Auth REST (mesma do web) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Admin SDK |
| `STRIPE_*` | Assinaturas e webhooks |
| Chaves MP por negócio | Access Token salvo em `integrations/mercadopago` (painel Pagamentos) |
| `CORS_ORIGIN` | URL(s) do front Vercel (ex.: `https://flowdesk.ia.br`) |
| `PRIVACY_RETENTION_INTERVAL_HOURS` | Job de retenção LGPD (0 = desligado) |
| `FIREBASE_STORAGE_BUCKET` | Mídia de chat (Firebase Storage) |
| `WA_API_PUBLIC_URL` | URL pública do backend na VM |

---

## Configuração do WhatsApp

1. Dashboard → **Negócios** → **WhatsApp**
2. **Gerar QR Code** e escanear no celular
3. Bot ativo após conectar (requer agente `flowdesk-wa` no ar)

---

## Scripts úteis

| Script | Descrição |
| --- | --- |
| `pnpm google:oauth-setup` | URLs de redirect OAuth |
| `pnpm setup:billing-env` | Gera `.env.production` do web (referência local) |

---

## Licença

Projeto privado.
