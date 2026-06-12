const LEVELS: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3 };

function threshold(): number {
  const isProduction = process.env.NODE_ENV === "production";
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();
  const level = raw && raw in LEVELS ? raw : isProduction ? "warn" : "info";
  return LEVELS[level] ?? LEVELS.info;
}

function emit(level: keyof typeof LEVELS, args: unknown[]) {
  if ((LEVELS[level] ?? 99) > threshold()) return;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(...args);
}

export const waLog = {
  error: (...args: unknown[]) => emit("error", args),
  warn: (...args: unknown[]) => emit("warn", args),
  info: (...args: unknown[]) => emit("info", args),
  debug: (...args: unknown[]) => emit("debug", args),
};
