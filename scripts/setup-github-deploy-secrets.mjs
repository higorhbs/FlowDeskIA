#!/usr/bin/env node
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

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

function ghSecretSet(name, value) {
  if (!value?.trim()) {
    console.log(`⏭  ${name} vazio — pulando`);
    return;
  }
  execSync(`gh secret set ${name} --body ${JSON.stringify(value)}`, {
    cwd: root,
    stdio: "inherit",
  });
  console.log(`✅ ${name}`);
}

const rootEnv = loadEnv(resolve(root, ".env"));
const webEnv = loadEnv(resolve(root, "apps/web/.env.production"));
const exampleEnv = loadEnv(resolve(root, "apps/web/.env.example"));
const merged = { ...exampleEnv, ...rootEnv, ...webEnv };

if (!merged.NEXT_PUBLIC_API_URL?.trim()) {
  const domain = merged.API_DOMAIN?.trim();
  if (domain) {
    merged.NEXT_PUBLIC_API_URL = domain.startsWith("http")
      ? domain.replace(/\/$/, "")
      : `https://${domain}`;
  }
}

if (!merged.NEXT_PUBLIC_API_URL?.trim()) {
  console.error("\n❌ Defina NEXT_PUBLIC_API_URL ou API_DOMAIN no .env antes de rodar este script.\n");
  process.exit(1);
}

if (!merged.NEXT_PUBLIC_BACKEND_URL?.trim()) {
  merged.NEXT_PUBLIC_BACKEND_URL =
    merged.WA_API_PUBLIC_URL?.trim() ||
    merged.NEXT_PUBLIC_WA_API_URL?.trim() ||
    merged.BACKEND_PUBLIC_URL?.trim() ||
    "";
}

try {
  execSync("gh auth status", { cwd: root, stdio: "ignore" });
} catch {
  console.error("\n❌ Faça login no GitHub CLI: gh auth login\n");
  process.exit(1);
}

console.log("\nConfigurando secrets do deploy automático...\n");

const webKeys = [
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_BACKEND_URL",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER",
  "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO",
  "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_UNLIMITED",
  "NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL",
];

for (const key of webKeys) ghSecretSet(key, merged[key] ?? "");

console.log(`
Próximo passo (só uma vez):
  firebase login
  firebase init hosting:github

Escolha o repo higorhbs/FlowDesk, branch main, projeto zapflow-higor-2026.
Isso cria o secret FIREBASE_SERVICE_ACCOUNT_ZAPFLOW_HIGOR_2026.

Se os workflows já existirem, cancele a sobrescrita — eles já estão no repo.

Depois: git push origin main → deploy automático.
`);
