/**
 * Schema bootstrap: brings a fresh connection up to the current schema.
 *
 * Called once per connection by `openDatabase` — never call it from a route or
 * a DAO. Every statement in `SCHEMA_STATEMENTS` must be idempotent
 * (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), because this
 * runs on every boot against a file that usually already has the tables.
 *
 * The whole schema is applied in one transaction: a typo in the third statement
 * leaves the file untouched rather than half-migrated.
 */

import type { Database } from "bun:sqlite";

import { SCHEMA_STATEMENTS } from "@/db/schema";

export function initDatabase(db: Database): void {
  const applySchema = db.transaction(() => {
    for (const statement of SCHEMA_STATEMENTS) db.run(statement);
  });

  applySchema();
}
