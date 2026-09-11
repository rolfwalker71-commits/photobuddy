import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import yazl from "yazl";
import { query } from "@/lib/db/pool";
import { buildRestoreSql, dollarTag, quoteIdent, type TableDump } from "@/lib/backup-sql";
import { photosDir } from "@/lib/files";
import { getVapidKeys } from "@/lib/push";

const README = `Photobuddy-Backup
=================

database.sql   Alle Daten (ersetzt beim Einspielen den aktuellen Inhalt)
photos/        Fotos, Videos, Sprachnotizen (fehlt bei "nur Datenbank")
vapid/         Push-Schlüssel, damit bestehende Push-Abos weiter funktionieren
manifest.json  Zeitpunkt, Migrationsstand, Anzahl Zeilen/Dateien

Wiederherstellen (im Photobuddy-Ordner neben docker-compose.yml):

  scripts/restore-backup.sh photobuddy-backup-….zip

Das Backup lässt sich in dieselbe oder eine neuere Photobuddy-Version
einspielen, nicht in eine ältere.
`;

async function dumpTables(): Promise<TableDump[]> {
  const tables = await query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
       and table_name <> 'schema_migrations'
     order by table_name`,
  );
  const dumps: TableDump[] = [];
  for (const { table_name: name } of tables) {
    const target = `public.${quoteIdent(name)}`;
    const [columns, data] = await Promise.all([
      query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1
           and is_generated = 'NEVER'
         order by ordinal_position`,
        [name],
      ),
      // Postgres serialises every type canonically; json_populate_recordset
      // reads it back without JS date/number round-trips.
      query<{ json: string; rows: number }>(
        `select coalesce(json_agg(t), '[]'::json)::text as json,
                count(*)::int as rows
         from ${target} t`,
      ),
    ]);
    dumps.push({
      name,
      columns: columns.map((col) => col.column_name),
      json: data[0]?.json ?? "[]",
      rows: data[0]?.rows ?? 0,
    });
  }
  return dumps;
}

async function listFiles(root: string, dir = root): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, absolute)));
    else if (entry.isFile()) files.push(relative(root, absolute));
  }
  return files;
}

export function backupFilename(now = new Date(), withPhotos = true) {
  const stamp = now.toISOString().slice(0, 16).replace("T", "_").replace(":", "");
  return `photobuddy-backup-${stamp}${withPhotos ? "" : "-nur-db"}.zip`;
}

/** Streams a ZIP with a restorable SQL dump, all media files and push keys. */
export async function createBackupStream(opts: { withPhotos: boolean }) {
  const createdAt = new Date().toISOString();
  const tables = await dumpTables();
  const migrations = await query<{ id: string }>(
    `select id from public.schema_migrations order by id`,
  );
  const tag = dollarTag(
    tables.map((table) => table.json),
    () => randomBytes(6).toString("hex"),
  );
  const sql = buildRestoreSql(tables, { createdAt, tag });

  const root = photosDir();
  const files = opts.withPhotos ? await listFiles(root) : [];

  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from(sql, "utf8"), "database.sql");
  zip.addBuffer(Buffer.from(README, "utf8"), "LIESMICH.txt");
  zip.addBuffer(
    Buffer.from(
      JSON.stringify(
        {
          app: "photobuddy",
          format: 1,
          created_at: createdAt,
          migrations: migrations.map((row) => row.id),
          tables: Object.fromEntries(tables.map((table) => [table.name, table.rows])),
          files: files.length,
          with_photos: opts.withPhotos,
        },
        null,
        2,
      ),
      "utf8",
    ),
    "manifest.json",
  );
  try {
    const { publicKey, privateKey } = getVapidKeys();
    zip.addBuffer(
      Buffer.from(JSON.stringify({ publicKey, privateKey }, null, 2), "utf8"),
      "vapid/keys.json",
    );
  } catch {
    /* push not configured */
  }
  for (const file of files) {
    zip.addReadStream(
      createReadStream(join(root, file)),
      `photos/${file.split("\\").join("/")}`,
      { compress: false },
    );
  }
  zip.end();
  return Readable.toWeb(zip.outputStream as unknown as Readable) as ReadableStream;
}
