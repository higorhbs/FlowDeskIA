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

const webEnv = loadEnv(resolve(root, "apps/web/.env"));
const backendEnv = loadEnv(resolve(root, "apps/backend/.env"));
const env = { ...backendEnv, ...webEnv };
const waUrlDirect =
  env.NEXT_PUBLIC_WA_API_URL?.trim() || env.WA_API_PUBLIC_URL?.trim() || "";
const apiDomain = (
  waUrlDirect ||
  env.NEXT_PUBLIC_API_URL?.trim() ||
  env.API_PUBLIC_URL?.trim()
)?.trim();

if (!apiDomain) {
  console.error("\n❌ Defina NEXT_PUBLIC_API_URL ou WA_API_PUBLIC_URL em apps/web/.env ou apps/backend/.env");
  console.error("   Depois rode: pnpm setup:billing-env\n");
  process.exit(1);
}

function resolveWaApiUrl() {
  const direct =
    env.NEXT_PUBLIC_WA_API_URL?.trim() ||
    env.WA_API_PUBLIC_URL?.trim() ||
    "";
  if (direct) return direct.replace(/\/$/, "");
  return apiDomain.startsWith("http") ? apiDomain.replace(/\/$/, "") : `https://${apiDomain}`;
}

const waApiUrl = resolveWaApiUrl();
const apiUrl = waApiUrl;
if (!waApiUrl) {
  console.warn(
    "\n⚠️  NEXT_PUBLIC_WA_API_URL / WA_API_PUBLIC_URL ausente em apps/web/.env ou apps/backend/.env.",
  );
  console.warn("   WhatsApp (QR Code) não funcionará até configurar WA_API_PUBLIC_URL e publicar o front.\n");
}

const keys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_GOOGLE_ADS_ID",
  "NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL",
  "NEXT_PUBLIC_SWETRIX_PROJECT_ID",
  "NEXT_PUBLIC_SWETRIX_API_URL",
  "NEXT_PUBLIC_LEGAL_ENTITY_TYPE",
  "NEXT_PUBLIC_LEGAL_ENTITY_NAME",
  "NEXT_PUBLIC_LEGAL_ENTITY_DOCUMENT",
  "NEXT_PUBLIC_LEGAL_WEBSITE",
  "NEXT_PUBLIC_PRIVACY_EMAIL",
  "NEXT_PUBLIC_SUPPORT_EMAIL",
];

const lines = [
  `# Gerado por scripts/setup-billing-env.mjs — não commitar`,
  `NEXT_PUBLIC_API_URL=${apiUrl}`,
  `NEXT_PUBLIC_WA_API_URL=${waApiUrl}`,
  "",
  ...keys.map((k) => `${k}=${env[k] ?? ""}`),
  "",
  "# Checkout via API (obrigatório para ativar plano automático)",
  "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER=",
  "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO=",
  "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_UNLIMITED=",
  "NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL=",
  "",
];

const outPath = resolve(root, "apps/web/.env.production");
writeFileSync(outPath, lines.join("\n"));
const swetrixId = env.NEXT_PUBLIC_SWETRIX_PROJECT_ID?.trim() ?? "";
console.log(`\n✅ ${outPath}`);
console.log(`   NEXT_PUBLIC_API_URL=${apiUrl}`);
if (waApiUrl) console.log(`   NEXT_PUBLIC_WA_API_URL=${waApiUrl}`);
if (swetrixId) console.log(`   NEXT_PUBLIC_SWETRIX_PROJECT_ID=${swetrixId}`);
else console.warn("   ⚠️  NEXT_PUBLIC_SWETRIX_PROJECT_ID vazio — Swetrix não grava visitas no build.");
console.log("\nPróximo: pnpm build:hosting e publique apps/web/out no Firebase Hosting (console).\n");
