# syntax=docker/dockerfile:1

FROM --platform=$TARGETPLATFORM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

FROM base AS builder
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=768"

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/firebase/package.json ./packages/firebase/
COPY packages/whatsapp-client/package.json ./packages/whatsapp-client/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @flowdesk/backend...

COPY packages ./packages
COPY apps/backend ./apps/backend
COPY scripts ./scripts

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
