import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

/** Hold a stepper button this long before it starts repeating. */
const REPEAT_DELAY = 400;
/** Then step this often, matching the native spin buttons' feel. */
const REPEAT_INTERVAL = 60;

type NumberInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "type" | "min" | "max" | "step"
> & {
  /** Kept as a string so the field can be cleared while typing. */
  value: string;
  onValueChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Classes for the bordered group; `inputClassName` targets the field. */
  className?: string;
  inputClassName?: string;
  incrementLabel?: string;
  decrementLabel?: string;
  ref?: React.Ref<HTMLInputElement>;
};

/**
 * Number field with chevron steppers that repeat while held — the native spin
 * buttons' behaviour with the app's icons, since the native ones can't be
 * styled. The value stays a string: the caller decides what an out-of-range or
 * empty entry means, and the steppers only clamp what they produce themselves.
 */
export function NumberInput({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  className,
  inputClassName,
  incrementLabel,
  decrementLabel,
  ref,
  ...props
}: NumberInputProps) {
  const { t } = useTranslation();

  // The repeat timer fires outside React's render, so it reads the latest
  // value and callback through refs instead of a stale closure.
  const latest = React.useRef({ value, onValueChange, min, max, step });
  latest.current = { value, onValueChange, min, max, step };

  const timers = React.useRef<{
    timeout: ReturnType<typeof setTimeout> | null;
    interval: ReturnType<typeof setInterval> | null;
  }>({ timeout: null, interval: null });
  /** Set by a pointer press so the click it also fires doesn't step twice. */
  const steppedByPointer = React.useRef(false);

  const stepBy = React.useCallback((direction: number) => {
    const current = latest.current;
    const lower = current.min ?? Number.NEGATIVE_INFINITY;
    const upper = current.max ?? Number.POSITIVE_INFINITY;
    const parsed = Number.parseInt(current.value, 10);
    const base = Number.isFinite(parsed)
      ? parsed
      : Number.isFinite(lower)
        ? lower
        : 0;
    const next = String(
      Math.min(upper, Math.max(lower, base + direction * current.step)),
    );
    // Update the ref too: the next repeat tick can run before React re-renders.
    latest.current.value = next;
    current.onValueChange(next);
  }, []);

  const stopRepeat = React.useCallback(() => {
    if (timers.current.timeout) clearTimeout(timers.current.timeout);
    if (timers.current.interval) clearInterval(timers.current.interval);
    timers.current = { timeout: null, interval: null };
  }, []);

  React.useEffect(() => stopRepeat, [stopRepeat]);

  const startRepeat = React.useCallback(
    (direction: number) => {
      steppedByPointer.current = true;
      stepBy(direction);
      stopRepeat();
      timers.current.timeout = setTimeout(() => {
        timers.current.interval = setInterval(
          () => stepBy(direction),
          REPEAT_INTERVAL,
        );
      }, REPEAT_DELAY);

      // The pointer can be released anywhere, so listen on the window.
      const end = () => {
        stopRepeat();
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
      };
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    [stepBy, stopRepeat],
  );

  /** Keyboard activation fires a click with no pointer press before it. */
  const stepOnClick = (direction: number) => {
    if (steppedByPointer.current) {
      steppedByPointer.current = false;
      return;
    }
    stepBy(direction);
  };

  return (
    <InputGroup className={className}>
      <InputGroupInput
        ref={ref}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(
          // Hide the native spin buttons: the chevrons replace them.
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          inputClassName,
        )}
        {...(min !== undefined && { min })}
        {...(max !== undefined && { max })}
        step={step}
        {...props}
      />
      {/* `py-0` + short buttons so both steppers fit inside a default-height
          field; the pair is 2rem tall, under the 2.25rem of an `h-9` input. */}
      <InputGroupAddon align="inline-end" className="flex-col gap-0 py-0">
        <InputGroupButton
          size="icon-xs"
          className="h-4 w-6 [&>svg]:size-3"
          aria-label={incrementLabel ?? t("common.increment")}
          onPointerDown={() => startRepeat(1)}
          onClick={() => stepOnClick(1)}
        >
          <ChevronUp />
        </InputGroupButton>
        <InputGroupButton
          size="icon-xs"
          className="h-4 w-6 [&>svg]:size-3"
          aria-label={decrementLabel ?? t("common.decrement")}
          onPointerDown={() => startRepeat(-1)}
          onClick={() => stepOnClick(-1)}
        >
          <ChevronDown />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
