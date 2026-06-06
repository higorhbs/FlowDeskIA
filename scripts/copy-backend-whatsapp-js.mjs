#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = join(
  dirname(fileURLToPath(import.meta.url)),
  "../apps/backend/scripts/copy-whatsapp-js.mjs",
);
const r = spawnSync(process.execPath, [script], { stdio: "inherit" });
process.exit(r.status ?? 1);
