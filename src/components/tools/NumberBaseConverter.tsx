import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronUp, Copy, Delete } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Information } from "@/components/icons/Information";
import {
  convertBase,
  digitsForBase,
  isNumberBase,
  MAX_LENGTH,
  NUMBER_BASES,
  type NumberBase,
} from "@/lib/numberBase";
import { cn } from "@/lib/utils";

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

type KeyKind = "digit" | "hex" | "clear" | "backspace" | "length";

type KeypadKey = {
  /** Character appended to the operand, or the command name. */
  key: string;
  kind: KeyKind;
};

/**
 * Same layout as the source component: the top row is CLR / ⌫ / LEN followed by
 * the length input, which occupies the fourth cell of the grid.
 */
const KEYPAD_ROWS: KeypadKey[][] = [
  [
    { key: "Clear", kind: "clear" },
    { key: "Backspace", kind: "backspace" },
    { key: "Length", kind: "length" },
  ],
  [
    { key: "7", kind: "digit" },
    { key: "8", kind: "digit" },
    { key: "9", kind: "digit" },
    { key: "A", kind: "hex" },
  ],
  [
    { key: "4", kind: "digit" },
    { key: "5", kind: "digit" },
    { key: "6", kind: "digit" },
    { key: "B", kind: "hex" },
  ],
  [
    { key: "1", kind: "digit" },
    { key: "2", kind: "digit" },
    { key: "3", kind: "digit" },
    { key: "C", kind: "hex" },
  ],
  [
    { key: "0", kind: "digit" },
    { key: "F", kind: "hex" },
    { key: "E", kind: "hex" },
    { key: "D", kind: "hex" },
  ],
];

export function NumberBaseConverter() {
  const { t } = useTranslation();
  const fromId = useId();
  const toId = useId();
  const lengthId = useId();
  const lengthRef = useRef<HTMLInputElement>(null);

  const [fromBase, setFromBase] = useState<NumberBase>(10);
  const [toBase, setToBase] = useState<NumberBase>(2);
  const [operand, setOperand] = useState("");
  /** Kept as a string so the field can be cleared while typing. */
  const [length, setLength] = useState("1");
  const [pressed, setPressed] = useState<string | null>(null);

  const allowedDigits = useMemo(() => digitsForBase(fromBase), [fromBase]);

  const parsedLength = Number.parseInt(length, 10);
  const lengthTooLong = Number.isFinite(parsedLength) && parsedLength > MAX_LENGTH;
  const effectiveLength = lengthTooLong
    ? MAX_LENGTH
    : Number.isFinite(parsedLength) && parsedLength > 0
      ? parsedLength
      : 1;

  const result = useMemo(() => {
    if (operand === "") return "0";
    try {
      return convertBase(operand, fromBase, toBase, effectiveLength);
    } catch {
      return t("tools.numberBaseConverter.error");
    }
  }, [operand, fromBase, toBase, effectiveLength, t]);

  /** Flash the key so physical and virtual presses look the same. */
  const flashKey = useCallback((key: string) => {
    setPressed(key);
    setTimeout(() => setPressed((current) => (current === key ? null : current)), 100);
  }, []);

  const pressKey = useCallback(
    (key: string) => {
      if (key === "Clear") {
        setOperand("");
        return;
      }
      if (key === "Backspace") {
        setOperand((current) => current.slice(0, -1));
        return;
      }
      if (allowedDigits.includes(key)) {
        setOperand((current) => current + key);
      }
    },
    [allowedDigits],
  );

  const stepLength = useCallback((delta: number) => {
    setLength((current) => {
      const parsed = Number.parseInt(current, 10);
      const base = Number.isFinite(parsed) ? parsed : 1;
      return String(Math.min(MAX_LENGTH, Math.max(1, base + delta)));
    });
  }, []);

  // Physical keyboard mirrors the on-screen keypad, except while the user is
  // typing into the length field.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.activeElement === lengthRef.current) return;

      if (event.key === "Backspace") {
        event.preventDefault();
        flashKey("Backspace");
        pressKey("Backspace");
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        flashKey("Clear");
        pressKey("Clear");
        return;
      }

      const key = event.key.toUpperCase();
      if (key.length === 1 && allowedDigits.includes(key)) {
        event.preventDefault();
        flashKey(key);
        pressKey(key);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [allowedDigits, flashKey, pressKey]);

  function changeFromBase(value: string) {
    const next = Number(value);
    if (!isNumberBase(next)) return;
    setFromBase(next);
    setOperand(""); // digits legal in the old base may not be legal in the new one
  }

  function changeToBase(value: string) {
    const next = Number(value);
    if (isNumberBase(next)) setToBase(next);
  }

  function renderKey({ key, kind }: KeypadKey) {
    return (
      <KeypadButton
        key={key}
        label={kind === "length" ? "LEN" : kind === "clear" ? "CLR" : key}
        kind={kind}
        disabled={
          (kind === "digit" || kind === "hex") && !allowedDigits.includes(key)
        }
        active={pressed === key}
        ariaLabel={
          kind === "clear"
            ? t("tools.numberBaseConverter.clear")
            : kind === "backspace"
              ? t("tools.numberBaseConverter.backspace")
              : kind === "length"
                ? t("tools.numberBaseConverter.length")
                : key
        }
        {...(kind === "length"
          ? { tooltip: t("tools.numberBaseConverter.length") }
          : kind === "clear"
            ? { tooltip: t("tools.numberBaseConverter.clearTooltip") }
            : {})}
        onPress={() => {
          flashKey(key);
          if (kind === "length") {
            lengthRef.current?.focus();
            lengthRef.current?.select();
            return;
          }
          pressKey(key);
        }}
      />
    );
  }

  return (
    // `bg-sidebar` = #FAFAFA light / #171717 dark — in dark that is already
    // what `bg-card` resolves to, so only light mode changes.
    <Card className="mx-auto w-full max-w-md bg-sidebar">
      <CardHeader className="text-center">
        <CardTitle>{t("tools.numberBaseConverter.title")}</CardTitle>
        <CardDescription>
          {t("tools.numberBaseConverter.subtitle")}
        </CardDescription>
        <CardAction>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("tools.numberBaseConverter.intro")}
                />
              }
            >
              <Information />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-left">
              <p>{t("tools.numberBaseConverter.intro")}</p>
            </TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>

      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="flex flex-col gap-3">
            <BaseRow
              id={fromId}
              label={t("tools.numberBaseConverter.from")}
              base={String(fromBase)}
              onBaseChange={changeFromBase}
              value={operand}
              placeholder="0"
              valueClassName=""
            />
            <BaseRow
              id={toId}
              label={t("tools.numberBaseConverter.to")}
              base={String(toBase)}
              onBaseChange={changeToBase}
              value={result}
              placeholder="0"
              valueClassName=""
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-2">
              {KEYPAD_ROWS[0]?.map(renderKey)}

              {/* Fourth cell of the top row, as in the source layout. */}
              <InputGroup
                className="h-auto w-full min-w-0 aspect-square"
                data-invalid={lengthTooLong || undefined}
              >
                <InputGroupInput
                  ref={lengthRef}
                  id={lengthId}
                  name="length"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_LENGTH}
                  value={length}
                  aria-label={t("tools.numberBaseConverter.length")}
                  aria-invalid={lengthTooLong}
                  onChange={(event) => setLength(event.target.value)}
                  className="h-full text-center font-mono text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <InputGroupAddon align="inline-end" className="flex-col gap-0">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={t("tools.numberBaseConverter.lengthIncrement")}
                    onClick={() => stepLength(1)}
                  >
                    <ChevronUp />
                  </InputGroupButton>
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={t("tools.numberBaseConverter.lengthDecrement")}
                    onClick={() => stepLength(-1)}
                  >
                    <ChevronDown />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>

              {KEYPAD_ROWS.slice(1).flat().map(renderKey)}
            </div>

            {lengthTooLong && (
              <FieldError className="text-center">
                {t("tools.numberBaseConverter.lengthError", { max: MAX_LENGTH })}
              </FieldError>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BaseRow({
  id,
  label,
  base,
  onBaseChange,
  value,
  placeholder,
  valueClassName,
}: {
  id: string;
  label: string;
  base: string;
  onBaseChange: (value: string) => void;
  value: string;
  placeholder: string;
  /** Brand ink class for the readout — layout/emphasis only. */
  valueClassName: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Select
          items={BASE_ITEMS}
          value={base}
          onValueChange={(next) => onBaseChange(String(next))}
        >
          <SelectTrigger id={id} className="h-10 w-24 shrink-0 font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BASE_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value} className="font-mono">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <InputGroup className="h-10 min-w-0 flex-1">
          <InputGroupAddon align="inline-start">
            <CopyButton value={value} />
          </InputGroupAddon>
          <InputGroupInput
            readOnly
            value={value}
            placeholder={placeholder}
            className={cn("text-right font-mono text-lg", valueClassName)}
          />
        </InputGroup>
      </div>
    </Field>
  );
}

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  return (
    <InputGroupButton
      size="icon-xs"
      aria-label={copied ? t("common.copied") : t("common.copy")}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check className="text-tertiary-ink" /> : <Copy />}
    </InputGroupButton>
  );
}

