/**
 * Public surface of the data layer.
 *
 * API modules import a **repository** from its domain barrel
 * (`@/db/domains/<domain>`), not from here. This barrel exists for the
 * plumbing: the connection, and the base classes a new domain extends.
 */

export { getDb, openDatabase, closeDb } from "@/db/client";
export { initDatabase } from "@/db/init";
export { SCHEMA_STATEMENTS } from "@/db/schema";
export { BaseDao } from "@/db/core/dao";
export { BaseRepository } from "@/db/core/repository";
export type { NamedParams, ParamValue, Row, WriteResult } from "@/db/core/types";
