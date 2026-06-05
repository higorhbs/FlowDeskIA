# @flowdesk/backend

API HTTP com [Hono](https://hono.dev) (JavaScript, Node) e documentação via [Swagger UI](https://hono.dev/docs/middleware/third-party).

## Scripts

| Script | Comando      | Uso                                                 |
| ------ | ------------ | --------------------------------------------------- |
| Dev    | `pnpm dev`   | `node --watch` (porta padrão `3001`, `PORT` no env) |
| Build  | `pnpm build` | `node --check` (validação de sintaxe)               |
| Start  | `pnpm start` | `node src/index.js`                                 |

Monorepo: `pnpm dev:backend`

---

### Documentação

Montadas em `src/app.js`:

| Método | Path       | Descrição                                             |
| ------ | ---------- | ----------------------------------------------------- |
| `GET`  | `/doc`     | OpenAPI 3.0 (JSON), montado em `src/openapi/index.js` |
| `GET`  | `/swagger` | Swagger UI → `/doc`                                   |

Metadados globais: `src/openapi/document.js`.

---

## Organização de pastas

```
src/
  index.js
  app.js                   # Hono + /doc + /swagger
  config/env.js
  openapi/
    document.js            # info, version
    index.js               # agrega paths de cada rota
  routes/
    index.js               # único lugar que importa register das rotas
    <recurso>/
      handler.js           # implementação
      index.js             # register(app) — app.get/post/...
      openapi.js           # fragmento paths do OpenAPI (manual)
```

### Regras

1. **`routes/index.js`** — só importa `register` de cada pasta.
2. **`openapi/index.js`** — importa `openapi.js` de cada rota e monta `paths`.

---

## Como adicionar uma rota

1. Criar `src/routes/<recurso>/` com `handler.js`, `index.js`, `openapi.js`.
2. Registrar handler em `src/routes/index.js` (`routeModules`).
3. Registrar spec em `src/openapi/index.js` (`pathModules`).
4. Atualizar **Catálogo de rotas** neste README.
5. Conferir: rota, `GET /doc`, `GET /swagger`.

---

## Layout atual

```
src/
  index.js
  app.js
  config/env.js
  middleware/cors.js
  lib/
    auth-errors.js
    firebase-identity.js
    tenant.js
  openapi/
    document.js
    index.js
  routes/
    index.js
    health/
    auth/
    business/
```

## Auth (Firebase via servidor)

| Método | Path | Descrição |
| ------ | ---- | --------- |
| `POST` | `/register` | Cadastro e-mail/senha + envio de verificação |
| `POST` | `/login` | Login; retorna `customToken` se verificado |
| `POST` | `/auth/google` | Login Google (`accessToken`) |
| `POST` | `/auth/resend-verification` | Reenviar e-mail (e-mail + senha) |
| `POST` | `/auth/confirm-verification` | Confirmar e liberar sessão (e-mail + senha) |
| `POST` | `/auth/resend-verification/session` | Reenviar (Bearer) |
| `POST` | `/auth/confirm-verification/session` | Confirmar sessão (Bearer) |
| `POST` | `/auth/sync` | Criar tenant Firestore (Bearer) |

Env: `FIREBASE_WEB_API_KEY`, credencial Admin, `WEB_ORIGIN`, `CORS_ORIGIN`, `STRIPE_*`, `ASAAS_*`.

### Negócios (onboarding)

| Método | Path | Auth | Descrição |
| ------ | ---- | ---- | --------- |
| `POST` | `/business` | Bearer | Cria negócio (`name`, `type`, `whatsapp`, `description?`) |
| `GET` | `/businesses` | Bearer | Lista negócios do tenant logado |

### Horários (`businessSchedules/{businessId}`)

| Método | Path | Descrição |
| ------ | ---- | --------- |
| `GET` | `/schedules` | Lista horários do tenant (`?businessId=` opcional) |
| `PUT` | `/businesses/:id/schedule` | Salva todos os campos (semanal, almoço, exceções, timezone) |

### Chat WhatsApp

Requer `ENABLE_WORKERS=true` e credenciais Firebase (Storage, Firestore para sessão Baileys e fila inbound).

| Método | Path | Descrição |
| ------ | ---- | --------- |
| `GET` | `/chat/whatsapp/qr-code/:businessId` | Status + QR atual |
| `POST` | `/chat/whatsapp/qr-code/:businessId` | Iniciar pareamento (`?force=1` nova sessão) |
| `DELETE` | `/chat/whatsapp/connection/:businessId` | Desconectar |
| `POST` | `/chat/whatsapp/messages/:businessId` | Enviar texto (`to`, `text`, `conversationId?`) |
| `POST` | `/chat/whatsapp/messages/:businessId/media` | Enviar mídia (multipart) |

### Billing (Stripe)

| Método | Path | Auth |
| ------ | ---- | ---- |
| `POST` | `/billing/sync` | Bearer |
| `POST` | `/billing/checkout` | Bearer |
| `POST` | `/billing/portal` | Bearer |
| `GET` | `/billing/prices` | Bearer |

### Privacidade (LGPD)

| Método | Path | Auth |
| ------ | ---- | ---- |
| `GET` | `/privacy/export` | Bearer |
| `POST` | `/privacy/requests` | Bearer |
| `POST` | `/privacy/delete-account` | Bearer |
| `POST` | `/privacy/anonymize` | Bearer |
| `POST` | `/privacy/retention/run` | Bearer |

### Integração Asaas

| Método | Path | Auth |
| ------ | ---- | ---- |
| `GET` | `/businesses/:id/integrations/asaas` | Bearer |
| `PUT` | `/businesses/:id/integrations/asaas` | Bearer |
| `DELETE` | `/businesses/:id/integrations/asaas` | Bearer |

### Webhooks (sem Bearer)

| Método | Path |
| ------ | ---- |
| `POST` | `/webhooks/stripe` |
| `POST` | `/webhooks/asaas` |

### Notificações internas (`INTERNAL_NOTIFY_SECRET` + header `x-internal-secret`)

| Método | Path | Uso |
| ------ | ---- | --- |
| `POST` | `/internal/notifications/payment` | Legado — webhook Asaas chama in-process |
| `POST` | `/internal/notifications/booking` | Confirmação de agendamento via WA |

### Stories WhatsApp (Bearer + negócio do tenant)

| Método | Path | Uso |
| ------ | ---- | --- |
| `GET` | `/stories/whatsapp/:businessId` | Lista agendamentos (`scheduledStatuses`) |
| `POST` | `/stories/whatsapp/:businessId` | Upload multipart + agendamento / `publishNow` |
| `POST` | `/stories/whatsapp/:businessId/:statusId/repost` | Reagenda mídia existente |
| `DELETE` | `/stories/whatsapp/:businessId/:statusId` | Cancela pendente |
| `DELETE` | `/stories/whatsapp/:businessId/series/:seriesId` | Cancela série pendente |

Cota mensal por plano (só publicações com sucesso): Starter 5, Pro 10, Unlimited ∞. Contador em `tenants/{id}/usage/{YYYY-MM}.storiesPublished`.

Worker `status-scheduler` publica via Baileys quando `ENABLE_WORKERS=true`. Índice Firestore collection group: ver [`firestore.indexes.json`](../../firestore.indexes.json) na raiz do monorepo (`scheduledStatuses`: `status` + `scheduledAt`).

### Deploy

```bash
pnpm build
node src/index.js
```

Workers exigem `ENABLE_WORKERS=true` e índices Firestore em `whatsappJobs` e `scheduledStatuses` (collection group). Firestore rules/índices e Hosting são geridos no [Firebase Console](https://console.firebase.google.com) ou via `firestore.indexes.json` na raiz.
