#!/usr/bin/env node
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.trim() ||
  process.env.NEXT_PUBLIC_WA_API_URL?.trim() ||
  apiUrl;

const keys = [
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_BACKEND_URL",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_GOOGLE_ADS_ID",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER",
  "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO",
  "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_UNLIMITED",
  "NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL",
];

if (!apiUrl) {
  console.error("NEXT_PUBLIC_API_URL ausente no ambiente do CI.");
  process.exit(1);
}

const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? "";
if (!firebaseApiKey.startsWith("AIza")) {
  console.error(
    "\n❌ NEXT_PUBLIC_FIREBASE_API_KEY inválida no GitHub Secrets (valor atual parece placeholder).\n" +
      "   No Mac, com .env correto: pnpm setup:github-deploy\n" +
      "   Depois dispare de novo o workflow Deploy to Firebase Hosting.\n",
  );
  process.exit(1);
}

const authDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || "zapflow-higor-2026.web.app";
const projectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "zapflow-higor-2026";

const lines = keys.map((k) => {
  if (k === "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") return `${k}=${authDomain}`;
  if (k === "NEXT_PUBLIC_FIREBASE_PROJECT_ID") return `${k}=${projectId}`;
  if (k === "NEXT_PUBLIC_BACKEND_URL") return `${k}=${backendUrl}`;
  return `${k}=${process.env[k] ?? ""}`;
});
writeFileSync(resolve(root, "apps/web/.env.production"), `${lines.join("\n")}\n`);
console.log("apps/web/.env.production gerado para CI.");
