import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  CircleSlash,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { TheoryIcon } from "@/components/common/TheoryIcon";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { refreshTheoryMenu } from "@/hooks/useTheoryMenu";
import {
  DEFAULT_THEORY_ICON,
  MAX_THEORY_ITEM_LABEL_LENGTH,
  MAX_THEORY_SECTION_LABEL_LENGTH,
  THEORY_ICON_NAMES,
  type TheoryAdminSection,
  type TheoryIconName,
} from "@/lib/theory/contract";
import {
  addTheoryItem,
  createTheorySection,
  deleteTheoryItem,
  deleteTheorySection,
  getTheoryMenuForAdmin,
  moveTheoryItem,
  moveTheorySection,
  reassignTheoryItem,
  renameTheoryItem,
  updateTheorySection,
  TheoryApiError,
  type AssignablePresentation,
} from "@/services/theory";
import { cn } from "@/lib/utils";

type State =
  | { status: "loading" }
  | {
      status: "ready";
      sections: TheoryAdminSection[];
      assignable: AssignablePresentation[];
    }
  | { status: "forbidden" }
  | { status: "error" };

/**
 * The administrator's builder for the Theory section of the sidebar.
 *
 * The Theory navigation is **content**: an admin creates sections (a name and
 * an icon) and files approved presentations under them, so what a student
 * browses follows how the course is taught rather than the order in which
 * teachers happened to publish. Nothing here touches a presentation — only
 * where it appears.
 *
 * Only *approved* presentations can be filed, and an entry whose presentation
 * is later withdrawn stays listed here, marked as not visible, while
 * disappearing from every reader's sidebar on its own.
 *
 * Every successful write refreshes the shared menu cache, so the sidebar on
 * the left updates without a reload.
 */
