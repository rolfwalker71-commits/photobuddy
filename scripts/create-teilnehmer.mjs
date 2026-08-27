import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnvFile } from "./generate-secrets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const merged = {};
  for (const rel of [".env", "supabase/generated/keys.env"]) {
    const path = resolve(root, rel);
    if (!existsSync(path)) continue;
    Object.assign(merged, parseEnvFile(readFileSync(path, "utf8")));
  }
  return merged;
}

const [email, password, displayName, accentColor] = process.argv.slice(2);

if (!email || !password) {
  console.error(`
4 Teilnehmer anlegen (Passwort-Login, ohne supabase.com):

  npm run create-user -- anna@familie.de geheim Anna
  npm run create-user -- sam@familie.de geheim Sam
  npm run create-user -- kim@familie.de geheim Kim
  npm run create-user -- leo@familie.de geheim Leo

Optional 4. Argument: Akzentfarbe, z.B. '#0f766e'
Kong muss laufen (docker compose up -d).
`);
  process.exit(1);
}

const env = loadEnv();
const base = (
  env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");
const serviceKey = env.SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || "";

if (!serviceKey) {
  console.error(
    "SERVICE_ROLE_KEY fehlt. Erst `npm run setup` oder einmal `docker compose up -d` (legt supabase/generated/keys.env an).",
  );
  process.exit(1);
}

const body = {
  email,
  password,
  email_confirm: true,
  user_metadata: {
    display_name: displayName || email.split("@")[0],
    ...(accentColor ? { accent_color: accentColor } : {}),
  },
};

const res = await fetch(`${base}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("Anlegen fehlgeschlagen:", json.error_description || json.msg || json.message || json);
  process.exit(1);
}

console.log(
  `OK  ${json.email}  (${json.id})  → Profil ${body.user_metadata.display_name}`,
);
