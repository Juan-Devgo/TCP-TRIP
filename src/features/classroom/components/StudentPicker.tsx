import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { Student } from "@/lib/classroom";
import { useStudents } from "@/services/classroom";

export function matchesStudent(student: Student, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return (
    student.name.toLocaleLowerCase().includes(needle) ||
    (student.email?.toLocaleLowerCase().includes(needle) ?? false)
  );
}

export type Recipients = { all: boolean; studentIds: string[] };

export const ALL_STUDENTS: Recipients = { all: true, studentIds: [] };

/** "Specific students" with nobody ticked is not a legal choice. */
export function recipientsValid(recipients: Recipients): boolean {
  return recipients.all || recipients.studentIds.length > 0;
}

/**
 * Who receives the item: everyone in the course (the default) or a
 * hand-picked subset of its roster.
 */
export function StudentPicker({
  courseId,
  value,
  onChange,
  disabled = false,
}: {
  courseId: string | null;
  value: Recipients;
  onChange: (next: Recipients) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const allId = useId();
  const students = useStudents(courseId);
  const [query, setQuery] = useState("");
  const specific = !value.all;
  const selected = value.studentIds;

  if (!courseId) {
    return <p className="m-0 text-sm text-muted-foreground">{t("teacher.students.pickCourseFirst")}</p>;
  }

  const visible = (students.data ?? []).filter((student) => matchesStudent(student, query));

  return (
    <div className="flex flex-col gap-3">
      <Field orientation="horizontal">
        <FieldLabel htmlFor={allId}>{t("teacher.students.all")}</FieldLabel>
        <Switch
          id={allId}
          disabled={disabled}
          checked={!specific}
          onCheckedChange={(all) => onChange({ all, studentIds: [] })}
        />
      </Field>

      {specific && (
        <>
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              placeholder={t("teacher.students.search")}
              aria-label={t("teacher.students.search")}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>

          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {students.isPending && <Skeleton className="h-20 w-full" />}
            {students.isError && (
              <p className="m-0 text-sm text-destructive">{t("teacher.students.loadError")}</p>
            )}
            {visible.map((student) => {
              const checked = selected.includes(student.userId);
              return (
                <label
                  key={student.userId}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted"
                >
                  <Checkbox
                    disabled={disabled}
                    checked={checked}
                    onCheckedChange={(next) =>
                      onChange({
                        all: false,
                        studentIds: next
                          ? [...selected, student.userId]
                          : selected.filter((id) => id !== student.userId),
                      })
                    }
                  />
                  <span className="truncate">{student.name}</span>
                </label>
              );
            })}
          </div>
          {selected.length === 0 ? (
            <FieldError>{t("teacher.students.noneSelected")}</FieldError>
          ) : (
            <FieldDescription>{t("teacher.students.selected", { count: selected.length })}</FieldDescription>
          )}
        </>
      )}
    </div>
  );
}
