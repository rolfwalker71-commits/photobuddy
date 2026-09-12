import { describe, expect, it } from "vitest";
import { buildRestoreSql, dollarTag, quoteIdent } from "@/lib/backup-sql";

describe("quoteIdent", () => {
  it("quotes plain snake_case names", () => {
    expect(quoteIdent("album_members")).toBe('"album_members"');
  });

  it.each(['users"; drop table users; --', "Users", "a-b", ""])(
    "refuses %j",
    (name) => {
      expect(() => quoteIdent(name)).toThrow();
    },
  );
});

describe("dollarTag", () => {
  it("picks a tag that does not occur in the data", () => {
    const values = ["aaa", "bbb"];
    let n = 0;
    const tag = dollarTag(['[{"note":"$pbaaa$"}]'], () => values[n++]);
    expect(tag).toBe("$pbbbb$");
  });
});

describe("buildRestoreSql", () => {
  const sql = buildRestoreSql(
    [
      {
        name: "users",
        columns: ["id", "email"],
        json: '[{"id":"u1","email":"anna@familie.de"}]',
        rows: 1,
      },
      { name: "comments", columns: ["id", "body"], json: "[]", rows: 0 },
    ],
    { createdAt: "2026-09-11T03:30:00Z", tag: "$pbx$" },
  );

  it("replaces all tables in one transaction", () => {
    expect(sql).toContain("begin;");
    expect(sql).toContain("set local session_replication_role = replica;");
    expect(sql).toContain(
      'truncate table public."users", public."comments" restart identity cascade;',
    );
    expect(sql.trim().endsWith("commit;")).toBe(true);
  });

  it("inserts with explicit columns so newer schemas keep their defaults", () => {
    expect(sql).toContain(
      'insert into public."users" ("id", "email")\n  select "id", "email" from json_populate_recordset(null::public."users", $pbx$[{"id":"u1","email":"anna@familie.de"}]$pbx$::json);',
    );
  });

  it("skips inserts for empty tables", () => {
    expect(sql).not.toContain('insert into public."comments"');
  });
});
