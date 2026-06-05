import type { SwetrixInitOptions } from "@/types/swetrix";

export const swetrixProjectId = process.env.NEXT_PUBLIC_SWETRIX_PROJECT_ID?.trim() ?? "";
export const swetrixApiUrl =
  process.env.NEXT_PUBLIC_SWETRIX_API_URL?.trim() || "https://api-analytics.usekit.dev/log";

const swetrixDevMode = process.env.NEXT_PUBLIC_SWETRIX_DEV_MODE === "1";

export function hasSwetrix() {
  return Boolean(swetrixProjectId);
}

export function swetrixInitOptions(): SwetrixInitOptions {
  const options: SwetrixInitOptions = { apiURL: swetrixApiUrl };
  if (swetrixDevMode) options.devMode = true;
  return options;
}

export function swetrixInitOptionsJson(): string {
  return JSON.stringify(swetrixInitOptions());
}

export function swetrixNoscriptBase(): string {
  return swetrixApiUrl.replace(/\/$/, "");
}
