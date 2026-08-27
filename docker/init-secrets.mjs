import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  generateSecretSet,
  parseEnvFile,
  secretsComplete,
  formatKeysEnv,
} from "./generate-secrets.mjs";

const SECRETS_PATH = process.env.SECRETS_PATH || "/secrets/keys.env";

function fromEnv() {
  return {
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || "",
    AUTH_SECRET: process.env.AUTH_SECRET || "",
  };
}

function readFileSecrets(path) {
  if (!existsSync(path)) return {};
  return parseEnvFile(readFileSync(path, "utf8"));
}

function pickSecrets() {
  const existing = readFileSecrets(SECRETS_PATH);
  if (secretsComplete(existing)) return { secrets: existing, source: "volume" };

  const env = fromEnv();
  if (secretsComplete(env)) return { secrets: env, source: "env" };

  return { secrets: generateSecretSet(), source: "generated" };
}

const { secrets, source } = pickSecrets();
mkdirSync(dirname(SECRETS_PATH), { recursive: true });
writeFileSync(SECRETS_PATH, formatKeysEnv(secrets), { mode: 0o644 });

console.log(
  `Photobuddy secrets ready (${source}). Persisted in volume photobuddy-secrets.`,
);
