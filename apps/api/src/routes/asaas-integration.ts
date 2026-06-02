import { FastifyInstance } from "fastify";
import { z } from "zod";
import axios from "axios";
import {
  deleteBusinessAsaasIntegration,
  getBusiness,
  getBusinessAsaasIntegration,
  getTenant,
  setBusinessAsaasIntegration,
} from "@flowdesk/firebase";
import { optionalEnv } from "../env";
import { requireAuth } from "../middleware/auth";
import { resolveAsaasCredentials } from "../services/pix";

function maskApiKey(key: string): string {
  const t = key.trim();
  if (t.length <= 8) return "••••••••";
  return `••••${t.slice(-4)}`;
}

function maskToken(token: string): string {
  if (token.length <= 4) return "••••";
  return `••••${token.slice(-4)}`;
}

function isLocalHost(host?: string): boolean {
  if (!host) return false;
  return /(^|\.)localhost(?::\d+)?$/.test(host) || /^127\.0\.0\.1(?::\d+)?$/.test(host);
}

function publicWebhookUrl(req?: { headers: Record<string, string | string[] | undefined> }): string {
  const envBase = optionalEnv("API_PUBLIC_URL") ?? optionalEnv("NEXT_PUBLIC_API_URL");
  if (envBase && !/localhost|127\.0\.0\.1/.test(envBase)) {
    return `${envBase.replace(/\/$/, "")}/webhooks/asaas`;
  }

  const hostHeader = req?.headers?.["x-forwarded-host"] ?? req?.headers?.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const protoHeader = req?.headers?.["x-forwarded-proto"];
  const protoFromHeader = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  if (host && !isLocalHost(host)) {
    const proto = (protoFromHeader ?? "https").split(",")[0]?.trim() || "https";
    return `${proto}://${host.replace(/\/$/, "")}/webhooks/asaas`;
  }
  const base = "https://api.flowdesk.app";
  return `${base.replace(/\/$/, "")}/webhooks/asaas`;
}

function tenantAllowsPix(plan?: string): boolean {
  return plan === "PRO" || plan === "UNLIMITED";
}

async function requirePixPlan(tenantId: string, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) {
  const tenant = await getTenant(tenantId);
  if (!tenantAllowsPix(tenant?.plan)) {
    reply.status(403).send({
      error: "Cobrança PIX automática disponível no plano Pro ou Unlimited.",
    });
    return false;
  }
  return true;
}

async function fetchAsaasBalance(creds: { apiKey: string; baseUrl: string }) {
  const res = await axios.get(`${creds.baseUrl}/finance/balance`, {
    headers: { access_token: creds.apiKey },
    timeout: 15_000,
  });
  return typeof res.data.balance === "number" ? res.data.balance : null;
}

export async function asaasIntegrationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/businesses/:id/integrations/asaas", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await getBusiness(id, req.tenantId))) {
      return reply.status(404).send({ error: "Negócio não encontrado" });
    }
    if (!(await requirePixPlan(req.tenantId, reply))) return;

    const integration = await getBusinessAsaasIntegration(id);
    const creds = resolveAsaasCredentials(integration);

    let balanceBrl: number | null = null;
    if (creds) {
      try {
        balanceBrl = await fetchAsaasBalance(creds);
      } catch {
        balanceBrl = null;
      }
    }

    return {
      configured: Boolean(creds),
      sandbox: integration?.sandbox ?? false,
      keyPreview: integration?.apiKey ? maskApiKey(integration.apiKey) : null,
      webhookTokenConfigured: Boolean(integration?.webhookToken),
      webhookTokenPreview: integration?.webhookToken ? maskToken(integration.webhookToken) : null,
      webhookUrl: publicWebhookUrl(req as { headers: Record<string, string | string[] | undefined> }),
      balanceBrl,
    };
  });

  app.put("/businesses/:id/integrations/asaas", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await getBusiness(id, req.tenantId))) {
      return reply.status(404).send({ error: "Negócio não encontrado" });
    }
    if (!(await requirePixPlan(req.tenantId, reply))) return;

    const body = z
      .object({
        apiKey: z.string().min(20).optional(),
        sandbox: z.boolean().optional(),
        webhookToken: z.string().min(8).max(200).optional(),
      })
      .parse(req.body ?? {});

    const existing = await getBusinessAsaasIntegration(id);
    const apiKey = (body.apiKey?.trim() || existing?.apiKey || "").trim();
    if (!apiKey) {
      return reply.status(400).send({ error: "Informe a Chave API do Asaas." });
    }

    const sandbox = false;
    const creds = resolveAsaasCredentials({ apiKey, sandbox });
    if (!creds) {
      return reply.status(400).send({ error: "Não foi possível validar a chave Asaas." });
    }

    try {
      await fetchAsaasBalance(creds);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chave rejeitada pelo Asaas";
      return reply.status(400).send({
        error: `Chave inválida: ${msg}.`,
      });
    }

    const webhookToken = body.webhookToken?.trim() || existing?.webhookToken;
    await setBusinessAsaasIntegration(id, { apiKey, sandbox, webhookToken });

    let balanceBrl: number | null = null;
    try {
      balanceBrl = await fetchAsaasBalance(creds);
    } catch {
      /* ignore */
    }

    return {
      configured: true,
      sandbox,
      keyPreview: maskApiKey(apiKey),
      webhookTokenConfigured: Boolean(webhookToken),
      webhookUrl: publicWebhookUrl(req as { headers: Record<string, string | string[] | undefined> }),
      balanceBrl,
    };
  });

  app.delete("/businesses/:id/integrations/asaas", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await getBusiness(id, req.tenantId))) {
      return reply.status(404).send({ error: "Negócio não encontrado" });
    }
    if (!(await requirePixPlan(req.tenantId, reply))) return;
    await deleteBusinessAsaasIntegration(id);
    return reply.status(204).send();
  });
}
