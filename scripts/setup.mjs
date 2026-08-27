import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import {
  databaseUrl,
  generateSecretSet,
  parseEnvFile,
  secretsComplete,
} from "./generate-secrets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = resolve(root, ".env");
const src = resolve(root, ".env.example");

function isEmpty(value) {
  return !value || !String(value).trim();
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

if (!existsSync(dest)) {
  copyFileSync(src, dest);
  console.log("OK  .env angelegt aus .env.example");
} else {
  console.log("OK  .env ist schon da");
}

let envText = readFileSync(dest, "utf8");
envText = envText
  .replace(/^#.*[Ss]upabase.*\n/gm, "")
  .replace(/^NEXT_PUBLIC_SUPABASE_.*\n/gm, "");
const env = parseEnvFile(envText);

const generated = generateSecretSet();
const secrets = {
  POSTGRES_PASSWORD: env.POSTGRES_PASSWORD || generated.POSTGRES_PASSWORD,
  AUTH_SECRET: env.AUTH_SECRET || generated.AUTH_SECRET,
};
if (!secretsComplete(env)) {
  console.log("OK  POSTGRES_PASSWORD und AUTH_SECRET ergänzt");
}

const adminEmail = (env.ADMIN_EMAIL || "admin@photobuddy.local").trim();
const adminPassword = env.ADMIN_PASSWORD || randomBytes(12).toString("base64url");
if (isEmpty(env.ADMIN_PASSWORD)) {
  console.log("OK  ADMIN_PASSWORD ergänzt (steht in .env)");
}

envText = upsertEnv(envText, "POSTGRES_PASSWORD", secrets.POSTGRES_PASSWORD);
envText = upsertEnv(envText, "AUTH_SECRET", secrets.AUTH_SECRET);
envText = upsertEnv(envText, "ADMIN_EMAIL", adminEmail);
envText = upsertEnv(envText, "ADMIN_PASSWORD", adminPassword);
envText = upsertEnv(envText, "PORT", env.PORT || "3388");

const siteUrl = (env.NEXT_PUBLIC_SITE_URL || "http://localhost:3388").replace(
  /\/$/,
  "",
);
envText = upsertEnv(envText, "NEXT_PUBLIC_SITE_URL", siteUrl);
envText = upsertEnv(envText, "DATABASE_URL", databaseUrl(secrets.POSTGRES_PASSWORD));
envText = upsertEnv(envText, "PHOTOS_DIR", env.PHOTOS_DIR || "./data/photos");

writeFileSync(dest, envText);

console.log(`
Photobuddy — Postgres + Dateien in Docker:

  1. Optional in .env: NEXT_PUBLIC_SITE_URL  (Handy im WLAN: http://192.168.x.x:3388)
  2. Stack starten:
       docker compose up -d
     oder nur Postgres + lokal Next:
       docker compose up -d db
       npm install && npm run dev
  3. Anmelden als Admin (ADMIN_EMAIL / ADMIN_PASSWORD in .env)
     → Einstellungen → Teilnehmer
  4. App:  http://localhost:3388

Fotos: Docker-Volume photobuddy-photos
Datenbank: photobuddy-db
Secrets/VAPID: photobuddy-secrets und photobuddy-vapid

Server: NEXT_PUBLIC_SITE_URL = öffentliche App-URL,
  docker compose pull && docker compose up -d
  (GHCR-Image erst nach Commit + Push auf main; nie --build auf dem Server)
`);
