/** Builds the restore script for a backup (pure; see src/lib/backup.ts). */

export type TableDump = {
  name: string;
  columns: string[];
  /** JSON array of rows as produced by Postgres' json_agg. */
  json: string;
  rows: number;
};

const IDENT = /^[a-z_][a-z0-9_]*$/;

export function quoteIdent(name: string) {
  if (!IDENT.test(name)) throw new Error(`Ungültiger Tabellen- oder Spaltenname: ${name}`);
  return `"${name}"`;
}

/** A $tag$ that does not occur in any payload, so the JSON needs no escaping. */
export function dollarTag(payloads: string[], random: () => string) {
  for (let i = 0; i < 20; i += 1) {
    const tag = `$pb${random()}$`;
    if (!payloads.some((payload) => payload.includes(tag))) return tag;
  }
  throw new Error("Kein freies Dollar-Quote-Tag gefunden.");
}

/**
 * Replaces all data in the listed tables. Rows are inserted with explicit
 * column lists, so a backup restores into a newer schema too — columns added
 * later fall back to their defaults. Needs a superuser (the Compose default)
 * because foreign-key triggers are paused while tables fill in any order.
 */
export function buildRestoreSql(
  tables: TableDump[],
  opts: { createdAt: string; tag: string },
) {
  const lines = [
    `-- Photobuddy-Backup vom ${opts.createdAt}`,
    "-- Einspielen: psql -v ON_ERROR_STOP=1 -U photobuddy -d photobuddy < database.sql",
    "begin;",
    "set local session_replication_role = replica;",
  ];
  if (tables.length > 0) {
    lines.push(
      `truncate table ${tables
        .map((table) => `public.${quoteIdent(table.name)}`)
        .join(", ")} restart identity cascade;`,
    );
  }
  for (const table of tables) {
    if (table.rows === 0 || table.columns.length === 0) continue;
    const target = `public.${quoteIdent(table.name)}`;
    const cols = table.columns.map(quoteIdent).join(", ");
    lines.push(
      `insert into ${target} (${cols})\n  select ${cols} from json_populate_recordset(null::${target}, ${opts.tag}${table.json}${opts.tag}::json);`,
    );
  }
  lines.push("commit;", "");
  return lines.join("\n");
}
