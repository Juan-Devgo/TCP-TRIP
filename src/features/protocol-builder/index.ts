/**
 * Public surface of the protocol builder. Everything outside this folder
 * imports from here — `components/` and `lib/` are internals of the feature.
 *
 * The document helpers are part of the surface because the saved schema is
 * what `Mis Protocolos` lists and what the message composer will read back.
 */
export { ProtocolBuilder } from "./components/ProtocolBuilder";
/** Read-only render of a saved protocol, for the public share link. */
export { SharedProtocolView } from "./components/SharedProtocolView";
export {
  fromProtocolDocument,
  toProtocolDocument,
  PROTOCOL_SCHEMA_VERSION,
  type ProtocolDocument,
} from "./lib/protocolExport";
export type { Protocol, ProtocolField, ProtocolNode } from "./lib/protocol";
