# @flowdesk/backend

API HTTP com [Hono](https://hono.dev) (JavaScript, Node) e documentação via [Swagger UI](https://hono.dev/docs/middleware/third-party).

## Scripts

| Script | Comando | Uso |
|--------|---------|-----|
| Dev | `pnpm dev` | `node --watch` (porta padrão `3001`, `PORT` no env) |
| Build | `pnpm build` | `node --check` (validação de sintaxe) |
| Start | `pnpm start` | `node src/index.js` |

Monorepo: `pnpm dev:backend`

---

## Catálogo de rotas

Rotas de negócio ficam em `src/routes/<nome>/` e entram no app **somente** via `src/routes/index.js`.

### API

| Método | Path | Resumo | Pasta |
|--------|------|--------|-------|
| `GET` | `/health` | Verifica se o serviço está no ar | `src/routes/health/` |

**`GET /health`** — **200** `application/json`

```json
{
  "status": "ok",
  "timestamp": "2026-06-03T12:00:00.000Z"
}
```

Spec OpenAPI da rota: `src/routes/health/openapi.js` (sem Zod).

### Documentação

Montadas em `src/app.js`:

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/doc` | OpenAPI 3.0 (JSON), montado em `src/openapi/index.js` |
| `GET` | `/swagger` | Swagger UI → `/doc` |

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
3. **Sem Zod** — contrato documentado à mão em `openapi.js`; handler não valida via schema lib.
4. Ao adicionar rota: atualizar README, `routeModules` e `pathModules` em `openapi/index.js`.

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
  openapi/
    document.js
    index.js
  routes/
    index.js
    health/
      handler.js
      index.js
      openapi.js
```
