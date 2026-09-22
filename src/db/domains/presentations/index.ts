/**
 * The presentations domain. Routes import this barrel and nothing deeper — the
 * DAO and the query strings are internals.
 */
export { PresentationsRepository } from "@/db/domains/presentations/presentations.repository";
export type {
  AddAssetResult,
  AssetRefusal,
  RemoveAssetResult,
} from "@/db/domains/presentations/presentations.repository";
export type { ProgressRow } from "@/db/domains/presentations/presentations.dao";
export type {
  PresentationAsset,
  PresentationAssetContent,
  PresentationForReview,
  PresentationReview,
  PresentationRow,
  PublishedPresentation,
  PublishedPresentationSummary,
  SavedPresentation,
} from "@/db/domains/presentations/presentations.types";
