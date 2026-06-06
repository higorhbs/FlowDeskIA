export async function syncServerSession(idToken: string) {
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

export async function clearServerSession() {
  await fetch("/api/auth/session", { method: "DELETE" });
}
