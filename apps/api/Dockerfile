FROM node:20-alpine AS builder
ARG NODE_OPTIONS=--max-old-space-size=384
ENV NODE_OPTIONS=${NODE_OPTIONS}
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/firebase/package.json packages/firebase/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY apps/api apps/api
COPY packages/firebase packages/firebase
COPY packages/shared packages/shared
RUN pnpm --filter @flowdesk/firebase build \
  && pnpm --filter @flowdesk/shared build \
  && pnpm --filter @flowdesk/api build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/firebase/package.json packages/firebase/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --prod --ignore-scripts && pnpm store prune

COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/packages/firebase/dist packages/firebase/dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist

RUN mkdir -p /app/sessions && chown node:node /app/sessions
USER node

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
