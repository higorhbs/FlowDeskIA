#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "apps/web");
const appDir = join(web, "src/app");
const publicDir = join(web, "public");
const iconSvg = join(appDir, "icon.svg");
const appleSvg = join(appDir, "apple-icon.svg");
const require = createRequire(join(web, "package.json"));

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.error("Instale sharp: pnpm add -D sharp --filter @flowdesk/web");
    process.exit(1);
  }

  mkdirSync(publicDir, { recursive: true });
  const small = readFileSync(iconSvg);
  const apple = readFileSync(appleSvg);

  const sizes = [
    [16, "favicon-16x16.png"],
    [32, "favicon-32x32.png"],
    [48, "icon-48x48.png"],
    [192, "icon-192.png"],
    [512, "icon-512.png"],
  ];

  for (const [size, name] of sizes) {
    await sharp(small).resize(size, size).png().toFile(join(publicDir, name));
  }

  const applePng = await sharp(apple).resize(180, 180).png().toBuffer();
  writeFileSync(join(publicDir, "apple-touch-icon.png"), applePng);
  writeFileSync(join(appDir, "apple-icon.png"), applePng);

  writeFileSync(join(publicDir, "icon.svg"), small);
  writeFileSync(join(publicDir, "apple-icon.svg"), apple);

  const pngToIco = require("png-to-ico");
  const ico = await pngToIco([
    join(publicDir, "favicon-16x16.png"),
    join(publicDir, "favicon-32x32.png"),
  ]);
  writeFileSync(join(publicDir, "favicon.ico"), ico);
  writeFileSync(join(appDir, "favicon.ico"), ico);

  console.log("Ícones gerados em apps/web/public/ e apps/web/src/app/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
