#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(backendRoot, "../..");
const out = join(backendRoot, "docker/monorepo");
const packages = ["shared", "firebase", "whatsapp-client"];

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "packages"), { recursive: true });

cpSync(join(repoRoot, "pnpm-lock.yaml"), join(out, "pnpm-lock.yaml"));
cpSync(join(repoRoot, "pnpm-workspace.yaml"), join(out, "pnpm-workspace.yaml"));
cpSync(join(backendRoot, "docker/root.package.json"), join(out, "package.json"));

for (const name of packages) {
  cpSync(join(repoRoot, "packages", name), join(out, "packages", name), {
    recursive: true,
  });
}
