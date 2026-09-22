/**
 * The protocols domain as the API talks to it: entities in, entities out, and
 * every call scoped to the Clerk user id the route verified server-side.
 *
 * Nothing here takes an owner from a payload. `userId` is a parameter of every
 * method because the only place it may come from is the session.
 */

import type { Database } from "bun:sqlite";

import { getDb } from "@/db/client";
import { BaseRepository } from "@/db/core/repository";
import { ProtocolsDao } from "@/db/domains/protocols/protocols.dao";
import type {
  ProtocolRow,
  SavedProtocol,
} from "@/db/domains/protocols/protocols.types";
import {
  SHARE_ID_LENGTH,
  type ProtocolDocumentShape,
} from "@/lib/protocols/contract";

/** Share ids are random; a collision is retried, never handed to the user. */
const SHARE_ATTEMPTS = 5;

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return (
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    String((error as { message?: unknown }).message ?? "").includes(
      "UNIQUE constraint failed",
    )
  );
}

function mintShareId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, SHARE_ID_LENGTH);
}

export class ProtocolsRepository extends BaseRepository<ProtocolRow, SavedProtocol> {
  private readonly dao: ProtocolsDao;

  /**
   * The DAO gets the repository's own connection, which is what lets a
   * transaction here cover the writes it makes.
   */
  constructor(db: Database = getDb()) {
    super(db);
    this.dao = new ProtocolsDao(db);
  }

  protected toEntity(row: ProtocolRow): SavedProtocol {
    return {
      id: row.id,
      name: row.name,
      // The single place the stored JSON becomes an object again.
      document: JSON.parse(row.document) as ProtocolDocumentShape,
      shareId: row.share_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Creates or replaces a protocol. With an `id` it updates in place; without
   * one it mints a new record.
   *
   * `null` means the update matched nothing — the id is unknown *or* belongs to
   * somebody else. The two are not told apart on purpose: an owner-scoped 404
   * is the answer to both, and distinguishing them would leak that a protocol
   * with that id exists.
   */
  save(
    userId: string,
    document: ProtocolDocumentShape,
    id?: string,
  ): SavedProtocol | null {
    const write = this.transaction((): SavedProtocol | null => {
      const now = new Date().toISOString();
      const values = {
        userId,
        name: document.name,
        schemaVersion: document.version,
        document: JSON.stringify(document),
      };

      if (id !== undefined) {
        const { changes } = this.dao.update({ ...values, id, updatedAt: now });
        if (changes === 0) return null;
        return this.toEntityOrNull(this.dao.findById(userId, id));
      }

      const newId = crypto.randomUUID();
      this.dao.insert({ ...values, id: newId, createdAt: now, updatedAt: now });
      return this.toEntityOrNull(this.dao.findById(userId, newId));
    });

    return write();
  }

  /** What `Mis Protocolos` lists: the caller's protocols, most recent first. */
  listForUser(userId: string): SavedProtocol[] {
    return this.toEntities(this.dao.listByUser(userId));
  }

  findForUser(userId: string, id: string): SavedProtocol | null {
    return this.toEntityOrNull(this.dao.findById(userId, id));
  }

  /** `false` when there was nothing of theirs to delete. */
  remove(userId: string, id: string): boolean {
    return this.dao.deleteById(userId, id).changes > 0;
  }

  /**
   * The share id of a protocol, minted on first use and stable afterwards — a
   * link already handed out keeps working. `null` when the protocol is not the
   * caller's.
   */
  share(userId: string, id: string): string | null {
    const write = this.transaction((): string | null => {
      const existing = this.dao.findById(userId, id);
      if (!existing) return null;
      if (existing.share_id !== null) return existing.share_id;

      for (let attempt = 0; attempt < SHARE_ATTEMPTS; attempt += 1) {
        const shareId = mintShareId();
        try {
          if (this.dao.setShareId(userId, id, shareId, new Date().toISOString()).changes > 0) {
            return shareId;
          }
          // The guard in the query held: someone shared it in between.
          return this.dao.findById(userId, id)?.share_id ?? null;
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
        }
      }

      throw new Error("Could not mint a unique share id");
    });

    return write();
  }

  /** The public read behind a share link. No owner: that is the point of it. */
  findByShareId(shareId: string): SavedProtocol | null {
    return this.toEntityOrNull(this.dao.findByShareId(shareId));
  }
}
