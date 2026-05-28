import { FastifyInstance } from "fastify";
import { getDb, getTenant } from "@zapflow/firebase";
import { requireAuth } from "../middleware/auth";

export async function privacyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/privacy/export", async (req, reply) => {
    const tenantId = req.tenantId;
    const db = getDb();
    const tenant = await getTenant(tenantId);
    if (!tenant) return reply.status(404).send({ error: "Conta não encontrada" });

    const businessesSnap = await db
      .collection("businesses")
      .where("tenantId", "==", tenantId)
      .get();

    const businesses = await Promise.all(
      businessesSnap.docs.map(async (businessDoc) => {
        const businessId = businessDoc.id;
        const [catalogSnap, faqsSnap, conversationsSnap, appointmentsSnap, paymentsSnap] = await Promise.all([
          db.collection("businesses").doc(businessId).collection("catalog").get(),
          db.collection("businesses").doc(businessId).collection("faqs").get(),
          db.collection("businesses").doc(businessId).collection("conversations").get(),
          db.collection("businesses").doc(businessId).collection("appointments").get(),
          db.collection("businesses").doc(businessId).collection("payments").get(),
        ]);

        const conversations = await Promise.all(
          conversationsSnap.docs.map(async (convDoc) => {
            const messagesSnap = await db
              .collection("businesses")
              .doc(businessId)
              .collection("conversations")
              .doc(convDoc.id)
              .collection("messages")
              .get();

            return {
              id: convDoc.id,
              ...convDoc.data(),
              messages: messagesSnap.docs.map((m) => ({ id: m.id, ...m.data() })),
            };
          })
        );

        return {
          id: businessId,
          ...businessDoc.data(),
          catalog: catalogSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          faqs: faqsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          conversations,
          appointments: appointmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          payments: paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        };
      })
    );

    return {
      exportedAt: new Date().toISOString(),
      tenant,
      businesses,
    };
  });
}

