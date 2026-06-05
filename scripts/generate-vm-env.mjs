#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

const env = loadEnv(resolve(root, ".env"));
const pick = (key, fallback = "") => env[key]?.trim() || fallback;

const waHost = pick("WA_API_DOMAIN", "zapflow.duckdns.org").replace(/^https?:\/\//, "").replace(/\/$/, "");
const billingDomain = (
  pick("BILLING_API_DOMAIN") ||
  pick("API_DOMAIN", waHost)
)
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

const acmeEmail = pick("ACME_EMAIL");
if (!acmeEmail) {
  console.error("\n❌ Defina ACME_EMAIL no .env da raiz\n");
  process.exit(1);
}

const hostingOrigins = [
  "https://zapflow-higor-2026.web.app",
  "https://zapflow-higor-2026.firebaseapp.com",
  "https://flowdesk.ia.br",
];
const corsFromEnv = pick("CORS_ORIGIN")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const corsOrigin = [...new Set([...hostingOrigins, ...corsFromEnv.filter((o) => !o.includes("localhost"))])].join(
  ",",
);

const webOrigin = pick("WEB_ORIGIN", "https://flowdesk.ia.br");
const internalSecret = pick("INTERNAL_NOTIFY_SECRET", "change-me-internal-secret");

const vmLines = [
  "# FlowDesk na VM — cole em ~/FlowDesk/.env",
  `# Billing: https://${billingDomain} (Caddy → api)`,
  `# WhatsApp: https://${waHost} (proxy para backend:3001)`,
  "",
  `API_DOMAIN=${billingDomain}`,
  `ACME_EMAIL=${acmeEmail}`,
  `WA_API_PUBLIC_URL=https://${waHost}`,
  `WEB_ORIGIN=${webOrigin}`,
  `CORS_ORIGIN=${corsOrigin}`,
  "",
  `FIREBASE_PROJECT_ID=${pick("FIREBASE_PROJECT_ID", "zapflow-higor-2026")}`,
  `FIREBASE_CLIENT_EMAIL=${pick("FIREBASE_CLIENT_EMAIL", "firebase-adminsdk-fbsvc@zapflow-higor-2026.iam.gserviceaccount.com")}`,
  "GOOGLE_APPLICATION_CREDENTIALS=/app/.secrets/firebase-adminsdk.json",
  "",
  "ENABLE_WORKERS=true",
  "REDIS_URL=redis://redis:6379",
  "WA_SESSION_PATH=/app/sessions",
  "WA_STATUS_MEDIA_PATH=/app/status-media",
  "WA_CHAT_MEDIA_PATH=/app/chat-media",
  "",
  `BACKEND_NOTIFY_URL=http://backend:3001`,
  `INTERNAL_NOTIFY_SECRET=${internalSecret}`,
  "",
  `STRIPE_SECRET_KEY=${pick("STRIPE_SECRET_KEY")}`,
  `STRIPE_WEBHOOK_SECRET=${pick("STRIPE_WEBHOOK_SECRET")}`,
  `STRIPE_PRICE_STARTER=${pick("STRIPE_PRICE_STARTER")}`,
  `STRIPE_PRICE_PRO=${pick("STRIPE_PRICE_PRO")}`,
  `STRIPE_PRICE_UNLIMITED=${pick("STRIPE_PRICE_UNLIMITED")}`,
  "",
  `ASAAS_API_KEY=${pick("ASAAS_API_KEY")}`,
  `ASAAS_BASE_URL=${pick("ASAAS_BASE_URL", "https://api.asaas.com/api/v3")}`,
  `ASAAS_WEBHOOK_TOKEN=${pick("ASAAS_WEBHOOK_TOKEN")}`,
  "",
];

const vmPath = resolve(root, ".env.vm");
writeFileSync(vmPath, `${vmLines.join("\n")}\n`);

console.log(`\n✅ ${vmPath}`);
console.log(`   Billing API: https://${billingDomain}`);
console.log(`   Backend WA: https://${waHost}`);
if (!pick("STRIPE_WEBHOOK_SECRET")) {
  console.warn("\n⚠️  STRIPE_WEBHOOK_SECRET vazio no .env — preencha na VM após criar webhook no Stripe");
}
console.log("\nNa VM (~/FlowDesk):");
console.log("  mkdir -p .secrets");
console.log("  nano .env   # cole .env.vm");
console.log("  docker compose -f docker-compose.prod.yml up -d --build");
console.log("\nNo Mac (credencial):");
console.log("  scp .secrets/firebase-adminsdk.json ubuntu@VM:~/FlowDesk/.secrets/\n");
