# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

FROM base AS builder
WORKDIR /ctx
COPY . .
RUN set -eux; \
  mkdir -p /app/apps/backend /app/packages; \
  if [ -f pnpm-lock.yaml ] && [ -d apps/backend ] && [ -f apps/backend/package.json ]; then \
    cp pnpm-lock.yaml /app/; \
    cp pnpm-workspace.yaml package.json /app/; \
    cp -a packages/. /app/packages/; \
    cp -a apps/backend/. /app/apps/backend/; \
  elif [ -f package.json ] && [ -d src ] && [ -f pnpm-lock.yaml ] && [ -d packages ]; then \
    cp pnpm-lock.yaml /app/; \
    cp docker/pnpm-workspace.yaml /app/pnpm-workspace.yaml; \
    cp docker/root.package.json /app/package.json; \
    cp package.json /app/apps/backend/package.json; \
    cp -a packages/. /app/packages/; \
    find . -mindepth 1 -maxdepth 1 \
      ! -name packages \
      ! -name pnpm-lock.yaml \
      ! -name pnpm-workspace.yaml \
      ! -name docker \
      ! -name node_modules \
      ! -name .git \
      -exec cp -a {} /app/apps/backend/ \; ; \
  else \
    echo "Docker: inclua pnpm-lock.yaml e packages/ no contexto, ou use Docker Context Path = . na raiz do repo." >&2; \
    exit 1; \
  fi

WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=768"

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @flowdesk/backend...

RUN pnpm --filter @flowdesk/backend build
RUN pnpm deploy --filter=@flowdesk/backend --prod /prod/backend

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"
ENV PORT=3001

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 flowdesk \
    && useradd --system --uid 1001 --gid flowdesk flowdesk \
    && mkdir -p /app/data \
    && chown flowdesk:flowdesk /app/data

COPY --from=builder --chown=flowdesk:flowdesk /prod/backend ./

USER flowdesk
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/index.js"]
