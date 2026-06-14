import { readFileSync, existsSync, accessSync, constants } from "fs";
import { resolve } from "path";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage, type Storage } from "firebase-admin/storage";

let app: App;

function resolveServiceAccountPath(): string | undefined {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!raw) return undefined;
  const candidates = [
    resolve(raw),
    resolve(process.cwd(), raw),
    resolve(process.cwd(), "apps/backend", raw),
    resolve(process.cwd(), "../..", raw),
    resolve(process.cwd(), "..", raw),
  ];
  return candidates.find((p) => {
    if (!existsSync(p)) return false;
    try {
      accessSync(p, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

function privateKeyLooksValid(key: string | undefined): boolean {
  if (!key) return false;
  return key.includes("BEGIN PRIVATE KEY") && key.includes("END PRIVATE KEY");
}

type ServiceAccountCreds = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function parseServiceAccountJson(raw: string): ServiceAccountCreds | null {
  try {
    const sa = JSON.parse(raw) as {
      project_id?: string;
      projectId?: string;
      client_email?: string;
      clientEmail?: string;
      private_key?: string;
      privateKey?: string;
    };
    const projectId = sa.project_id ?? sa.projectId;
    const clientEmail = sa.client_email ?? sa.clientEmail;
    const privateKey = normalizePrivateKey(sa.private_key ?? sa.privateKey);
    if (!projectId || !clientEmail || !privateKey) return null;
    return { projectId, clientEmail, privateKey };
  } catch {
    return null;
  }
}

function loadServiceAccountFromEnv(): ServiceAccountCreds | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const parsed = parseServiceAccountJson(json);
    if (parsed) return parsed;
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (b64) {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const parsed = parseServiceAccountJson(decoded);
    if (parsed) return parsed;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (projectId && clientEmail && privateKey) {
    if (!privateKeyLooksValid(privateKey)) return null;
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

export function hasAdminCredential(): boolean {
  if (loadServiceAccountFromEnv() !== null) return true;
  return resolveServiceAccountPath() !== undefined;
}

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;

  const fromEnv = loadServiceAccountFromEnv();
  if (fromEnv) {
    app = initializeApp({
      credential: cert(fromEnv),
    });
    return app;
  }

  const saPath = resolveServiceAccountPath();
  if (saPath) {
    const serviceAccount = JSON.parse(readFileSync(saPath, "utf8")) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    app = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });
    return app;
  }

  app = initializeApp();
  return app;
}

export function getDb(): Firestore {
  initAdmin();
  return getFirestore();
}

export function getAdminAuth(): Auth {
  initAdmin();
  return getAuth();
}

function resolveStorageBucketName(): string {
  const explicit = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (explicit) return explicit;
  const fromEnv = loadServiceAccountFromEnv()?.projectId;
  if (fromEnv) return `${fromEnv}.firebasestorage.app`;
  const saPath = resolveServiceAccountPath();
  if (saPath) {
    try {
      const sa = JSON.parse(readFileSync(saPath, "utf8")) as { project_id?: string };
      if (sa.project_id) return `${sa.project_id}.firebasestorage.app`;
    } catch {
      /* ignore */
    }
  }
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (projectId) return `${projectId}.firebasestorage.app`;
  throw new Error("FIREBASE_STORAGE_BUCKET não configurado.");
}

export function getAdminStorage(): Storage {
  initAdmin();
  return getStorage();
}

export function getStorageBucket(): ReturnType<Storage["bucket"]> {
  return getAdminStorage().bucket(resolveStorageBucketName());
}

export function newId(): string {
  return getDb().collection("_").doc().id;
}

export function nowIso(): string {
  return new Date().toISOString();
}
