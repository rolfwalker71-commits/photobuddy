import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { parseEnvFile } from "./generate-secrets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const dest = resolve(root, ".env");
  if (!existsSync(dest)) return {};
  return parseEnvFile(readFileSync(dest, "utf8"));
}

export async function migrate(connectionString) {
  const dir = join(root, "db/migrations");
  if (!existsSync(dir)) throw new Error("db/migrations nicht gefunden.");

  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    await pool.query(`
      create table if not exists public.schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    const files = readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const applied = await pool.query(
        "select 1 from public.schema_migrations where id = $1",
        [file],
      );
      if ((applied.rowCount ?? 0) > 0) continue;
      const sql = readFileSync(join(dir, file), "utf8");
      await pool.query("begin");
      try {
        await pool.query(sql);
        await pool.query(
          "insert into public.schema_migrations (id) values ($1)",
          [file],
        );
        await pool.query("commit");
        console.log(`migrate: applied ${file}`);
      } catch (err) {
        await pool.query("rollback");
        throw err;
      }
    }
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const env = loadEnv();
  const url = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL fehlt. Erst `npm run setup` und `docker compose up -d`.");
    process.exit(1);
  }
  await migrate(url);
}
