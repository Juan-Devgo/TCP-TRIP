/**
 * The protocols domain. Routes import this barrel and nothing deeper — the
 * DAO and the query strings are internals.
 */
export { ProtocolsRepository } from "@/db/domains/protocols/protocols.repository";
export type {
  ProtocolRow,
  SavedProtocol,
} from "@/db/domains/protocols/protocols.types";
