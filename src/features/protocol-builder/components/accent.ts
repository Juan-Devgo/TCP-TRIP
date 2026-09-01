import type { FieldAccent } from "@/features/protocol-builder/lib/fieldTypes";

/**
 * The brand ink each field type is drawn with. Kept next to the components
 * because it is presentation: the catalogue only says *which* accent a type
 * carries, this says what that looks like.
 */
export const ACCENT_CELL: Record<FieldAccent, string> = {
  primary: "border-primary/50 bg-primary/10 text-primary-ink",
  secondary: "border-secondary/50 bg-secondary/10 text-secondary-ink",
  tertiary: "border-tertiary/60 bg-tertiary/10 text-tertiary-ink",
  quaternary: "border-quaternary/50 bg-quaternary/10 text-quaternary-ink",
  muted: "border-border bg-muted text-muted-foreground",
};

export const ACCENT_INK: Record<FieldAccent, string> = {
  primary: "text-primary-ink",
  secondary: "text-secondary-ink",
  tertiary: "text-tertiary-ink",
  quaternary: "text-quaternary-ink",
  muted: "text-muted-foreground",
};

/** The MIME type a dragged palette entry carries. */
export const FIELD_TYPE_MIME = "application/x-tcp-trip-field-type";

/** The MIME type a field or a group band dragged inside the diagram carries. */
export const FIELD_MOVE_MIME = "application/x-tcp-trip-field-move";
