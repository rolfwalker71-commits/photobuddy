import { randomBytes, createHmac } from "node:crypto";

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

export function signHs256Jwt(secret, payload) {
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const body = b64urlJson(payload);
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/** Same host as the Next app, Kong on port 8000. */
export function supabaseUrlFromSite(siteUrl, kongPort = "8000") {
  try {
    const url = new URL(siteUrl);
    url.port = String(kongPort);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return `http://localhost:${kongPort}`;
  }
}

export function generateSecretSet() {
  const JWT_SECRET = randomBytes(32).toString("base64url");
  const POSTGRES_PASSWORD = randomBytes(24).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24 * 365 * 10;
  const claims = (role) => ({
    role,
    iss: "supabase-photobuddy",
    iat: now,
    exp,
  });
  return {
    JWT_SECRET,
    POSTGRES_PASSWORD,
    ANON_KEY: signHs256Jwt(JWT_SECRET, claims("anon")),
    SERVICE_ROLE_KEY: signHs256Jwt(JWT_SECRET, claims("service_role")),
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
  return Boolean(
    row.JWT_SECRET &&
      row.ANON_KEY &&
      row.SERVICE_ROLE_KEY &&
      row.POSTGRES_PASSWORD,
  );
}

export function formatKeysEnv(secrets) {
  return [
    `JWT_SECRET=${secrets.JWT_SECRET}`,
    `POSTGRES_PASSWORD=${secrets.POSTGRES_PASSWORD}`,
    `ANON_KEY=${secrets.ANON_KEY}`,
    `SERVICE_ROLE_KEY=${secrets.SERVICE_ROLE_KEY}`,
    "",
  ].join("\n");
}
