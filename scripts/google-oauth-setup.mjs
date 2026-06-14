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

const credentialsUrl = `https://console.cloud.google.com/apis/credentials?project=${project}`;
const clientUrl = `https://console.cloud.google.com/apis/credentials/oauthclient/${clientSuffix}?project=${project}`;
const authDomainsUrl = `https://console.firebase.google.com/project/${project}/authentication/settings`;

console.log("\n=== CHECKLIST LOGIN PRODUÇÃO (copie no Google Cloud / Firebase) ===\n");

console.log("1) Browser key → HTTP referrers (CAUSA #1 auth/network-request-failed)");
console.log(`   ${credentialsUrl}`);
console.log('   → "Browser key (auto created by Firebase)"');
console.log("   → Restrições do aplicativo → Referenciadores HTTP\n");
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

console.log("\n7) Validar: pnpm verify:auth\n");
console.log("Salve Google Cloud, aguarde ~2 min, teste login em https://flowdesk.ia.br\n");

const { execSync } = await import("node:child_process");
try {
  execSync(`open "${credentialsUrl}"`, { stdio: "ignore" });
} catch {
  /* headless */
}
