import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createTenant, getTenant } from "@flowdesk/firebase";
import { requireAuth } from "../middleware/auth";

const syncBody = z.object({
  name: z.string().min(2).optional(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/sync", { preHandler: requireAuth }, async (req, reply) => {
    try {
      const body = syncBody.parse(req.body ?? {});
      let tenant = await getTenant(req.tenantId);
      if (tenant) return tenant;

      if (!req.tenantEmail) {
        return reply.status(400).send({ error: "E-mail não encontrado na conta Firebase" });
      }

      let email = req.tenantEmail;

      tenant = await createTenant(req.tenantId, {
        name: body.name ?? email.split("@")[0] ?? "Usuário",
        email,
      });
      return reply.status(201).send(tenant);
    } catch (err) {
      req.log.error({ err }, "auth/sync failed");
      return reply.status(500).send({ error: "Erro ao sincronizar perfil no servidor" });
    }
  });
}
