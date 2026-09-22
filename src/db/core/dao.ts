/**
 * Base for every DAO — the layer that talks SQL.
 *
 * A DAO owns one table. It runs the statements from its domain's
 * `*.queries.ts`, binds parameters, and returns **rows** (snake_case, SQLite
 * scalars). It does not map to domain types, does not validate, and does not
 * know about HTTP or Clerk — that is the repository's half of the split.
 *
 * The connection is injected so a test can pass an isolated `:memory:` database
 * (`openDatabase(":memory:")`); production code lets it default to the
 * singleton.
 */

import type { Database } from "bun:sqlite";

import { getDb } from "@/db/client";
import type { NamedParams, Row, WriteResult } from "@/db/core/types";

export abstract class BaseDao<TRow extends Row = Row> {
  protected readonly db: Database;

  constructor(db: Database = getDb()) {
    this.db = db;
  }

  /** Every row a `SELECT` returns. */
  protected all<R = TRow>(sql: string, params?: NamedParams): R[] {
    const statement = this.db.query<R, NamedParams[]>(sql);
    return params === undefined ? statement.all() : statement.all(params);
  }

  /** The first row, or `null` when the `SELECT` matched nothing. */
  protected one<R = TRow>(sql: string, params?: NamedParams): R | null {
    const statement = this.db.query<R, NamedParams[]>(sql);
    return params === undefined ? statement.get() : statement.get(params);
  }

  /** A write (`INSERT`/`UPDATE`/`DELETE`) and what it touched. */
  protected write(sql: string, params?: NamedParams): WriteResult {
    const statement = this.db.query<unknown, NamedParams[]>(sql);
    return params === undefined ? statement.run() : statement.run(params);
  }

  /**
   * Wraps a function so its writes commit together or not at all. Nesting is
   * fine — `bun:sqlite` turns an inner transaction into a savepoint.
   */
  protected transaction<A extends unknown[], T>(fn: (...args: A) => T) {
    return this.db.transaction(fn);
  }
}
