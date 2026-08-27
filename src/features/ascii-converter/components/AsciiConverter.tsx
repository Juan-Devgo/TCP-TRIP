import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Download, Info, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExerciseGeneratorDialog } from "@/components/common/ExerciseGeneratorDialog";
import { AsciiConverterActions } from "@/features/ascii-converter/components/AsciiConverterActions";
import { generateAsciiExercises } from "@/features/ascii-converter/exercises/asciiExercises";
import {
  AsciiError,
  CHARSET_MODES,
  codesToText,
  convertCodesBase,
  isCharsetMode,
  textToCodes,
  type CharsetMode,
} from "@/features/ascii-converter/lib/ascii";
import { isNumberBase, NUMBER_BASES, type NumberBase } from "@/features/number-base-converter/lib/numberBase";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";

const BASE_LABELS: Record<NumberBase, string> = {
  2: "BIN",
  8: "OCT",
  10: "DEC",
  16: "HEX",
};

const BASE_ITEMS = NUMBER_BASES.map((base) => ({
  value: String(base),
  label: BASE_LABELS[base],
}));

/** Cycled by the example action, so a student always has something to read. */
const EXAMPLES: Record<CharsetMode, string[]> = {
  ascii: [
    "anita lava la tina",
    "hola mundo",
    "ascii converter",
    "TCP-TRIP",
  ],
  unicode: [
    "Ñandú en el trigal",
    "→ Pingüiŋø ←",
    "TCP-TRIP 🌐",
    "你好, mundo",
  ],
};

