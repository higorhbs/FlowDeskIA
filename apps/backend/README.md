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

Env: `FIREBASE_WEB_API_KEY`, credencial Admin (igual `@flowdesk/api`), `WEB_ORIGIN`, `CORS_ORIGIN`.

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

Requer `ENABLE_WORKERS=true` e `WA_SESSION_PATH`.

| Método | Path | Descrição |
| ------ | ---- | --------- |
| `GET` | `/chat/whatsapp/qr-code/:businessId` | Status + QR atual |
| `POST` | `/chat/whatsapp/qr-code/:businessId` | Iniciar pareamento (`?force=1` nova sessão) |
| `DELETE` | `/chat/whatsapp/connection/:businessId` | Desconectar |
| `POST` | `/chat/whatsapp/messages/:businessId` | Enviar texto (`to`, `text`, `conversationId?`) |
| `POST` | `/chat/whatsapp/messages/:businessId/media` | Enviar mídia (multipart) |

### Stories WhatsApp (`/stories/whatsapp/:businessId`)

| Método | Path | Body / notas |
| ------ | ---- | ------------ |
| `GET` | `/stories/whatsapp/:businessId` | Lista agendamentos |
| `POST` | `/stories/whatsapp/:businessId` | multipart: `file`, `scheduledDays` (JSON), `hour`, `minute`, `caption?` (upload + agendamento) |
| `POST` | `/stories/whatsapp/:businessId/:statusId/repost` | `scheduledDays[]`, `hour`, `minute` |
| `DELETE` | `/stories/whatsapp/:businessId/:statusId` | Cancela pendente |
| `DELETE` | `/stories/whatsapp/:businessId/series/:seriesId` | Cancela série |

### Notificações internas (`INTERNAL_NOTIFY_SECRET` + header `x-internal-secret`)

| Método | Path | Uso |
| ------ | ---- | --- |
| `POST` | `/internal/notifications/payment` | `apps/api` após pagamento Asaas `PAID` |
| `POST` | `/internal/notifications/booking` | Confirmação de agendamento via WA |

### Deploy Docker

```bash
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d backend redis
```

Imagem: `apps/backend/Dockerfile`. Workers exigem `REDIS_URL` e `ENABLE_WORKERS=true`.