export function TheoryMenuManager() {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState<TheoryIconName>(DEFAULT_THEORY_ICON);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const view = await getTheoryMenuForAdmin();
      setState({
        status: "ready",
        sections: view.sections,
        assignable: view.assignable,
      });
    } catch (error) {
      if (error instanceof TheoryApiError && error.isForbidden) {
        setState({ status: "forbidden" });
        return;
      }
      console.error("Could not load the Theory menu", error);
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Runs a write, then reloads both this panel and the sidebar's cache.
   *
   * Reloading instead of patching local state is deliberate: a move renumbers
   * rows the client never saw, and an entry can change visibility because
   * somebody withdrew a presentation in another tab.
   */
  async function run(action: () => Promise<unknown>, titleKey: string) {
    setBusy(true);
    try {
      await action();
      await load();
      await refreshTheoryMenu();
    } catch (error) {
      console.error(titleKey, error);
      toast.add({
        title: t(titleKey),
        type: "error",
        description: t(describe(error)),
      });
    } finally {
      setBusy(false);
    }
  }

  /** The refusals this panel can provoke, each with its own explanation. */
  function describe(error: unknown): string {
    if (!(error instanceof TheoryApiError)) return "presentations.errors.generic";
    if (error.isForbidden) return "theory.menu.errors.forbidden";
    if (error.isNotFound) return "theory.menu.errors.missing";
    if (error.isConflict) return "theory.menu.errors.conflict";
    return "presentations.errors.generic";
  }

  if (state.status === "forbidden") {
    return <p className="m-0">{t("theory.menu.forbidden")}</p>;
  }

  if (state.status === "loading") {
    return <p className="text-muted-foreground m-0">{t("common.loading")}</p>;
  }

  if (state.status === "error") {
    return <p className="text-destructive m-0">{t("theory.menu.errors.load")}</p>;
  }

  const { sections, assignable } = state;
  const label = newLabel.trim();

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="m-0">{t("theory.menu.title")}</h2>
        <p className="text-muted-foreground m-0 text-sm">{t("theory.menu.intro")}</p>
      </header>

      {/* New section: a name and an icon, which is all a section is. */}
      <div className="border-border flex flex-wrap items-end gap-2 rounded-md border px-3 py-3">
        <Field className="min-w-48 flex-1">
          <FieldLabel htmlFor="new-section">{t("theory.menu.sectionName")}</FieldLabel>
          <Input
            id="new-section"
            value={newLabel}
            maxLength={MAX_THEORY_SECTION_LABEL_LENGTH}
            placeholder={t("theory.menu.sectionNamePlaceholder")}
            onChange={(event) => setNewLabel(event.target.value)}
          />
        </Field>

        <Field className="w-44">
          <FieldLabel htmlFor="new-section-icon">{t("theory.menu.icon")}</FieldLabel>
          <IconSelect id="new-section-icon" value={newIcon} onChange={setNewIcon} />
        </Field>

        <Button
          disabled={busy || label === ""}
          onClick={() =>
            void run(async () => {
              await createTheorySection(label, newIcon);
              setNewLabel("");
            }, "theory.menu.errors.create")
          }
        >
          <Plus />
          {t("theory.menu.addSection")}
        </Button>
      </div>

      {sections.length === 0 && <p className="m-0">{t("theory.menu.empty")}</p>}

      {sections.map((section, index) => (
        <SectionCard
          key={section.id}
          section={section}
          first={index === 0}
          last={index === sections.length - 1}
          sections={sections}
          assignable={assignable}
          busy={busy}
          confirming={confirming}
          onConfirming={setConfirming}
          onRun={run}
        />
      ))}

      {assignable.length > 0 && (
        <p className="text-muted-foreground m-0 text-xs">
          {t("theory.menu.unfiled", { count: assignable.length })}
        </p>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- one section */

function SectionCard({
  section,
  first,
  last,
  sections,
  assignable,
  busy,
  confirming,
  onConfirming,
  onRun,
}: {
  section: TheoryAdminSection;
  first: boolean;
  last: boolean;
  sections: TheoryAdminSection[];
  assignable: AssignablePresentation[];
  busy: boolean;
  confirming: string | null;
  onConfirming: (id: string | null) => void;
  onRun: (action: () => Promise<unknown>, titleKey: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(section.label);
  const [icon, setIcon] = useState<TheoryIconName>(section.icon);
  const [picked, setPicked] = useState("");
  const [itemLabel, setItemLabel] = useState("");

  // A reload brings fresh rows; the inputs follow them unless they are dirty.
  useEffect(() => {
    setLabel(section.label);
    setIcon(section.icon);
  }, [section.label, section.icon]);

  const renamed = label.trim() !== "" && (label.trim() !== section.label || icon !== section.icon);

  return (
    <article className="border-border flex flex-col gap-3 rounded-md border px-3 py-3">
      <header className="flex flex-wrap items-end gap-2">
        <span className="text-secondary-ink mb-2.5 flex size-9 items-center justify-center">
          <TheoryIcon name={section.icon} className="size-5" />
        </span>

        <Field className="min-w-40 flex-1">
          <FieldLabel htmlFor={`label-${section.id}`}>
            {t("theory.menu.sectionName")}
          </FieldLabel>
          <Input
            id={`label-${section.id}`}
            value={label}
            maxLength={MAX_THEORY_SECTION_LABEL_LENGTH}
            onChange={(event) => setLabel(event.target.value)}
          />
        </Field>

        <Field className="w-44">
          <FieldLabel htmlFor={`icon-${section.id}`}>{t("theory.menu.icon")}</FieldLabel>
          <IconSelect id={`icon-${section.id}`} value={icon} onChange={setIcon} />
        </Field>

        <div className="mb-0.5 flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !renamed}
            onClick={() =>
              void onRun(
                () => updateTheorySection(section.id, label.trim(), icon),
                "theory.menu.errors.rename",
              )
            }
          >
            {t("theory.menu.save")}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={busy || first}
            aria-label={t("theory.menu.moveUp")}
            title={t("theory.menu.moveUp")}
            onClick={() => void onRun(() => moveTheorySection(section.id, -1), "theory.menu.errors.move")}
          >
            <ChevronUp />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={busy || last}
            aria-label={t("theory.menu.moveDown")}
            title={t("theory.menu.moveDown")}
            onClick={() => void onRun(() => moveTheorySection(section.id, 1), "theory.menu.errors.move")}
          >
            <ChevronDown />
          </Button>

          {confirming === section.id ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void onRun(async () => {
                    await deleteTheorySection(section.id);
                    onConfirming(null);
                  }, "theory.menu.errors.delete")
                }
              >
                {t("theory.menu.confirmDelete")}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label={t("theory.menu.cancel")}
                onClick={() => onConfirming(null)}
              >
                <X />
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive size-8"
              disabled={busy}
              aria-label={t("theory.menu.deleteSection")}
              title={t("theory.menu.deleteSection")}
              onClick={() => onConfirming(section.id)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </header>

      {/* The entries, in the order the sidebar shows them. */}
      {section.items.length === 0 ? (
        <p className="text-muted-foreground m-0 text-xs">{t("theory.menu.noItems")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {section.items.map((item, index) => (
            <li
              key={item.id}
              className="border-border m-0 flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5"
            >
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm",
                  !item.published && "text-muted-foreground",
                )}
              >
                {item.label}
              </span>

              {!item.published && (
                <span
                  className="text-muted-foreground flex items-center gap-1 text-xs"
                  title={t("theory.menu.hiddenHint")}
                >
                  <CircleSlash className="size-3.5" />
                  {t("theory.menu.hidden")}
                </span>
              )}

              {sections.length > 1 && (
                <Select
                  items={sections.map((candidate) => ({
                    value: candidate.id,
                    label: candidate.label,
                  }))}
                  value={section.id}
                  onValueChange={(next) => {
                    const target = String(next);
                    if (target === section.id) return;
                    void onRun(
                      () => reassignTheoryItem(item.id, target),
                      "theory.menu.errors.move",
                    );
                  }}
                >
                  <SelectTrigger size="sm" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={busy || index === 0}
                aria-label={t("theory.menu.moveUp")}
                onClick={() =>
                  void onRun(() => moveTheoryItem(item.id, -1), "theory.menu.errors.move")
                }
              >
                <ChevronUp />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={busy || index === section.items.length - 1}
                aria-label={t("theory.menu.moveDown")}
                onClick={() =>
                  void onRun(() => moveTheoryItem(item.id, 1), "theory.menu.errors.move")
                }
              >
                <ChevronDown />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                disabled={busy || item.label === item.title}
                title={t("theory.menu.restoreTitle")}
                onClick={() =>
                  void onRun(
                    () => renameTheoryItem(item.id, null),
                    "theory.menu.errors.rename",
                  )
                }
              >
                {t("theory.menu.restoreTitle")}
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className="text-destructive size-7"
                disabled={busy}
                aria-label={t("theory.menu.removeItem")}
                title={t("theory.menu.removeItem")}
                onClick={() =>
                  void onRun(
                    () => deleteTheoryItem(item.id),
                    "theory.menu.errors.delete",
                  )
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Filing a presentation: only approved ones are offered at all. */}
      {assignable.length === 0 ? (
        <p className="text-muted-foreground m-0 text-xs">
          {t("theory.menu.nothingToAdd")}
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field className="min-w-56 flex-1">
            <FieldLabel htmlFor={`add-${section.id}`}>
              {t("theory.menu.addPresentation")}
            </FieldLabel>
            <Select
              items={assignable.map((candidate) => ({
                value: candidate.presentationId,
                label: candidate.title,
              }))}
              value={picked}
              onValueChange={(next) => setPicked(String(next))}
            >
              <SelectTrigger id={`add-${section.id}`} className="w-full">
                <SelectValue placeholder={t("theory.menu.pickPresentation")} />
              </SelectTrigger>
              <SelectContent>
                {assignable.map((candidate) => (
                  <SelectItem key={candidate.presentationId} value={candidate.presentationId}>
                    {candidate.title} · {candidate.authorName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="min-w-48 flex-1">
            <FieldLabel htmlFor={`item-label-${section.id}`}>
              {t("theory.menu.itemLabel")}
            </FieldLabel>
            <Input
              id={`item-label-${section.id}`}
              value={itemLabel}
              maxLength={MAX_THEORY_ITEM_LABEL_LENGTH}
              placeholder={t("theory.menu.itemLabelPlaceholder")}
              onChange={(event) => setItemLabel(event.target.value)}
            />
          </Field>

          <Button
            variant="outline"
            disabled={busy || picked === ""}
            onClick={() =>
              void onRun(async () => {
                await addTheoryItem(section.id, picked, itemLabel.trim() || null);
                setPicked("");
                setItemLabel("");
              }, "theory.menu.errors.add")
            }
          >
            <Plus />
            {t("theory.menu.add")}
          </Button>
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ helpers */

function IconSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: TheoryIconName;
  onChange: (next: TheoryIconName) => void;
}) {
  const { t } = useTranslation();

  return (
    <Select
      items={THEORY_ICON_NAMES.map((name) => ({
        value: name,
        label: t(`theory.icons.${name}`),
      }))}
      value={value}
      onValueChange={(next) => onChange(String(next) as TheoryIconName)}
    >
      <SelectTrigger id={id} className="w-full">
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
  );
}
