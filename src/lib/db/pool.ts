import { Pool } from "pg";
import { ensureMigrated } from "@/lib/db/migrate";

declare global {
  var __photobuddyPool: Pool | undefined;
}

export function getPool(): Pool {
  if (globalThis.__photobuddyPool) return globalThis.__photobuddyPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL fehlt.");
  }
  const pool = new Pool({
    connectionString,
    max: 8,
  });
  globalThis.__photobuddyPool = pool;
  return pool;
}

export async function query<T extends object>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureMigrated();
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends object>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
