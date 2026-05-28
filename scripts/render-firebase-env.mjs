import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const path =
  process.argv[2] ??
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  ".secrets/firebase-adminsdk.json";

const full = resolve(path);
if (!existsSync(full)) {
  console.error(`Arquivo não encontrado: ${full}`);
  process.exit(1);
}

const json = JSON.stringify(JSON.parse(readFileSync(full, "utf8")));
console.log("Cole no Render (Environment):");
console.log("");
console.log("FIREBASE_SERVICE_ACCOUNT_JSON=");
console.log(json);
console.log("");
console.log("Opcional (se preferir variáveis separadas):");
const sa = JSON.parse(json);
console.log(`FIREBASE_PROJECT_ID=${sa.project_id}`);
console.log(`FIREBASE_CLIENT_EMAIL=${sa.client_email}`);
console.log(`FIREBASE_PRIVATE_KEY="${sa.private_key.replace(/\n/g, "\\n")}"`);
