import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { parseEnvFile } from "./generate-secrets.mjs";
import { migrate } from "./migrate.mjs";
import { hashPassword } from "./password.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const merged = { ...process.env };
  const path = resolve(root, ".env");
  if (existsSync(path)) {
    Object.assign(merged, parseEnvFile(readFileSync(path, "utf8")));
  }
  return merged;
}

const [email, password, displayName, accentColor] = process.argv.slice(2);

if (!email || !password) {
  console.error(`
4 Teilnehmer anlegen (Passwort-Login):

  npm run create-user -- anna@familie.de geheim Anna
  npm run create-user -- sam@familie.de geheim Sam
  npm run create-user -- kim@familie.de geheim Kim
  npm run create-user -- leo@familie.de geheim Leo

Optional 4. Argument: Akzentfarbe, z.B. '#0f766e'
Postgres muss laufen (docker compose up -d).
`);
  process.exit(1);
}

const env = loadEnv();
const name = displayName || email.split("@")[0];
const databaseUrl = env.DATABASE_URL || process.env.DATABASE_URL || "";
const authSecret = env.AUTH_SECRET || process.env.AUTH_SECRET || "";
const appUrl = (
  env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3388"
).replace(/\/$/, "");

async function createViaPostgres() {
  await migrate(databaseUrl);
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const existing = await pool.query(
      "select id from public.users where lower(email) = lower($1)",
      [email],
    );
    if ((existing.rowCount ?? 0) > 0) {
      throw new Error("Diese E-Mail existiert schon.");
    }
    const hash = await hashPassword(password);
    const inserted = await pool.query(
      `insert into public.users (email, password_hash, display_name, accent_color)
       values (lower($1), $2, $3, $4)
       returning id, email, display_name`,
      [email.trim(), hash, name, accentColor || "#0f766e"],
    );
    return inserted.rows[0];
  } finally {
    await pool.end();
  }
}

async function createViaApi() {
  if (!authSecret) {
    throw new Error(
      "AUTH_SECRET fehlt. Erst `npm run setup` oder einmal `docker compose up -d`.",
    );
  }
  const res = await fetch(`${appUrl}/api/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      display_name: name,
      ...(accentColor ? { accent_color: accentColor } : {}),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || json.message || "Anlegen fehlgeschlagen.");
  }
  return { id: json.user?.id, email: json.email, display_name: json.user?.display_name };
}

let user;
try {
  if (databaseUrl) {
    user = await createViaPostgres();
  } else {
    user = await createViaApi();
  }
} catch (err) {
  if (databaseUrl) {
    try {
      user = await createViaApi();
    } catch (apiErr) {
      console.error("Anlegen fehlgeschlagen:", err instanceof Error ? err.message : err);
      if (apiErr instanceof Error && apiErr.message !== err.message) {
        console.error(apiErr.message);
      }
      process.exit(1);
    }
  } else {
    console.error("Anlegen fehlgeschlagen:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

console.log(`OK  ${user.email}  (${user.id})  → Profil ${user.display_name || name}`);
