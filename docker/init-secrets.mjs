import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  generateSecretSet,
  parseEnvFile,
  secretsComplete,
  formatKeysEnv,
} from "./generate-secrets.mjs";

const SECRETS_PATH = process.env.SECRETS_PATH || "/secrets/keys.env";
const GENERATED_PATH = process.env.GENERATED_PATH || "/generated/keys.env";
const KONG_TMPL = process.env.KONG_TEMPLATE || "/kong.yml.tmpl";
const KONG_OUT = process.env.KONG_OUT || "/secrets/kong.yml";

function fromEnv() {
  return {
    JWT_SECRET: process.env.JWT_SECRET || "",
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || "",
    ANON_KEY: process.env.ANON_KEY || "",
    SERVICE_ROLE_KEY: process.env.SERVICE_ROLE_KEY || "",
  };
}

function readFileSecrets(path) {
  if (!existsSync(path)) return {};
  return parseEnvFile(readFileSync(path, "utf8"));
}

function pickSecrets() {
  const existing = readFileSecrets(SECRETS_PATH);
  if (secretsComplete(existing)) return { secrets: existing, source: "volume" };

  const generated = readFileSecrets(GENERATED_PATH);
  if (secretsComplete(generated)) return { secrets: generated, source: "generated-file" };

  const env = fromEnv();
  if (secretsComplete(env)) return { secrets: env, source: "env" };

  return { secrets: generateSecretSet(), source: "generated" };
}

function writeEnv(path, secrets) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, formatKeysEnv(secrets), { mode: 0o644 });
}

function renderKong(secrets) {
  if (!existsSync(KONG_TMPL)) {
    throw new Error(`Kong template missing: ${KONG_TMPL}`);
  }
  const tmpl = readFileSync(KONG_TMPL, "utf8");
  return tmpl
    .replaceAll("__ANON_KEY__", secrets.ANON_KEY)
    .replaceAll("__SERVICE_ROLE_KEY__", secrets.SERVICE_ROLE_KEY);
}

const { secrets, source } = pickSecrets();
writeEnv(SECRETS_PATH, secrets);
try {
  writeEnv(GENERATED_PATH, secrets);
} catch {
  // bind mount optional
}
writeFileSync(KONG_OUT, renderKong(secrets));
if (source === "volume") {
  try {
    copyFileSync(SECRETS_PATH, GENERATED_PATH);
  } catch {
    /* ignore */
  }
}

console.log(`Photobuddy secrets ready (${source}). Persisted in volume photobuddy-secrets.`);