export function AsciiConverter() {
  const { t } = useTranslation();
  const textId = useId();
  const codesId = useId();
  const baseId = useId();
  const textFileRef = useRef<HTMLInputElement>(null);
  const codesFileRef = useRef<HTMLInputElement>(null);
  const exampleIndex = useRef(0);

  const [mode, setMode] = useState<CharsetMode>("ascii");
  const [base, setBase] = useState<NumberBase>(10);
  const [text, setText] = useState("");
  const [codes, setCodes] = useState("");
  /** Which pane is the source of truth when the base or the charset changes. */
  const [lastEdited, setLastEdited] = useState<"text" | "codes">("text");
  const [error, setError] = useState<string | null>(null);
  const [exercisesOpen, setExercisesOpen] = useState(false);

  /** The codes pane holds digits that never parsed under the current base. */
  const codesInvalid = error !== null && lastEdited === "codes";

  function describe(cause: unknown): string {
    if (cause instanceof AsciiError) {
      return t(`tools.asciiConverter.errors.${cause.code}`, {
        detail: cause.detail,
      });
    }
    return t("tools.asciiConverter.errors.generic");
  }

  function writeText(next: string) {
    setText(next);
    setLastEdited("text");
    try {
      setCodes(textToCodes(next, base, mode));
      setError(null);
    } catch (cause) {
      setError(describe(cause));
    }
  }

  function writeCodes(next: string) {
    setCodes(next);
    setLastEdited("codes");
    try {
      setText(codesToText(next, base, mode));
      setError(null);
    } catch (cause) {
      setError(describe(cause));
    }
  }

  function changeBase(value: string) {
    const next = Number(value);
    if (!isNumberBase(next) || next === base) return;
    setBase(next);

    try {
      if (lastEdited !== "codes") {
        setCodes(textToCodes(text, next, mode));
      } else if (codesInvalid) {
        // Nothing was ever parsed out of the pane, so there is no notation to
        // convert: read the digits as typed under the base just picked. That
        // is what lets "HEX digits while the selector said BIN" recover by
        // moving the selector to HEX, with no extra keystroke.
        setText(codesToText(codes, next, mode));
      } else {
        // The bytes are what the user typed; only their notation changes.
        setCodes(convertCodesBase(codes, base, next, mode));
      }
      setError(null);
    } catch (cause) {
      setError(describe(cause));
    }
  }

  function changeMode(value: string) {
    if (!isCharsetMode(value) || value === mode) return;
    setMode(value);

    try {
      if (lastEdited === "codes") {
        // Same byte stream, read under the other charset — which is exactly
        // the comparison the two tabs exist to make.
        setText(codesToText(codes, base, value));
      } else {
        setCodes(textToCodes(text, base, value));
      }
      setError(null);
    } catch (cause) {
      setError(describe(cause));
    }
  }

  function clearAll() {
    setText("");
    setCodes("");
    setError(null);
  }

  function loadExample() {
    const examples = EXAMPLES[mode];
    const example = examples[exampleIndex.current % examples.length] ?? "";
    exampleIndex.current += 1;
    writeText(example);
  }

  async function loadFile(
    input: HTMLInputElement | null,
    apply: (content: string) => void,
  ) {
    const file = input?.files?.[0];
    if (!input || !file) return;
    apply(await file.text());
    input.value = ""; // so picking the same file twice still fires `change`
  }

  return (
    <Card className="w-full bg-sidebar">
      <AsciiConverterActions
        onLoadExample={loadExample}
        onGenerateExercises={() => setExercisesOpen(true)}
        onClear={clearAll}
      />
      <ExerciseGeneratorDialog
        open={exercisesOpen}
        onOpenChange={setExercisesOpen}
        toolTitle={t("tools.asciiConverter.title")}
        generator={generateAsciiExercises}
      />
      <CardHeader className="text-center">
        <CardTitle>{t("tools.asciiConverter.title")}</CardTitle>
        <CardDescription>{t("tools.asciiConverter.subtitle")}</CardDescription>
        <CardAction>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("tools.asciiConverter.intro")}
                />
              }
            >
              <Info />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-left">
              <p>{t("tools.asciiConverter.intro")}</p>
            </TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Tabs value={mode} onValueChange={(value) => changeMode(String(value))}>
          <TabsList className="w-full">
            {CHARSET_MODES.map((value) => (
              <ModeTab key={value} mode={value} />
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center justify-between gap-2">
          <Tooltip>
            <TooltipTrigger render={
              <Button
                type="button"
                variant="destructive"
                onClick={clearAll}
                disabled={!text && !codes}
              >
                <Trash2 />
                {t("tools.asciiConverter.actions.clear")}
              </Button>
            } />
          <TooltipContent><Kbd>ESC</Kbd></TooltipContent>
          </Tooltip>

          <Select
            items={BASE_ITEMS}
            value={String(base)}
            onValueChange={(next) => changeBase(String(next))}
          >
            <SelectTrigger id={baseId} className="h-9 w-24 shrink-0 font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASE_ITEMS.map((item) => (
                <SelectItem
                  key={item.value}
                  value={item.value}
                  className="font-mono"
                >
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Pane
            id={textId}
            label={t("tools.asciiConverter.textLabel")}
            placeholder={t("tools.asciiConverter.textPlaceholder")}
            value={text}
            onValueChange={writeText}
            downloadName="texto.txt"
            fileRef={textFileRef}
            onFilePicked={() => loadFile(textFileRef.current, writeText)}
            valueClassName="text-tertiary-ink"
            count={Array.from(text).length}
          />
          <Pane
            id={codesId}
            label={t("tools.asciiConverter.codesLabel", {
              base: BASE_LABELS[base],
            })}
            placeholder={t(`tools.asciiConverter.codesPlaceholder.${base}`)}
            value={codes}
            onValueChange={writeCodes}
            downloadName="codigos.txt"
            fileRef={codesFileRef}
            onFilePicked={() => loadFile(codesFileRef.current, writeCodes)}
            valueClassName="text-secondary-ink"
            count={codes.length}
          />
        </div>

        {error && (
          <p role="alert" className="text-center text-xs text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * One charset tab. Active state borrows the app tab strip's look (primary
 * border over a primary tint), and the hint that used to sit under the strip
 * is what the tooltip carries — no drag behaviour here, only the styling.
 */
function ModeTab({ mode }: { mode: CharsetMode }) {
  const { t } = useTranslation();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <TabsTrigger
            value={mode}
            className={cn(
              "border-transparent opacity-50 transition-opacity",
              "hover:opacity-100 focus-visible:opacity-100",
              "data-active:opacity-100",
              "data-active:border-primary! data-active:bg-primary/10!",
              "data-active:text-foreground",
            )}
          />
        }
      >
        {t(`tools.asciiConverter.modes.${mode}`)}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left">
        <p>{t(`tools.asciiConverter.modeHint.${mode}`)}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function Pane({
  id,
  label,
  placeholder,
  value,
  onValueChange,
  downloadName,
  fileRef,
  onFilePicked,
  valueClassName,
  count,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Name suggested when the pane's content is saved to disk. */
  downloadName: string;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFilePicked: () => void;
  /** Brand ink class for the monospace readout — emphasis only. */
  valueClassName: string;
  count: number;
}) {
  const { t } = useTranslation();

  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <div className="flex items-center gap-0.5">
          <CopyButton value={value} />
          <IconAction
            label={t("tools.asciiConverter.download")}
            onClick={() => downloadTextFile(value, downloadName)}
          >
            <Download />
          </IconAction>
          <IconAction
            label={t("tools.asciiConverter.upload")}
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
          </IconAction>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={onFilePicked}
          />
        </div>
      </div>

      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn("h-48 resize-none font-mono text-sm", valueClassName)}
      />

      <p className="text-xs text-muted-foreground">
        {t("tools.asciiConverter.characters", { count })}
      </p>
    </Field>
  );
}

/** Icon-only button whose label is both its tooltip and its accessible name. */
function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const label = copied ? t("common.copied") : t("common.copy");

  return (
    <IconAction
      label={label}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check className="text-tertiary-ink" /> : <Copy />}
    </IconAction>
  );
}

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
