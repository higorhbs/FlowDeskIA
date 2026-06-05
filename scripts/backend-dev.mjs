#!/usr/bin/env node
import { spawn, execSync } from "node:child_process";
import { existsSync, readdirSync, statSync, watch } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = join(root, "apps/backend");

const workspaceDeps = [
  { name: "@flowdesk/shared", dir: "packages/shared" },
  { name: "@flowdesk/firebase", dir: "packages/firebase" },
  { name: "@flowdesk/whatsapp-client", dir: "packages/whatsapp-client" },
];

function newestSourceMtime(dir) {
  let max = 0;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      max = Math.max(max, newestSourceMtime(path));
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(ent.name)) continue;
    max = Math.max(max, statSync(path).mtimeMs);
  }
  return max;
}

function isStale(distPath, srcDir) {
  if (!existsSync(distPath)) return true;
  return statSync(distPath).mtimeMs < newestSourceMtime(srcDir);
}

function run(cmd, cwd = root) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

const staleWorkspace = workspaceDeps.filter(({ dir }) =>
  isStale(join(root, dir, "dist/index.js"), join(root, dir, "src"))
);

if (staleWorkspace.length) {
  const filters = staleWorkspace.map(({ name }) => `--filter ${name}`).join(" ");
  run(`pnpm ${filters} --parallel run build`);
}

const whatsappDist = join(backendRoot, "dist/whatsapp/wa-lifecycle.js");
if (isStale(whatsappDist, join(backendRoot, "src/whatsapp"))) {
  run("pnpm exec tsc -p tsconfig.whatsapp.json", backendRoot);
}

let server;
let restartTimer;

function startServer() {
  if (server) server.kill("SIGTERM");
  server = spawn("node", ["--watch-path=src", "--watch", "src/index.js"], {
    cwd: backendRoot,
    stdio: "inherit",
  });
  server.on("exit", (code) => {
    if (code !== null && code !== 0) process.exit(code);
  });
}

function scheduleServerRestart(reason) {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    console.log(`[backend-dev] restarting server (${reason})`);
    startServer();
  }, 400);
}

spawn("pnpm", ["exec", "tsc", "-p", "tsconfig.whatsapp.json", "--watch", "--preserveWatchOutput"], {
  cwd: backendRoot,
  stdio: "inherit",
});

const watchTargets = [
  join(root, "packages/whatsapp-client/dist"),
  join(root, "packages/firebase/dist"),
];

for (const target of watchTargets) {
  if (!existsSync(target)) continue;
  watch(target, { recursive: true }, () => scheduleServerRestart(target));
}

startServer();

process.on("SIGINT", () => {
  if (server) server.kill("SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  if (server) server.kill("SIGTERM");
  process.exit(0);
});
