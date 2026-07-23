export async function syncServerSession(idToken: string) {
  if (typeof window !== "undefined") {
    const prev = (window as Window & { __flowdeskSyncedToken?: string }).__flowdeskSyncedToken;
    if (prev === idToken) return;
    (window as Window & { __flowdeskSyncedToken?: string }).__flowdeskSyncedToken = idToken;
  }
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

export async function clearServerSession() {
  if (typeof window !== "undefined") {
    delete (window as Window & { __flowdeskSyncedToken?: string }).__flowdeskSyncedToken;
  }
  await fetch("/api/auth/session", { method: "DELETE" });
}
