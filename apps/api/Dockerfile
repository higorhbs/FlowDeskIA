FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY packages/database/package*.json packages/database/
COPY packages/shared/package*.json packages/shared/
COPY packages/whatsapp-client/package*.json packages/whatsapp-client/

RUN npm ci

COPY apps/api apps/api
COPY packages/database packages/database
COPY packages/shared packages/shared
COPY packages/whatsapp-client packages/whatsapp-client
RUN npm run build --workspace @zapflow/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY packages/database/package*.json packages/database/
COPY packages/shared/package*.json packages/shared/
COPY packages/whatsapp-client/package*.json packages/whatsapp-client/

RUN npm ci --omit=dev --workspaces --include-workspace-root && npm cache clean --force

COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/packages/database/dist packages/database/dist
COPY --from=builder /app/packages/database/prisma packages/database/prisma
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/whatsapp-client/dist packages/whatsapp-client/dist
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma

RUN mkdir -p /app/sessions && chown -R node:node /app
USER node

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
