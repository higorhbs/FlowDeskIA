import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Parser mínimo de .env (KEY=VALUE, ignora comentários e linhas vazias). */
export function loadEnvFile(path = resolve(process.cwd(), ".env")) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function loadConfig() {
  loadEnvFile();
  const apiBaseUrl = process.env.FLOWDESK_API_BASE_URL?.trim().replace(/\/+$/, "");
  const businessId = process.env.FLOWDESK_BUSINESS_ID?.trim();
  const agentToken = process.env.FLOWDESK_AGENT_TOKEN?.trim();
  const printerName = process.env.FLOWDESK_PRINTER_NAME?.trim() || undefined;

  const missing = [];
  if (!apiBaseUrl) missing.push("FLOWDESK_API_BASE_URL");
  if (!businessId) missing.push("FLOWDESK_BUSINESS_ID");
  if (!agentToken) missing.push("FLOWDESK_AGENT_TOKEN");
  if (missing.length) {
    throw new Error(
      `Configuração incompleta. Defina no .env: ${missing.join(", ")}. Veja .env.example.`,
    );
  }

  return { apiBaseUrl, businessId, agentToken, printerName };
}
