/**
 * SQL for the two Theory menu tables. Binds parameters, returns rows, decides
 * nothing: the caps, the "must be published" rule and the reordering are the
 * repository's.
 */

import { BaseDao } from "@/db/core/dao";
import type { WriteResult } from "@/db/core/types";
import {
  COUNT_ITEMS_IN_SECTION,
  COUNT_SECTIONS,
  DELETE_ITEM,
  DELETE_SECTION,
  INSERT_ITEM,
  INSERT_SECTION,
  MOVE_ITEM_TO_SECTION,
  NEXT_ITEM_POSITION,
  NEXT_SECTION_POSITION,
  SELECT_ADMIN_MENU,
  SELECT_ASSIGNABLE,
  SELECT_ITEM,
  SELECT_ITEM_ORDER,
  SELECT_PUBLICATION_FOR_PRESENTATION,
  SELECT_PUBLIC_MENU,
  SELECT_SECTION,
  SELECT_SECTION_ORDER,
  SET_ITEM_POSITION,
  SET_SECTION_POSITION,
  UPDATE_ITEM_LABEL,
  UPDATE_SECTION,
} from "@/db/domains/theory-menu/theoryMenu.queries";
import type {
  AdminMenuRow,
  AssignableRow,
  ItemRow,
  OrderRow,
  PublicMenuRow,
  SectionRow,
} from "@/db/domains/theory-menu/theoryMenu.types";

export class TheoryMenuDao extends BaseDao<SectionRow> {
  /* -------------------------------------------------------------- reading */

  publicMenu(): PublicMenuRow[] {
    return this.all<PublicMenuRow>(SELECT_PUBLIC_MENU);
  }

  adminMenu(): AdminMenuRow[] {
    return this.all<AdminMenuRow>(SELECT_ADMIN_MENU);
  }

  assignable(): AssignableRow[] {
    return this.all<AssignableRow>(SELECT_ASSIGNABLE);
  }

  /* ------------------------------------------------------------- sections */

  countSections(): number {
    return this.one<{ count: number }>(COUNT_SECTIONS)?.count ?? 0;
  }

  nextSectionPosition(): number {
    return this.one<{ position: number }>(NEXT_SECTION_POSITION)?.position ?? 0;
  }

  insertSection(values: {
    id: string;
    label: string;
    icon: string;
    position: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  }): WriteResult {
    return this.write(INSERT_SECTION, { ...values });
  }

  findSection(id: string): SectionRow | null {
    return this.one<SectionRow>(SELECT_SECTION, { id });
  }

  updateSection(values: {
    id: string;
    label: string;
    icon: string;
    updatedAt: string;
  }): WriteResult {
    return this.write(UPDATE_SECTION, { ...values });
  }

  deleteSection(id: string): WriteResult {
    return this.write(DELETE_SECTION, { id });
  }

  sectionOrder(): OrderRow[] {
    return this.all<OrderRow>(SELECT_SECTION_ORDER);
  }

  setSectionPosition(id: string, position: number, updatedAt: string): WriteResult {
    return this.write(SET_SECTION_POSITION, { id, position, updatedAt });
  }

  /* ---------------------------------------------------------------- items */

  countItems(sectionId: string): number {
    return this.one<{ count: number }>(COUNT_ITEMS_IN_SECTION, { sectionId })?.count ?? 0;
  }

  nextItemPosition(sectionId: string): number {
    return this.one<{ position: number }>(NEXT_ITEM_POSITION, { sectionId })?.position ?? 0;
  }

  insertItem(values: {
    id: string;
    sectionId: string;
    presentationId: string;
    label: string | null;
    position: number;
    createdBy: string;
    createdAt: string;
  }): WriteResult {
    return this.write(INSERT_ITEM, { ...values });
  }

  findItem(id: string): ItemRow | null {
    return this.one<ItemRow>(SELECT_ITEM, { id });
  }

  setItemLabel(id: string, label: string | null): WriteResult {
    return this.write(UPDATE_ITEM_LABEL, { id, label });
  }

  moveItemToSection(id: string, sectionId: string, position: number): WriteResult {
    return this.write(MOVE_ITEM_TO_SECTION, { id, sectionId, position });
  }

  deleteItem(id: string): WriteResult {
    return this.write(DELETE_ITEM, { id });
  }

  itemOrder(sectionId: string): OrderRow[] {
    return this.all<OrderRow>(SELECT_ITEM_ORDER, { sectionId });
  }

  setItemPosition(id: string, position: number): WriteResult {
    return this.write(SET_ITEM_POSITION, { id, position });
  }

  /** The live publication of a presentation, or `null` when it has none. */
  findPublication(presentationId: string): { slug: string; title: string } | null {
    return this.one<{ slug: string; title: string }>(
      SELECT_PUBLICATION_FOR_PRESENTATION,
      { presentationId },
    );
  }
}
