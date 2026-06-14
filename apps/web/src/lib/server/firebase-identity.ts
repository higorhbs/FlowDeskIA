const IDENTITY = "https://identitytoolkit.googleapis.com/v1";

function identityErrorMessage(payload: unknown, fallback = "Falha na autenticação") {
  const err = payload as { error?: { message?: string; errors?: { message?: string }[] } };
  const msg = err?.error?.message ?? err?.error?.errors?.[0]?.message;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}

async function identityPost(path: string, apiKey: string, body: Record<string, unknown>) {
  const res = await fetch(`${IDENTITY}${path}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(identityErrorMessage(data));
  return data as { localId: string; email?: string };
}

export function signInWithGoogleAccessToken(
  apiKey: string,
  accessToken: string,
  requestUri: string,
) {
  const postBody = `access_token=${encodeURIComponent(accessToken)}&providerId=google.com`;
  return identityPost("/accounts:signInWithIdp", apiKey, {
    postBody,
    requestUri,
    returnSecureToken: true,
  });
}
