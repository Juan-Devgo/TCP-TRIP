import { useTranslation } from "react-i18next";
import {
  Ban,
  Flag,
  Globe,
  Hash,
  ListOrdered,
  Plug,
  ShieldCheck,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import {
  ACCENT_INK,
  FIELD_TYPE_MIME,
} from "@/features/protocol-builder/components/accent";
import {
  fieldTypesByCategory,
  type FieldType,
} from "@/features/protocol-builder/lib/fieldTypes";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, LucideIcon> = {
  uint: Hash,
  flag: Flag,
  enum: ListOrdered,
  reserved: Ban,
  checksum: ShieldCheck,
  mac: Waypoints,
  ipv4: Globe,
  port: Plug,
};

/**
 * The tool's own left column: every field type it can build with, grouped the
 * way the course groups them. An entry is dragged onto a free cell, or picked
 * with the keyboard — picking arms the type, and the next free cell clicked
 * takes it. Both paths end in the same form.
 */
export function FieldTypePalette({
  armedTypeId,
  onArm,
  className,
}: {
  armedTypeId: string | null;
  onArm: (typeId: string | null) => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <aside
      aria-label={t("tools.protocolBuilder.palette.title")}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-sidebar p-3",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">
          {t("tools.protocolBuilder.palette.title")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("tools.protocolBuilder.palette.hint")}
        </p>
      </div>

      {fieldTypesByCategory().map(({ category, types }) => (
        <div key={category} className="flex flex-col gap-1">
          <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t(`tools.protocolBuilder.categories.${category}`)}
          </h3>
          <ul className="flex list-none flex-col gap-1 pl-0">
            {types.map((type) => (
              <li key={type.id} className="ml-0 list-none">
                <PaletteEntry
                  type={type}
                  armed={armedTypeId === type.id}
                  onArm={onArm}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}

function PaletteEntry({
  type,
  armed,
  onArm,
}: {
  type: FieldType;
  armed: boolean;
  onArm: (typeId: string | null) => void;
}) {
  const { t } = useTranslation();
  const Icon = TYPE_ICONS[type.id] ?? Hash;
  const label = t(`tools.protocolBuilder.types.${type.id}.label`);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            draggable
            aria-pressed={armed}
            onDragStart={(event) => {
              event.dataTransfer.setData(FIELD_TYPE_MIME, type.id);
              event.dataTransfer.setData("text/plain", type.id);
              event.dataTransfer.effectAllowed = "copy";
              onArm(type.id);
            }}
            onClick={() => onArm(armed ? null : type.id)}
            className={cn(
              "flex w-full cursor-grab items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs transition-colors",
              "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              armed && "border-ring bg-accent",
            )}
          />
        }
      >
        <Icon className={cn("size-4 shrink-0", ACCENT_INK[type.accent])} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {type.fixedLength ?? `≤${type.maxLength}`}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-56 text-left">
        <p>{t(`tools.protocolBuilder.types.${type.id}.description`)}</p>
      </TooltipContent>
    </Tooltip>
  );
}
