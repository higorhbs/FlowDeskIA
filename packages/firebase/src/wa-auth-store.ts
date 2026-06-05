import {
  clearWhatsAppAuth,
  readWhatsAppAuthFile,
  removeWhatsAppAuthFile,
  sanitizeWaAuthFileName,
  writeWhatsAppAuthFile,
} from "./wa-auth-files.js";

export interface WaAuthFileStore {
  businessId: string;
  read(file: string): Promise<string | null>;
  write(file: string, payload: string): Promise<void>;
  remove(file: string): Promise<void>;
  clear(): Promise<void>;
}

export function createWaAuthFileStore(businessId: string): WaAuthFileStore {
  return {
    businessId,
    read: async (file) => readWhatsAppAuthFile(businessId, sanitizeWaAuthFileName(file)),
    write: async (file, payload) =>
      writeWhatsAppAuthFile(businessId, sanitizeWaAuthFileName(file), payload),
    remove: async (file) => removeWhatsAppAuthFile(businessId, sanitizeWaAuthFileName(file)),
    clear: async () => clearWhatsAppAuth(businessId),
  };
}
