/**
 * The `protocols` table as SQLite returns it, and as the rest of the server
 * reads it.
 */

import type { ProtocolDocumentShape } from "@/lib/protocols/contract";

/** One row, exactly as the columns are named. */
export type ProtocolRow = {
  id: string;
  user_id: string;
  name: string;
  schema_version: number;
  document: string;
  share_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * The entity. `user_id` deliberately does not survive the mapping: the caller
 * had to prove who it was to get here, so handing the id back would only
 * invite someone to trust the copy instead of the session.
 */
export type SavedProtocol = {
  id: string;
  name: string;
  document: ProtocolDocumentShape;
  /** `null` until the protocol has been shared. */
  shareId: string | null;
  /** ISO-8601 UTC. */
  createdAt: string;
  updatedAt: string;
};
