import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

function findMigrationsDir() {
  const candidates = [join(process.cwd(), "db/migrations")];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(here, "../../../db/migrations"));
  } catch {
    // bundled / CJS
  }
  return candidates.find((dir) => existsSync(dir));
}

let applied = false;
let inflight: Promise<void> | null = null;

export async function ensureMigrated() {
  if (applied) return;
  if (!inflight) {
    inflight = migrate()
      .then(() => {
        applied = true;
      })
      .finally(() => {
        inflight = null;
      });
  }
  await inflight;
}

export async function migrate() {
  const dir = findMigrationsDir();
  if (!dir) {
    throw new Error("db/migrations nicht gefunden.");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL fehlt.");
  }

  const pool = new Pool({ connectionString, max: 1 });
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
      const appliedRow = await pool.query(
        "select 1 from public.schema_migrations where id = $1",
        [file],
      );
      if ((appliedRow.rowCount ?? 0) > 0) continue;
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
    applied = true;
  } finally {
    await pool.end();
  }
}
