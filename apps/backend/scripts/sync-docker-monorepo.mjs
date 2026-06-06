#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(backendRoot, "../..");
const out = join(backendRoot, "docker/monorepo");
const packages = ["shared", "firebase", "whatsapp-client"];

function copyPackage(name) {
  const src = join(repoRoot, "packages", name);
  const dest = join(out, "packages", name);
  mkdirSync(dest, { recursive: true });
  cpSync(join(src, "package.json"), join(dest, "package.json"));
  cpSync(join(src, "tsconfig.json"), join(dest, "tsconfig.json"));
  cpSync(join(src, "src"), join(dest, "src"), { recursive: true });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "packages"), { recursive: true });

cpSync(join(repoRoot, "pnpm-lock.yaml"), join(out, "pnpm-lock.yaml"));
cpSync(join(repoRoot, "pnpm-workspace.yaml"), join(out, "pnpm-workspace.yaml"));
cpSync(join(repoRoot, "package.json"), join(out, "package.json"));

for (const name of packages) copyPackage(name);
