import {
  createBusiness,
  getBusiness,
  listBusinesses,
  updateBusiness,
} from "@flowdesk/firebase";
import type { Business, BusinessCreateInput, BusinessType } from "@flowdesk/firebase/client";
import { ApiError } from "../api-error";

const BUSINESS_TYPES = new Set<BusinessType>([
  "BARBERSHOP",
  "SALON",
  "RESTAURANT",
  "DENTAL",
  "STORE",
  "OTHER",
]);

function normalizePhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export type CreateBusinessBody = {
  name?: string;
  type?: string;
  phone?: string;
  whatsapp?: string;
  description?: string;
  typeLabel?: string;
  address?: string;
  greetingMsg?: string;
  awayMsg?: string;
  workingHours?: Record<string, [string, string] | null>;
};

function parseCreateBody(body: CreateBusinessBody): BusinessCreateInput {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim().toUpperCase() : "";
  const phone = normalizePhone(
    typeof body.whatsapp === "string"
      ? body.whatsapp
      : typeof body.phone === "string"
        ? body.phone
        : "",
  );
  const description =
    typeof body.description === "string" ? body.description.trim() : undefined;
  const typeLabel = typeof body.typeLabel === "string" ? body.typeLabel.trim() : undefined;
  const address = typeof body.address === "string" ? body.address.trim() : undefined;
  const greetingMsg =
    typeof body.greetingMsg === "string" ? body.greetingMsg.trim() : undefined;
  const awayMsg = typeof body.awayMsg === "string" ? body.awayMsg.trim() : undefined;
  const workingHours =
    body.workingHours && typeof body.workingHours === "object" ? body.workingHours : undefined;

  if (name.length < 2) {
    throw new ApiError("Informe o nome do negócio (mín. 2 caracteres).", 400);
  }
  if (!BUSINESS_TYPES.has(type as BusinessType)) {
    throw new ApiError(
      "Tipo inválido. Use: BARBERSHOP, SALON, RESTAURANT, DENTAL, STORE ou OTHER.",
      400,
    );
  }
  if (!phone) {
    throw new ApiError("Informe um número de WhatsApp válido (10 a 15 dígitos).", 400);
  }

  return {
    name,
    type: type as BusinessType,
    phone,
    ...(description ? { description } : {}),
    ...(typeLabel ? { typeLabel } : {}),
    ...(address ? { address } : {}),
    ...(greetingMsg ? { greetingMsg } : {}),
    ...(awayMsg ? { awayMsg } : {}),
    ...(workingHours ? { workingHours } : {}),
  };
}

export async function listBusinessesForUser(uid: string): Promise<Business[]> {
  const items = await listBusinesses(uid);
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBusinessForUser(uid: string, id: string): Promise<Business> {
  const business = await getBusiness(id, uid);
  if (!business) throw new ApiError("Negócio não encontrado ou sem acesso.", 404);
  return business;
}

export async function createBusinessForUser(
  uid: string,
  body: CreateBusinessBody,
): Promise<Business> {
  const existing = await listBusinesses(uid);
  if (existing.length > 0) {
    throw new ApiError("Sua conta já possui um negócio cadastrado.", 400);
  }
  const data = parseCreateBody(body);
  return createBusiness(uid, data);
}

export async function updateBusinessForUser(
  uid: string,
  id: string,
  patch: Partial<Business>,
): Promise<Business> {
  const updated = await updateBusiness(id, uid, patch);
  if (!updated) throw new ApiError("Negócio não encontrado ou sem acesso.", 404);
  return updated;
}

export async function getPrimaryBusiness(uid: string): Promise<Business | null> {
  const items = await listBusinessesForUser(uid);
  return items[0] ?? null;
}
