import { existsSync, readFileSync, readdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { ensureAdminUser } from "@/lib/db/bootstrap";
import { resolvePhotoPath } from "@/lib/files";

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
    await ensureAdminUser(pool);
    await purgeExpiredTrash(pool);
    applied = true;
  } finally {
    await pool.end();
  }
}

async function purgeExpiredTrash(pool: Pool) {
  try {
    const expired = await pool.query<{
      storage_path: string;
      thumbnail_path: string | null;
    }>(
      `select storage_path, thumbnail_path from public.photos
       where deleted_at is not null
         and deleted_at <= now() - interval '30 days'`,
    );
    for (const row of expired.rows) {
      for (const rel of [row.storage_path, row.thumbnail_path]) {
        if (!rel) continue;
        try {
          await unlink(resolvePhotoPath(rel));
        } catch {
          // already gone
        }
      }
    }
    if (expired.rows.length > 0) {
      await pool.query(
        `delete from public.photos
         where deleted_at is not null
           and deleted_at <= now() - interval '30 days'`,
      );
      console.log(`migrate: Papierkorb ${expired.rows.length} Einträge entfernt.`);
    }
  } catch {
    // column may be missing mid-migrate; ignore
  }
}
