import {
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  reload,
  type User,
} from "firebase/auth";
import { getClientAuth } from "@flowdesk/firebase/client";
import {
  backendConfirmVerification,
  backendConfirmVerificationSession,
  backendGoogle,
  backendLogin,
  backendRegister,
  backendResendVerification,
  backendResendVerificationSession,
  backendUpdateProfileEmail,
  backendUpdateProfileName,
  backendUpdateProfilePassword,
} from "./backend-auth";
import { syncServerSession } from "./server/session-client";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (config?: {
    prompt?: "" | "consent" | "select_account" | "none";
  }) => void;
};

type GoogleOAuth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
  }) => GoogleTokenClient;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleOAuth2;
      };
    };
  }
}

let googleIdentityScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google Identity Services só funciona no navegador"),
    );
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (!googleIdentityScriptPromise) {
    googleIdentityScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Falha ao carregar o Google Sign-In."));
      document.head.appendChild(script);
    });
  }
  return googleIdentityScriptPromise;
}

async function establishSession(
  customToken: string,
): Promise<{ token: string; user: User }> {
  const auth = getClientAuth();
  const cred = await signInWithCustomToken(auth, customToken);
  const token = await cred.user.getIdToken(true);
  await syncServerSession(token).catch(() => {});
  return { token, user: cred.user };
}

export type EmailAuthResult =
  | { status: "VERIFIED"; token: string; user: User }
  | { status: "VERIFICATION_REQUIRED"; email: string };

export function authErrorMessage(err: unknown, fallback: string): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  const map: Record<string, string> = {
    "auth/popup-closed-by-user": "Login cancelado.",
    "auth/popup-blocked":
      "Popup bloqueado. Permita popups para localhost:3000.",
    "auth/cancelled-popup-request": "Login cancelado.",
    "auth/unauthorized-domain":
      "Domínio não autorizado. Em Firebase → Authentication → Settings, adicione localhost.",
    "auth/operation-not-allowed":
      "Ative o provedor Google em Firebase → Authentication → Sign-in method.",
    "auth/account-exists-with-different-credential":
      "Este e-mail já está cadastrado com outro método de login.",
    "auth/invalid-credential": "Credenciais inválidas.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/email-already-in-use": "E-mail já cadastrado.",
    "auth/weak-password": "Senha muito fraca (mínimo 6 caracteres).",
    "auth/requires-recent-login":
      "Por segurança, saia e entre de novo antes de alterar e-mail ou senha.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/email-not-verified": "Confirme seu e-mail antes de acessar o painel.",
    "auth/network-request-failed":
      "Firebase bloqueou a sessão. Confira API Key (HTTP referrers) e domínios autorizados: flowdesk.ia.br e localhost. Rode pnpm google:oauth-setup.",
    "permission-denied":
      "Sem permissão no Firestore. Confira as regras e o login.",
  };
  const raw = err instanceof Error ? err.message : fallback;
  if (/failed to fetch|load failed|networkerror/i.test(raw)) {
    return "API de autenticação inacessível. Confira BACKEND_INTERNAL_URL na Vercel, redeploy produção, e se o backend responde em /health.";
  }
  if (raw.toLowerCase().includes("confirme seu e-mail")) {
    return "Confirme seu e-mail antes de acessar o painel.";
  }
  if (raw.toLowerCase().includes("requested action is invalid")) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "sua URL";
    return `Login Google inválido em ${origin}. Use http://localhost:3000 no dev ou confira OAuth (pnpm google:oauth-setup): origens JS + redirect /__/auth/handler para localhost e zapflow-higor-2026.web.app.`;
  }
  if (raw.toLowerCase().includes("bloqueado pelo navegador")) {
    return "O login com Google foi bloqueado pelo navegador. Permita pop-ups para este site e tente novamente.";
  }
  if (raw.toLowerCase().includes("origin_mismatch")) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "seu domínio";
    return `Origem ${origin} não está no OAuth do Google. Console → Credentials → OAuth Web → Authorized JavaScript origins: adicione ${origin} (sem barra). Firebase → Auth → Authorized domains: mesmo host. Rode pnpm google:oauth-setup (WEB_ORIGIN no .env).`;
  }
  if (/not found|erro 404/i.test(raw)) {
    const api =
      typeof window !== "undefined"
        ? (process.env.NEXT_PUBLIC_API_URL?.trim() || "sua API")
        : "sua API";
    return `Rota de login não encontrada na API (${api}). Na VM, o nginx precisa repassar todo o backend FlowDesk (ex.: /auth/google), não só /health.`;
  }
  if (raw.toLowerCase().includes("redirect_uri_mismatch")) {
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
    if (!authDomain) {
      return "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN não configurado. Defina no .env e rode pnpm google:oauth-setup.";
    }
    return `Redirect URI inválida. No Google Cloud → Credentials → OAuth Client, adicione exatamente: https://${authDomain}/__/auth/handler (rode pnpm google:oauth-setup).`;
  }
  return map[code] ?? raw;
}

