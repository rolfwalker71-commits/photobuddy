import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatKeysEnv,
  generateSecretSet,
  parseEnvFile,
  secretsComplete,
  supabaseUrlFromSite,
} from "./generate-secrets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = resolve(root, ".env");
const src = resolve(root, ".env.example");
const generatedDir = resolve(root, "supabase/generated");
const generated = resolve(generatedDir, "keys.env");

function isEmpty(value) {
  return !value || !String(value).trim();
}

function shouldReplaceSupabaseUrl(value) {
  return (
    isEmpty(value) ||
    value.includes("xxxx.supabase.co") ||
    value.includes("placeholder.supabase.co") ||
    value.includes(".supabase.co")
  );
}

function upsertEnv(text, key, value, { overwrite = false } = {}) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) {
    const current = text.match(re)[0].slice(key.length + 1);
    if (!overwrite && !isEmpty(current)) return text;
    return text.replace(re, `${key}=${value}`);
  }
  return `${text.replace(/\s*$/, "")}\n${key}=${value}\n`;
}

function pickSecretFields(row) {
  return {
    JWT_SECRET: row.JWT_SECRET || "",
    POSTGRES_PASSWORD: row.POSTGRES_PASSWORD || "",
    ANON_KEY: row.ANON_KEY || "",
    SERVICE_ROLE_KEY: row.SERVICE_ROLE_KEY || "",
  };
}

if (!existsSync(dest)) {
  copyFileSync(src, dest);
  console.log("OK  .env angelegt aus .env.example");
} else {
  console.log("OK  .env ist schon da");
}

mkdirSync(generatedDir, { recursive: true });

let envText = readFileSync(dest, "utf8");
const env = parseEnvFile(envText);
const fromDisk = existsSync(generated)
  ? parseEnvFile(readFileSync(generated, "utf8"))
  : {};

let secrets;
if (secretsComplete(env)) {
  secrets = pickSecretFields(env);
} else if (secretsComplete(fromDisk)) {
  secrets = pickSecretFields(fromDisk);
  console.log("OK  Secrets aus supabase/generated/keys.env übernommen");
} else {
  secrets = generateSecretSet();
  console.log("OK  JWT / Anon / Service-Role / Postgres-Passwort erzeugt");
}

try {
  writeFileSync(generated, formatKeysEnv(secrets), { mode: 0o600 });
} catch (err) {
  if (err?.code !== "EACCES") throw err;
  console.log(
    "OK  supabase/generated/keys.env nicht überschreibbar — Secrets stehen in .env",
  );
}

for (const key of [
  "JWT_SECRET",
  "POSTGRES_PASSWORD",
  "ANON_KEY",
  "SERVICE_ROLE_KEY",
]) {
  envText = upsertEnv(envText, key, secrets[key]);
}
envText = upsertEnv(envText, "NEXT_PUBLIC_SUPABASE_ANON_KEY", secrets.ANON_KEY);

const siteUrl = (env.NEXT_PUBLIC_SITE_URL || "http://localhost:3388").replace(
  /\/$/,
  "",
);
envText = upsertEnv(envText, "NEXT_PUBLIC_SITE_URL", siteUrl);

if (shouldReplaceSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL)) {
  envText = upsertEnv(
    envText,
    "NEXT_PUBLIC_SUPABASE_URL",
    supabaseUrlFromSite(siteUrl),
    { overwrite: true },
  );
}

writeFileSync(dest, envText);

console.log(`
Photobuddy — selbst gehostetes Supabase in Docker (kein supabase.com):

  1. Optional in .env anpassen:
       NEXT_PUBLIC_SITE_URL        App (Port 3388)
       NEXT_PUBLIC_SUPABASE_URL    Kong/API (Port 8000)
     Handy im WLAN: beide auf die LAN-IP setzen, z.B.
       http://192.168.1.10:3388  und  http://192.168.1.10:8000
  2. Stack starten:
       docker compose up -d
     oder nur Supabase + lokal Next:
       npm run supabase:up
       npm install && npm run dev
  3. Vier Teilnehmer anlegen:
       npm run create-user -- anna@familie.de geheim Anna
       npm run create-user -- sam@familie.de geheim Sam
       npm run create-user -- kim@familie.de geheim Kim
       npm run create-user -- leo@familie.de geheim Leo
  4. App:  http://localhost:3388
     API:  http://localhost:8000

Fotos: Docker-Volume photobuddy-storage
Datenbank: photobuddy-db
Secrets/VAPID: photobuddy-secrets und photobuddy-vapid

Server: NEXT_PUBLIC_SITE_URL = öffentliche App-URL,
  NEXT_PUBLIC_SUPABASE_URL = erreichbare Kong-URL (Host:8000),
  docker compose pull && docker compose up -d
  (GHCR-Image erst nach Commit + Push auf main; nie --build auf dem Server)
`);
