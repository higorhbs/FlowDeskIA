#!/usr/bin/env node
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    if (process.env[key] === undefined) {
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadEnvFile(resolve(root, "apps/backend/.env"));
loadEnvFile(resolve(root, "apps/web/.env"));

const project = process.env.FIREBASE_PROJECT_ID?.trim();
if (!project) {
  console.error("Defina FIREBASE_PROJECT_ID em apps/backend/.env ou apps/web/.env");
  process.exit(1);
}

const clientSuffix = "295076612394-8k6ecbb35gps827lj3um1efvofbj3gj6";
const PROD_ORIGINS = [
  "https://flowdesk.ia.br",
  "https://flow-desk-ia.vercel.app",
];

const site = `https://${project}.web.app`;
const firebaseApp = `https://${project}.firebaseapp.com`;
const handlerFirebase = `${firebaseApp}/__/auth/handler`;
const handlerWeb = `${site}/__/auth/handler`;
const handlerLocal = "http://localhost:3000/__/auth/handler";
const handlerLocal127 = "http://127.0.0.1:3000/__/auth/handler";

const customOrigin = (process.env.WEB_ORIGIN || process.env.NEXT_PUBLIC_SITE_ORIGIN || "")
  .trim()
  .replace(/\/$/, "");

const allOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  site,
  firebaseApp,
  ...PROD_ORIGINS,
]);
if (customOrigin) allOrigins.add(customOrigin);

const redirects = new Set([handlerWeb, handlerFirebase, handlerLocal, handlerLocal127]);
for (const o of PROD_ORIGINS) {
  redirects.add(`${o}/__/auth/handler`);
}
if (customOrigin && !customOrigin.includes("localhost")) {
  redirects.add(`${customOrigin}/__/auth/handler`);
}

const referrers = new Set([
  `https://${project}.web.app/*`,
  `https://${project}.firebaseapp.com/*`,
  "http://localhost:3000/*",
  "http://127.0.0.1:3000/*",
]);
for (const o of allOrigins) {
  try {
    referrers.add(`${new URL(o).origin}/*`);
  } catch {
    /* ignore */
  }
}

const apiKey =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
  process.env.FIREBASE_WEB_API_KEY?.trim() ||
  "";

const credentialsUrl = `https://console.cloud.google.com/apis/credentials?project=${project}`;
const clientUrl = `https://console.cloud.google.com/apis/credentials/oauthclient/${clientSuffix}?project=${project}`;
const authDomainsUrl = `https://console.firebase.google.com/project/${project}/authentication/settings`;

async function probeBrowserKey() {
  if (!apiKey) return;
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "a.b.c", returnSecureToken: true }),
  });
  const data = await res.json().catch(() => ({}));
  const msg = String(data?.error?.message || "");
  const reason = String(data?.error?.errors?.[0]?.reason || "");
  if (/referer|referrer/i.test(msg) || reason.includes("API_KEY_HTTP_REFERRER_BLOCKED")) {
    console.log("\n⚠️  Browser key BLOQUEADA (referrer vazio — SDK Firebase não envia Referer).");
    console.log("   Corrija no passo 1: Restrições do aplicativo → Nenhuma.\n");
    return;
  }
  if (/API_KEY_INVALID|API key not valid/i.test(msg)) {
    console.log("\n⚠️  API key inválida ou de outro projeto. Confira Vercel + .env.\n");
    return;
  }
  if (/blocked|API_KEY_SERVICE_BLOCKED|PERMISSION_DENIED/i.test(msg)) {
    console.log("\n⚠️  API restrictions bloqueando Identity Toolkit. Veja passo 1b.\n");
    return;
  }
  if (msg.includes("INVALID_CUSTOM_TOKEN")) {
    console.log("\n✓  Browser key responde (sem bloqueio de referrer/API). Se login falha, veja passos 2–6.\n");
  }
}

console.log("\n=== CHECKLIST LOGIN (MANUAL no Google Cloud / Firebase) ===");
console.log("Este script NÃO aplica mudanças — só lista o que colar no console.\n");
await probeBrowserKey();

console.log("1) Browser key (CAUSA #1 auth/network-request-failed)");
console.log(`   ${credentialsUrl}`);
console.log(`   → Chave com API key ${apiKey ? apiKey.slice(0, 8) + "…" : "(defina NEXT_PUBLIC_FIREBASE_API_KEY)"}`);
console.log('   → "Browser key (auto created by Firebase)" — NÃO outra chave');
console.log("   → Restrições do aplicativo → Nenhuma");
console.log("     (Firebase JS SDK usa referrerPolicy no-referrer; HTTP referrers quebram signInWithCustomToken)");
console.log("1b) Mesma chave → Restrições de API → Não restringir chave");
console.log("     (ou permita: Identity Toolkit API, Token Service API, Firebase Installations API)");
console.log("\n   Se INSISTIR em HTTP referrers (não recomendado), inclua também:\n");
for (const r of referrers) console.log(`   ${r}`);

console.log("\n2) OAuth Web client → JavaScript origins");
console.log(`   ${clientUrl}\n`);
for (const o of allOrigins) console.log(`   ${o}`);

console.log("\n3) OAuth Web client → Redirect URIs\n");
for (const r of redirects) console.log(`   ${r}`);

console.log("\n4) Firebase → Authorized domains");
console.log(`   ${authDomainsUrl}\n`);
console.log("   localhost");
console.log(`   ${project}.web.app`);
console.log(`   ${project}.firebaseapp.com`);
for (const o of PROD_ORIGINS) {
  try {
    console.log(`   ${new URL(o).hostname}`);
  } catch {
    /* ignore */
  }
}

console.log("\n5) Dokploy backend (Environment)\n");
console.log("   FIREBASE_PROJECT_ID=zapflow-higor-2026");
console.log("   FIREBASE_WEB_API_KEY=(igual NEXT_PUBLIC_FIREBASE_API_KEY)");
console.log("   FIREBASE_CLIENT_EMAIL=(service account)");
console.log("   FIREBASE_PRIVATE_KEY=(chave com \\n)");
console.log("   CORS_ORIGIN=https://flowdesk.ia.br");
console.log("   WEB_ORIGIN=https://flowdesk.ia.br");

console.log("\n6) Vercel (Production) + REDEPLOY obrigatório\n");
console.log("   BACKEND_INTERNAL_URL=https://flowdesk.victorsouza.dev");
console.log("   NEXT_PUBLIC_BACKEND_URL=https://flowdesk.victorsouza.dev");
console.log("   NEXT_PUBLIC_API_URL=https://flowdesk.victorsouza.dev");
console.log("   NEXT_PUBLIC_WA_API_URL=https://flowdesk.victorsouza.dev");

console.log("\n7) NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN → use firebaseapp.com (não .web.app)");
console.log(`   ${firebaseApp.replace("https://", "")}`);
console.log("\n8) Validar: pnpm verify:auth → depois login em https://flowdesk.ia.br");
console.log("   Após mudar env na Vercel: REDEPLOY produção obrigatório.\n");
console.log("Salve Google Cloud, aguarde ~2 min, teste login.\n");

const { execSync } = await import("node:child_process");
try {
  execSync(`open "${credentialsUrl}"`, { stdio: "ignore" });
} catch {
  /* headless */
}
