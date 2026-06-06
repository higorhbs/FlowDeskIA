#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(backendRoot, "src/whatsapp");
const distRoot = join(backendRoot, "dist/whatsapp");

function copyJsFiles(srcDir, destDir) {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });
  for (const ent of readdirSync(srcDir, { withFileTypes: true })) {
    const src = join(srcDir, ent.name);
    const dest = join(destDir, ent.name);
    if (ent.isDirectory()) {
      copyJsFiles(src, dest);
      continue;
    }
    if (!ent.name.endsWith(".js")) continue;
    if (ent.name === "status-media.js") continue;
    cpSync(src, dest);
  }
}

copyJsFiles(srcRoot, distRoot);
