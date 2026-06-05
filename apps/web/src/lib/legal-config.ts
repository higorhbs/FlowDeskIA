import {
  DEFAULT_LEGAL_ENTITY_DOCUMENT,
  DEFAULT_LEGAL_ENTITY_NAME,
  DEFAULT_LEGAL_ENTITY_TYPE,
  DEFAULT_LEGAL_WEBSITE,
  DEFAULT_PRIVACY_EMAIL,
  DEFAULT_SUPPORT_EMAIL,
  type LegalEntityConfig,
  type LegalEntityType,
} from "@flowdesk/shared";

function readEntityType(raw: string | undefined): LegalEntityType {
  return raw?.trim().toUpperCase() === "PF" ? "PF" : "CNPJ";
}

export function getLegalEntityConfig(): LegalEntityConfig {
  return {
    type: readEntityType(process.env.NEXT_PUBLIC_LEGAL_ENTITY_TYPE),
    name: process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() || DEFAULT_LEGAL_ENTITY_NAME,
    document: process.env.NEXT_PUBLIC_LEGAL_ENTITY_DOCUMENT?.trim() || DEFAULT_LEGAL_ENTITY_DOCUMENT,
    privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || DEFAULT_PRIVACY_EMAIL,
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL,
    website: process.env.NEXT_PUBLIC_LEGAL_WEBSITE?.trim() || DEFAULT_LEGAL_WEBSITE,
  };
}

export function getSupportMailtoUrl(subject: string): string {
  const { supportEmail } = getLegalEntityConfig();
  const q = new URLSearchParams({ view: "cm", fs: "1", to: supportEmail, su: subject });
  return `https://mail.google.com/mail/?${q.toString()}`;
}
