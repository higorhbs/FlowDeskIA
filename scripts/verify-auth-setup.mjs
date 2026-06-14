#!/usr/bin/env node

const API = process.env.AUTH_VERIFY_API?.trim() || "https://flowdesk.victorsouza.dev";
const WEB = process.env.AUTH_VERIFY_WEB?.trim() || "https://flowdesk.ia.br";

async function check(label, url, init) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 120);
    }
    const ok = res.ok || res.status === 400 || res.status === 401;
    console.log(`${ok ? "OK" : "FAIL"} ${label} → ${res.status}`);
    if (!ok) console.log(`     ${typeof body === "string" ? body : JSON.stringify(body)}`);
    return ok;
  } catch (err) {
    console.log(`FAIL ${label} → ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

console.log(`\nVerificando auth (${API} + ${WEB})...\n`);

const results = await Promise.all([
  check("API /health", `${API}/health`),
  check("API POST /auth/google", `${API}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: WEB },
    body: "{}",
  }),
  check("Vercel proxy /api/backend/auth/google", `${WEB}/api/backend/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }),
]);

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks ok.`);

if (passed < results.length) {
  console.log("Corrija rede/Dokploy/Vercel antes do Firebase.\n");
  process.exit(1);
}

console.log("Backend + proxy ok. Se login ainda falha:");
console.log("→ Browser key HTTP referrers: pnpm google:oauth-setup (passo 1)\n");
