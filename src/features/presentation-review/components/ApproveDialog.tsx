import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { TheoryIcon } from "@/components/common/TheoryIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_THEORY_ICON,
  MAX_THEORY_SECTION_LABEL_LENGTH,
  normalizeLabel,
  THEORY_ICON_NAMES,
  type TheoryIconName,
  type TheoryPlacement,
} from "@/lib/theory/contract";

/** The select value that stands for "a section that does not exist yet". */
const NEW_SECTION = "__new__";

export type SectionChoice = { id: string; label: string; icon: TheoryIconName };

/**
 * Asked when a presentation is approved for the first time: **where** it goes
 * in the Theory menu. Approving and placing are one decision on the server, so
 * confirming is disabled until there is a place — an existing section or a new
 * one named here. A re-approved edit keeps its place and never opens this.
 */
export function ApproveDialog({
  open,
  title,
  sections,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** The presentation's title, for the description. */
  title: string;
  sections: readonly SectionChoice[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (placement: TheoryPlacement) => void;
}) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<string>("");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState<TheoryIconName>(DEFAULT_THEORY_ICON);

  // Every opening starts clean; with no section yet, "new" is the only choice.
  useEffect(() => {
    if (!open) return;
    setChoice(sections.length === 0 ? NEW_SECTION : "");
    setLabel("");
    setIcon(DEFAULT_THEORY_ICON);
  }, [open, sections.length]);

  const newLabel = normalizeLabel(label, MAX_THEORY_SECTION_LABEL_LENGTH);
  const placement: TheoryPlacement | null =
    choice === NEW_SECTION
      ? newLabel === null
        ? null
        : { section: { label: newLabel, icon } }
      : choice === ""
        ? null
        : { sectionId: choice };

  const items = [
    ...sections.map((section) => ({ value: section.id, label: section.label })),
    { value: NEW_SECTION, label: t("presentations.review.approveDialog.newSection") },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("presentations.review.approveDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("presentations.review.approveDialog.body", { title })}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="approve-section">
              {t("presentations.review.approveDialog.section")}
            </FieldLabel>
            <Select
              items={items}
              value={choice}
              onValueChange={(next) => setChoice(String(next ?? ""))}
            >
              <SelectTrigger id="approve-section" className="w-full">
                <SelectValue placeholder={t("presentations.review.approveDialog.pick")} />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    <span className="flex items-center gap-2">
                      <TheoryIcon name={section.icon} className="size-4" />
                      {section.label}
                    </span>
                  </SelectItem>
                ))}
                {sections.length > 0 && <SelectSeparator />}
                <SelectItem value={NEW_SECTION}>
                  {t("presentations.review.approveDialog.newSection")}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {choice === NEW_SECTION && (
            <>
              <Field>
                <FieldLabel htmlFor="approve-section-label">
                  {t("presentations.review.approveDialog.name")}
                </FieldLabel>
                <Input
                  id="approve-section-label"
                  value={label}
                  maxLength={MAX_THEORY_SECTION_LABEL_LENGTH}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="approve-section-icon">
                  {t("presentations.review.approveDialog.icon")}
                </FieldLabel>
                <Select
                  items={THEORY_ICON_NAMES.map((name) => ({
                    value: name,
                    label: t(`theory.icons.${name}`),
                  }))}
                  value={icon}
                  onValueChange={(next) => setIcon(String(next) as TheoryIconName)}
                >
                  <SelectTrigger id="approve-section-icon" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEORY_ICON_NAMES.map((name) => (
                      <SelectItem key={name} value={name}>
                        <span className="flex items-center gap-2">
                          <TheoryIcon name={name} className="size-4" />
                          {t(`theory.icons.${name}`)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            {t("presentations.review.approveDialog.cancel")}
          </Button>
          <Button
            disabled={busy || placement === null}
            onClick={() => placement && onConfirm(placement)}
          >
            {t("presentations.review.approveDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
