import { Redis } from "ioredis";

let lastProbe = 0;
let lastOk: boolean | null = null;
const PROBE_TTL_MS = 4_000;

export async function probeRedis(): Promise<boolean> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return false;

  const now = Date.now();
  if (lastOk !== null && now - lastProbe < PROBE_TTL_MS) return lastOk;

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  client.on("error", () => {});

  try {
    await client.connect();
    const pong = await client.ping();
    lastOk = pong === "PONG";
  } catch {
    lastOk = false;
  } finally {
    client.disconnect();
    lastProbe = Date.now();
  }
  return lastOk;
}

export function invalidateRedisProbe() {
  lastOk = null;
  lastProbe = 0;
}
