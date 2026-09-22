/**
 * The Theory menu domain — the admin-built navigation of the Theory section.
 * Routes import this barrel; the DAO and the query strings are internals.
 */
export { TheoryMenuRepository } from "@/db/domains/theory-menu/theoryMenu.repository";
export type {
  AddItemResult,
  CreateSectionResult,
  MenuRefusal,
  MenuWriteResult,
} from "@/db/domains/theory-menu/theoryMenu.repository";
