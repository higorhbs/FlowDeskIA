#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(backendRoot, "src/whatsapp");
const distRoot = join(backendRoot, "dist/whatsapp");
const libSrcRoot = join(backendRoot, "src/lib");
const libDistRoot = join(backendRoot, "dist/lib");

function copyLibDeps() {
  const logSrc = join(backendRoot, "src/lib/log.js");
  const logDestDir = join(backendRoot, "dist/lib");
  if (!existsSync(logSrc)) return;
  mkdirSync(logDestDir, { recursive: true });
  cpSync(logSrc, join(logDestDir, "log.js"));
}

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

copyLibDeps();
copyJsFiles(srcRoot, distRoot);
copyJsFiles(libSrcRoot, libDistRoot);
