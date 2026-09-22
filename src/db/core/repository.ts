/**
 * Base for every repository — the layer the API talks to.
 *
 * A repository speaks the domain's language: it takes and returns entities
 * (camelCase, `string` ids, ISO timestamps, parsed JSON), composes one or more
 * DAOs, and owns any operation spanning several tables that must be atomic.
 * Routes import repositories; routes never import a DAO or a query string.
 *
 * The split earns its keep in this project: the same `protocols` DAO backs the
 * builder's save, the composer's read and the admin panel's listing, each with
 * different ownership rules — those rules live here, the SQL lives once.
 */

import type { Database } from "bun:sqlite";

import { getDb } from "@/db/client";
import type { Row } from "@/db/core/types";

export abstract class BaseRepository<TRow extends Row, TEntity> {
  protected readonly db: Database;

  /** Pass the same connection the DAOs got, so a transaction covers them all. */
  constructor(db: Database = getDb()) {
    this.db = db;
  }

  /** Row → entity. The one place column names stop leaking upward. */
  protected abstract toEntity(row: TRow): TEntity;

  protected toEntities(rows: readonly TRow[]): TEntity[] {
    return rows.map(row => this.toEntity(row));
  }

  /** Same mapping for the `get`-shaped calls that may find nothing. */
  protected toEntityOrNull(row: TRow | null): TEntity | null {
    return row === null ? null : this.toEntity(row);
  }

  /**
   * Runs several DAO writes as one unit: all commit, or an exception rolls the
   * whole thing back. Nesting is fine — `bun:sqlite` uses a savepoint.
   */
  protected transaction<A extends unknown[], T>(fn: (...args: A) => T) {
    return this.db.transaction(fn);
  }
}
