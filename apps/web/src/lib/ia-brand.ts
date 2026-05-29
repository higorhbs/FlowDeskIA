import { Sparkles, type LucideIcon } from "lucide-react";

export const IA_DISPLAY_NAME = "IA";
export const IaIcon: LucideIcon = Sparkles;

export function isIaMessageRole(role: string): boolean {
  return role === "IA" || role === "BOT";
}
