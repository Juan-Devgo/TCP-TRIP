import { describe, expect, test } from "bun:test";

import { openDatabase } from "@/db/client";
import { BaseDao } from "@/db/core/dao";

/** Stands in for a real domain DAO until tables exist. */
class ScratchDao extends BaseDao {
  seed(): void {
    this.db.run("CREATE TABLE scratch (id TEXT PRIMARY KEY, label TEXT NOT NULL)");
  }

  insert(id: string, label: string) {
    return this.write("INSERT INTO scratch (id, label) VALUES ($id, $label)", { id, label });
  }

  find(id: string) {
    return this.one<{ id: string; label: string }>(
      "SELECT id, label FROM scratch WHERE id = $id",
      { id },
    );
  }

  list() {
    return this.all<{ id: string; label: string }>("SELECT id, label FROM scratch ORDER BY id");
  }

  insertMany(rows: readonly { id: string; label: string }[]): void {
    this.transaction(() => {
      for (const row of rows) this.insert(row.id, row.label);
    })();
  }
}

function scratch(): ScratchDao {
  const dao = new ScratchDao(openDatabase(":memory:"));
  dao.seed();
  return dao;
}

describe("openDatabase", () => {
  test("applies the pragmas every connection depends on", () => {
    const db = openDatabase(":memory:");
    expect(db.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get()).toEqual({
      foreign_keys: 1,
    });
  });

  test("runs the schema without throwing while it is still empty", () => {
    expect(() => openDatabase(":memory:")).not.toThrow();
  });
});

describe("BaseDao", () => {
  test("binds named params without a prefix (strict mode)", () => {
    const dao = scratch();
    dao.insert("a", "Ethernet");
    expect(dao.find("a")).toEqual({ id: "a", label: "Ethernet" });
  });

  test("one() returns null when nothing matches", () => {
    expect(scratch().find("missing")).toBeNull();
  });

  test("write() reports what it changed", () => {
    expect(scratch().insert("a", "IPv4").changes).toBe(1);
  });

  test("all() runs a statement that takes no params", () => {
    const dao = scratch();
    dao.insert("a", "IPv4");
    dao.insert("b", "TCP");
    expect(dao.list()).toHaveLength(2);
  });

  test("transaction() rolls every write back on a throw", () => {
    const dao = scratch();
    expect(() =>
      dao.insertMany([
        { id: "a", label: "IPv4" },
        { id: "a", label: "duplicate" },
      ]),
    ).toThrow();
    expect(dao.list()).toEqual([]);
  });
});
