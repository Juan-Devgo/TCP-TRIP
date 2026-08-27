import { useTranslation } from "react-i18next";
import { LanguagesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Language names stay as autonyms (English / Español) in every locale so a
// user can always recognize their own language in the list.
const LANGUAGE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "en", labelKey: "language.en" },
  { value: "es", labelKey: "language.es" },
];

export function LanguageToggle({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();

  return (
    <DropdownMenu>
      {/* Base UI composes through `render`, not `asChild`. */}
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={t("language.toggle")}
            className={cn("relative", className)}
          >
            <LanguagesIcon className="size-[1.1rem]" />
            <span className="sr-only">{t("language.toggle")}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-auto min-w-36">
        <DropdownMenuRadioGroup
          value={i18n.language}
          onValueChange={(value) => i18n.changeLanguage(value)}
        >
          {LANGUAGE_OPTIONS.map(({ value, labelKey }) => (
            <DropdownMenuRadioItem key={value} value={value} closeOnClick>
              {t(labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
