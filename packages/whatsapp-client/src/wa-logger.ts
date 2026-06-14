import pino from "pino";

const SESSION_NOISE =
  /Bad MAC|Session error|Closing session|Decrypted message with closed session|Closing open session|SessionEntry|_chains|currentRatchet|pendingPreKey|baseKey|remoteIdentityKey|baseKeyType/i;

function serializeArg(a: unknown): string {
  if (typeof a === "string") return a;
  if (a && typeof a === "object") {
    const o = a as Record<string, unknown>;
    if ("_chains" in o || "currentRatchet" in o || "pendingPreKey" in o) return "SessionEntry";
    try {
      return JSON.stringify(o);
    } catch {
      return "";
    }
  }
  return "";
}

function isExpectedDecryptNoise(args: unknown[]): boolean {
  const text = args.map(serializeArg).join(" ");
  return (
    (/failed to decrypt/i.test(text) &&
      (/status@broadcast/i.test(text) || /SenderKeyRecord/i.test(text))) ||
    (/no session record/i.test(text) && /@lid/i.test(text)) ||
    SESSION_NOISE.test(text)
  );
}

export function createWaLogger() {
  const isProduction = process.env.NODE_ENV === "production";
  const level = process.env.WA_LOG_LEVEL?.trim() || (isProduction ? "error" : "warn");

  return pino({
    level,
    hooks: {
      logMethod(args, method, level) {
        if (isExpectedDecryptNoise(args)) return;
        method.apply(this, args);
      },
    },
  });
}
