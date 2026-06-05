export function isStaticHostingBuild(): boolean {
  return process.env.NEXT_PUBLIC_FIREBASE_STATIC === "1";
}

export function isStaticHostingClient(): boolean {
  if (typeof window === "undefined") return isStaticHostingBuild();
  if (isStaticHostingBuild()) return true;
  const host = window.location.hostname;
  return (
    host.endsWith(".web.app") ||
    host.endsWith(".firebaseapp.com") ||
    host === "flowdesk.ia.br" ||
    host === "www.flowdesk.ia.br"
  );
}