function KeypadButton({
  label,
  kind,
  disabled,
  active,
  ariaLabel,
  tooltip,
  onPress,
}: {
  label: string;
  kind: KeyKind;
  disabled: boolean;
  active: boolean;
  ariaLabel: string;
  /** Hint shown above the key, anchored to its upper-right corner. */
  tooltip?: string;
  onPress: () => void;
}) {
  // Amber (primary) marks the hex-only letters, destructive marks CLR; every
  // other key is the neutral `key` gray, which is borderless so it reads as a
  // key rather than as an input. Each pairing carries its own foreground
  // token, so contrast holds in both themes.
  // `secondary` is the base for neutral keys because its bg/text/hover classes
  // are all plain (no `dark:` variants), so `cn()` can merge them away for the
  // `key` tokens below — `ghost` would leave its dark-mode hover behind.
  const variant = (
    kind === "hex" ? "default" : kind === "clear" ? "destructive" : "secondary"
  ) as "default" | "destructive" | "secondary";

  const isNeutral = variant === "secondary";
  const isDigit = kind === "digit" || kind === "hex";

  const content =
    kind === "backspace" ? <Delete className="size-5" /> : label;

  const buttonProps = {
    type: "button" as const,
    variant,
    disabled,
    "aria-label": ariaLabel,
    onClick: onPress,
    className: cn(
      "h-auto w-full aspect-square font-semibold",
      // The button base sets `disabled:pointer-events-none`, which suppresses
      // any cursor; re-enable pointer events so the not-allowed cursor shows.
      // The native `disabled` attribute still blocks the click.
      "disabled:pointer-events-auto disabled:cursor-not-allowed",
      isDigit ? "font-mono text-lg" : "text-xs",
      isNeutral && "bg-key text-key-foreground hover:bg-key-hover",
      active && "translate-y-px brightness-95",
    ),
  };

  if (!tooltip) {
    return <Button {...buttonProps}>{content}</Button>;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<Button {...buttonProps} />}>
        {content}
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