export async function resendVerificationEmail(
  email?: string,
  password?: string,
) {
  if (email && password) {
    await backendResendVerification(email, password);
    return;
  }
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Faça login para continuar.");
  const idToken = await user.getIdToken();
  await backendResendVerificationSession(idToken);
}

export async function refreshVerifiedSession(
  email?: string,
  password?: string,
) {
  if (email && password) {
    const res = await backendConfirmVerification(email, password);
    return establishSession(res.customToken);
  }
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Faça login para continuar.");
  await reload(user);
  if (!user.emailVerified) {
    throw new Error("Seu e-mail ainda não foi confirmado.");
  }
  const idToken = await user.getIdToken(true);
  const res = await backendConfirmVerificationSession(idToken);
  return establishSession(res.customToken);
}

export async function registerWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<EmailAuthResult> {
  const res = await backendRegister(name, email, password);
  return { status: "VERIFICATION_REQUIRED", email: res.email ?? email };
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<EmailAuthResult> {
  const res = await backendLogin(email, password);
  if (res.status === "VERIFICATION_REQUIRED") {
    return { status: "VERIFICATION_REQUIRED", email: res.email ?? email };
  }
  const session = await establishSession(res.customToken);
  return { status: "VERIFIED", token: session.token, user: session.user };
}

function isPrivateNetworkHost(host: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  const [a, b] = host.split(".").map(Number);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function assertGoogleAuthOrigin(): void {
  if (typeof window === "undefined") return;
  const host = window.location.hostname;
  if (isPrivateNetworkHost(host)) {
    const port = window.location.port || "3000";
    throw new Error(
      `Abra http://localhost:${port} (não use ${window.location.host}). O Google OAuth não aceita IP da rede (${host}).`,
    );
  }
}

async function signInWithGoogleIdentity(): Promise<EmailAuthResult> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId)
    throw new Error("Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID no .env");

  await loadGoogleIdentityScript();

  const googleOAuth2 = window.google?.accounts?.oauth2;
  if (!googleOAuth2) {
    throw new Error("Google Identity Services indisponível.");
  }

  const accessToken = await new Promise<string>((resolve, reject) => {
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      fn();
    };

    const timeoutId = window.setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            "Não foi possível abrir o login do Google. Tente novamente.",
          ),
        ),
      );
    }, 15000);

    const tokenClient = googleOAuth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: (response) => {
        finish(() => {
          if (!response.access_token) {
            reject(
              new Error(
                response.error_description ??
                  response.error ??
                  "Não foi possível obter a credencial do Google.",
              ),
            );
            return;
          }
          resolve(response.access_token);
        });
      },
    });

    tokenClient.requestAccessToken({ prompt: "select_account" });
  });

  const res = await backendGoogle(accessToken);
  const session = await establishSession(res.customToken);
  return { status: "VERIFIED", token: session.token, user: session.user };
}

export async function loginWithGoogle(): Promise<EmailAuthResult | null> {
  assertGoogleAuthOrigin();
  return signInWithGoogleIdentity();
}

export function completeGoogleRedirect(): Promise<EmailAuthResult | null> {
  return Promise.resolve(null);
}

export async function logoutFirebase() {
  await signOut(getClientAuth());
}

export function watchAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(getClientAuth(), cb);
}

export function hasPasswordProvider(user: User | null): boolean {
  return !!user?.providerData.some((p) => p.providerId === "password");
}

export function hasGoogleProvider(user: User | null): boolean {
  return !!user?.providerData.some((p) => p.providerId === "google.com");
}

async function reloadCurrentUser() {
  const user = getClientAuth().currentUser;
  if (user) await reload(user);
}

export async function updateAccountName(name: string) {
  await backendUpdateProfileName(name);
  await reloadCurrentUser();
}

export async function updateAccountEmail(
  newEmail: string,
  currentPassword: string,
) {
  await backendUpdateProfileEmail(newEmail, currentPassword);
  await reloadCurrentUser();
}

export async function updateAccountPassword(
  currentPassword: string,
  newPassword: string,
) {
  await backendUpdateProfilePassword(currentPassword, newPassword);
}
