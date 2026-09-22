/**
 * SQL for the `protocols` table. Binds parameters, returns rows, decides
 * nothing — the rules are the repository's.
 */

import { BaseDao } from "@/db/core/dao";
import type { WriteResult } from "@/db/core/types";
import {
  DELETE_PROTOCOL,
  INSERT_PROTOCOL,
  SELECT_PROTOCOL,
  SELECT_PROTOCOL_BY_SHARE_ID,
  SELECT_PROTOCOLS_BY_USER,
  SET_SHARE_ID,
  UPDATE_PROTOCOL,
} from "@/db/domains/protocols/protocols.queries";
import type { ProtocolRow } from "@/db/domains/protocols/protocols.types";

/** What a write needs, minus the timestamps the repository decides. */
export type ProtocolWrite = {
  id: string;
  userId: string;
  name: string;
  schemaVersion: number;
  /** The document, already serialized. */
  document: string;
};

export class ProtocolsDao extends BaseDao<ProtocolRow> {
  insert(values: ProtocolWrite & { createdAt: string; updatedAt: string }): WriteResult {
    return this.write(INSERT_PROTOCOL, { ...values });
  }

  update(values: ProtocolWrite & { updatedAt: string }): WriteResult {
    return this.write(UPDATE_PROTOCOL, { ...values });
  }

  findById(userId: string, id: string): ProtocolRow | null {
    return this.one(SELECT_PROTOCOL, { userId, id });
  }

  listByUser(userId: string): ProtocolRow[] {
    return this.all(SELECT_PROTOCOLS_BY_USER, { userId });
  }

  deleteById(userId: string, id: string): WriteResult {
    return this.write(DELETE_PROTOCOL, { userId, id });
  }

  setShareId(
    userId: string,
    id: string,
    shareId: string,
    updatedAt: string,
  ): WriteResult {
    return this.write(SET_SHARE_ID, { userId, id, shareId, updatedAt });
  }

  findByShareId(shareId: string): ProtocolRow | null {
    return this.one(SELECT_PROTOCOL_BY_SHARE_ID, { shareId });
  }
}
