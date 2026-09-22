/**
 * The single `bun:sqlite` connection for the whole server process.
 *
 * Nothing else in the app constructs a `Database`: DAOs take one, and default
 * to this one. Opening a second connection to the same file would mean a second
 * set of pragmas and a second WAL writer for no gain — the API is synchronous
 * and the process is single.
 *
 * The connection is created lazily on first `getDb()` and the schema is applied
 * exactly once at that moment, so `src/index.ts` stays untouched: importing a
 * DAO is enough to have a ready database.
 */

import { Database, constants } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { initDatabase } from "@/db/init";

/** Where the file lives. `:memory:` in tests — see `openDatabase`. */
const DATABASE_PATH = process.env.DATABASE_PATH ?? "data/tcp-trip.sqlite";

let instance: Database | null = null;

/**
 * Opens a connection and brings it to the state every connection must be in:
 * WAL (one writer, many readers), enforced foreign keys, and a busy timeout so
 * a concurrent write waits instead of throwing `SQLITE_BUSY`.
 *
 * Exported so tests can get an isolated `:memory:` database with the same
 * pragmas and the same schema, without touching the singleton.
 */
export function openDatabase(path: string = DATABASE_PATH): Database {
  // SQLite creates the file but not the folder holding it.
  if (path !== ":memory:" && path !== "") mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path, { create: true, strict: true });

  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA foreign_keys = ON;");
  db.run("PRAGMA busy_timeout = 5000;");

  initDatabase(db);
  return db;
}

/** The process-wide connection. First call opens the file and applies the schema. */
export function getDb(): Database {
  instance ??= openDatabase();
  return instance;
}

/**
 * Closes the singleton, checkpointing the WAL so no `-wal`/`-shm` sidecars are
 * left behind. Safe to call when nothing was ever opened.
 */
export function closeDb(): void {
  if (!instance) return;

  instance.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0);
  instance.run("PRAGMA wal_checkpoint(TRUNCATE);");
  instance.close(true);
  instance = null;
}
