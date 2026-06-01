export const swetrixProjectId = process.env.NEXT_PUBLIC_SWETRIX_PROJECT_ID?.trim() ?? "";
export const swetrixApiUrl = process.env.NEXT_PUBLIC_SWETRIX_API_URL?.trim() ?? "";

export function swetrixInitOptionsJson(): string {
  const options: Record<string, string> = {};
  if (swetrixApiUrl) options.apiURL = swetrixApiUrl;
  return JSON.stringify(options);
}

export function swetrixNoscriptBase(): string {
  return (swetrixApiUrl || "https://api.swetrix.com/log").replace(/\/$/, "");
}
