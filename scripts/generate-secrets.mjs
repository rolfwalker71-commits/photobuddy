import { randomBytes } from "node:crypto";

export function generateSecretSet() {
  return {
    POSTGRES_PASSWORD: randomBytes(24).toString("base64url"),
    AUTH_SECRET: randomBytes(32).toString("base64url"),
  };
}

export function parseEnvFile(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return out;
}

export function secretsComplete(row) {
  return Boolean(row.POSTGRES_PASSWORD && row.AUTH_SECRET);
}

export function formatKeysEnv(secrets) {
  return [
    `POSTGRES_PASSWORD=${secrets.POSTGRES_PASSWORD}`,
    `AUTH_SECRET=${secrets.AUTH_SECRET}`,
    "",
  ].join("\n");
}

export function databaseUrl(password, host = "127.0.0.1", port = 5433) {
  return `postgres://photobuddy:${password}@${host}:${port}/photobuddy`;
}
