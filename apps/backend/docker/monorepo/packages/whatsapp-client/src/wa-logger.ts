import pino from "pino";

function isExpectedDecryptNoise(args: unknown[]): boolean {
  const text = args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a && typeof a === "object") {
        const o = a as Record<string, unknown>;
        const err = o.err as { message?: string; name?: string } | undefined;
        const key = o.key as { remoteJid?: string } | undefined;
        const msg = String(o.msg ?? err?.message ?? "");
        const jid = String(key?.remoteJid ?? "");
        if (/failed to decrypt/i.test(msg)) {
          if (/status@broadcast/i.test(jid) || /SenderKeyRecord/i.test(msg)) return true;
        }
        if (err?.name === "SessionError" && /no session record/i.test(err.message ?? "")) {
          if (/@lid/i.test(jid)) return true;
        }
        return JSON.stringify(o);
      }
      return "";
    })
    .join(" ");
  return (
    (/failed to decrypt/i.test(text) &&
      (/status@broadcast/i.test(text) || /SenderKeyRecord/i.test(text))) ||
    (/no session record/i.test(text) && /@lid/i.test(text))
  );
}

export function createWaLogger() {
  const isProduction = process.env.NODE_ENV === "production";
  const level = process.env.WA_LOG_LEVEL?.trim() || (isProduction ? "error" : "warn");

  return pino({
    level,
    hooks: {
      logMethod(args, method, level) {
        if (level >= 50 && isExpectedDecryptNoise(args)) return;
        const joined = args.map((a) => (typeof a === "string" ? a : "")).join(" ");
        if (/baseKey|remoteIdentityKey|baseKeyType/i.test(joined)) return;
        method.apply(this, args);
      },
    },
  });
}
