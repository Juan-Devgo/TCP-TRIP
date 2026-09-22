/** Shared vocabulary of the data layer. No SQL, no domain types. */

/** Anything SQLite can store, as this project binds it. */
export type ParamValue = string | number | bigint | boolean | null | Uint8Array;

/**
 * Bindings for a query. The connection is opened with `strict: true`, so keys
 * carry **no** `$`/`:`/`@` prefix and a missing one throws instead of binding
 * NULL: `{ id }` for `WHERE id = $id`.
 */
export type NamedParams = Record<string, ParamValue>;

/**
 * A row exactly as SQLite returns it — snake_case columns, no `Date`, no
 * booleans, no nested objects. Domain entities are the repository's job.
 */
export type Row = Record<string, ParamValue>;

/** What a write reports back. Mirrors `bun:sqlite`'s `Changes`. */
export type WriteResult = {
  changes: number;
  lastInsertRowid: number | bigint;
};
