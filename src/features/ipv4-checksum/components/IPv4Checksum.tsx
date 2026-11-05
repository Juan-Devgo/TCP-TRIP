import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  CircleCheck,
  CircleX,
  Copy,
  Eraser,
  Info,
  ShieldCheck,
  Sigma,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { BackToTopButton } from "@/components/common/BackToTopButton";
import { ExerciseGeneratorDialog } from "@/components/common/ExerciseGeneratorDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { NumberInput } from "@/components/ui/number-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IPv4ChecksumActions } from "@/features/ipv4-checksum/components/IPv4ChecksumActions";
import { generateChecksumExercises } from "@/features/ipv4-checksum/exercises/checksumExercises";
import {
  binary,
  checkChecksumHex,
  checkFragmentOffset,
  checkIdentification,
  checkIp,
  checkProtocol,
  checkDiffServ,
  checkTotalLength,
  checkTtl,
  CHECKSUM_WORD,
  checksum,
  ChecksumError,
  headerToHex,
  hex,
  IPV4_IHL,
  IPV4_VERSION,
  MAX_BYTE,
  MAX_FRAGMENT_OFFSET,
  MAX_WORD,
  MIN_TOTAL_LENGTH,
  parseHeaderHex,
  type ChecksumErrorCode,
  type ChecksumMode,
  type ChecksumResult,
  type HeaderField,
  type Ipv4Header,
} from "@/features/ipv4-checksum/lib/checksum";
import { cn } from "@/lib/utils";

/** What the student types: strings, so a field can be emptied mid-edit. */
type FormState = {
  diffServ: string;
  totalLength: string;
  identification: string;
  df: boolean;
  mf: boolean;
  fragmentOffset: string;
  ttl: string;
  protocol: string;
  checksum: string;
  sourceIp: string;
  destinationIp: string;
};

type TextField = Exclude<keyof FormState, "df" | "mf">;

/**
 * The usual values of a header leaving a host: DiffServ 0 (best effort), DF
 * set, TTL 64, TCP and Checksum still 0000. What identifies the datagram
 * stays empty.
 */
const DEFAULT_FORM: FormState = {
  diffServ: "0",
  totalLength: "",
  identification: "",
  df: true,
  mf: false,
  fragmentOffset: "0",
  ttl: "64",
  protocol: "6",
  checksum: "0000",
  sourceIp: "",
  destinationIp: "",
};

const FORM_KEYS = Object.keys(DEFAULT_FORM) as (keyof FormState)[];

function isDefaultForm(form: FormState): boolean {
  return FORM_KEYS.every((key) => form[key] === DEFAULT_FORM[key]);
}

function formFromHeader(header: Ipv4Header): FormState {
  return {
    diffServ: String(header.diffServ),
    totalLength: String(header.totalLength),
    identification: String(header.identification),
    df: header.df === 1,
    mf: header.mf === 1,
    fragmentOffset: String(header.fragmentOffset),
    ttl: String(header.ttl),
    protocol: String(header.protocol),
    checksum: hex(header.checksum, 4),
    sourceIp: header.sourceIp,
    destinationIp: header.destinationIp,
  };
}

/**
 * The worked example of RFC 1071 in three states, so every reading of the
 * result can be seen: still to calculate, intact, and with TTL changed by one
 * on the way (0x40 → 0x3f) while the checksum stayed.
 */
const EXAMPLES: { hex: string; mode: ChecksumMode }[] = [
  {
    hex: "45 00 00 3c 1c 46 40 00 40 06 00 00 ac 10 0a 63 ac 10 0a 0c",
    mode: "calculate",
  },
  {
    hex: "45 00 00 3c 1c 46 40 00 40 06 b1 e6 ac 10 0a 63 ac 10 0a 0c",
    mode: "verify",
  },
  {
    hex: "45 00 00 3c 1c 46 40 00 3f 06 b1 e6 ac 10 0a 63 ac 10 0a 0c",
    mode: "verify",
  },
];

/** Protocol numbers a student meets, named next to the field. */
const PROTOCOL_NAMES: Record<number, string> = {
  1: "ICMP",
  2: "IGMP",
  6: "TCP",
  17: "UDP",
  41: "IPv6",
  47: "GRE",
  50: "ESP",
  89: "OSPF",
};

/** One cell of the RFC 791 grid: a field and the bits it takes on its row. */
type Cell = { field: HeaderField; bits: number };

/** RFC 791 §3.1, figure 4: five rows of 32 bits for a header without options. */
const HEADER_LAYOUT: Cell[][] = [
  [
    { field: "version", bits: 4 },
    { field: "ihl", bits: 4 },
    { field: "diffServ", bits: 8 },
    { field: "totalLength", bits: 16 },
  ],
  [
    { field: "identification", bits: 16 },
    { field: "reserved", bits: 1 },
    { field: "df", bits: 1 },
    { field: "mf", bits: 1 },
    { field: "fragmentOffset", bits: 13 },
  ],
  [
    { field: "ttl", bits: 8 },
    { field: "protocol", bits: 8 },
    { field: "checksum", bits: 16 },
  ],
  [{ field: "sourceIp", bits: 32 }],
  [{ field: "destinationIp", bits: 32 }],
];

/** Bit positions labelled above the grid, at the byte boundaries. */
const BIT_MARKS = [0, 8, 16, 24, 31];

const BIT_RULER = Array.from({ length: 32 }, (_, bit) => (
  <span
    key={`bit-${bit}`}
    aria-hidden
    className="bg-muted text-center font-mono text-xs leading-6 text-muted-foreground"
  >
    {BIT_MARKS.includes(bit) ? bit : ""}
  </span>
));

type FieldLabels = Record<HeaderField, string>;

const HEADER_FIELDS: HeaderField[] = HEADER_LAYOUT.flat().map((cell) => cell.field);

function useFieldLabels(): FieldLabels {
  const { t } = useTranslation();
  return Object.fromEntries(
    HEADER_FIELDS.map((field) => [field, t(`tools.ipv4Checksum.fields.${field}`)]),
  ) as FieldLabels;
}

type FieldErrors = Record<TextField, ChecksumErrorCode | null>;

/** An empty field is incomplete, not wrong: it gets no message. */
function numberError(
  text: string,
  check: (value: number) => ChecksumErrorCode | null,
): ChecksumErrorCode | null {
  if (text.trim() === "") return null;
  return check(Number(text));
}

function validate(form: FormState): FieldErrors {
  return {
    diffServ: numberError(form.diffServ, checkDiffServ),
    totalLength: numberError(form.totalLength, checkTotalLength),
    identification: numberError(form.identification, checkIdentification),
    fragmentOffset: numberError(form.fragmentOffset, checkFragmentOffset),
    ttl: numberError(form.ttl, checkTtl),
    protocol: numberError(form.protocol, checkProtocol),
    checksum: form.checksum === "" ? null : checkChecksumHex(form.checksum),
    sourceIp: form.sourceIp === "" ? null : checkIp(form.sourceIp),
    destinationIp: form.destinationIp === "" ? null : checkIp(form.destinationIp),
  };
}

/** The header the form describes, or null while a field is empty or wrong. */
function toHeader(form: FormState, errors: FieldErrors): Ipv4Header | null {
  const texts: string[] = [
    form.diffServ,
    form.totalLength,
    form.identification,
    form.fragmentOffset,
    form.ttl,
    form.protocol,
    form.checksum,
    form.sourceIp,
    form.destinationIp,
  ];
  if (texts.some((text) => text.trim() === "")) return null;
  if (Object.values(errors).some((error) => error !== null)) return null;
  return {
    version: IPV4_VERSION,
    ihl: IPV4_IHL,
    diffServ: Number(form.diffServ),
    totalLength: Number(form.totalLength),
    identification: Number(form.identification),
    reserved: 0,
    df: form.df ? 1 : 0,
    mf: form.mf ? 1 : 0,
    fragmentOffset: Number(form.fragmentOffset),
    ttl: Number(form.ttl),
    protocol: Number(form.protocol),
    checksum: Number.parseInt(form.checksum, 16),
    sourceIp: form.sourceIp,
    destinationIp: form.destinationIp,
  };
}

/** Interpolation values each error message needs. */
const ERROR_LIMITS: Partial<Record<ChecksumErrorCode, Record<string, number>>> = {
  diffServOutOfRange: { min: 0, max: MAX_BYTE },
  ttlOutOfRange: { min: 0, max: MAX_BYTE },
  protocolOutOfRange: { min: 0, max: MAX_BYTE },
  totalLengthOutOfRange: { min: MIN_TOTAL_LENGTH, max: MAX_WORD },
  identificationOutOfRange: { min: 0, max: MAX_WORD },
  fragmentOffsetOutOfRange: { min: 0, max: MAX_FRAGMENT_OFFSET },
};

type PasteError = { code: ChecksumErrorCode; detail: string };

function hexOf(value: string, bits: number): string | null {
  if (value.trim() === "") return null;
  return `0x${hex(Number(value), Math.ceil(bits / 4))}`;
}

function ipHex(ip: string): string {
  const bytes = ip.split(".").map((octet) => hex(Number(octet), 2));
  return `${bytes[0]}${bytes[1]} ${bytes[2]}${bytes[3]}`;
}

function word(value: number): string {
  return `0x${hex(value, 4)}`;
}

const CHECKSUM_DIGITS = 4;

/** `0xb1e6`, as the result is copied, goes into the field as `b1e6`. */
function checksumDigits(text: string): string {
  return text.replace(/\s/g, "").replace(/^0x/i, "");
}

export function IPv4Checksum() {
  const { t } = useTranslation();
  const labels = useFieldLabels();
  const pasteId = useId();
  const bytesSwitchId = useId();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [mode, setMode] = useState<ChecksumMode>("calculate");
  const [showBytes, setShowBytes] = useState(false);
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState<PasteError | null>(null);
  const [exercisesOpen, setExercisesOpen] = useState(false);
  const exampleIndex = useRef(0);

  const errors = useMemo(() => validate(form), [form]);

  // A byte sequence on screen that does not decode leaves the fields showing
  // the last header that did: the result would answer for another header.
  const bytesBroken = showBytes && pasteError !== null;

  const live = useMemo(() => {
    if (bytesBroken) return null;
    const header = toHeader(form, errors);
    return header ? checksum(header, mode) : null;
  }, [bytesBroken, form, errors, mode]);

  // A field left wrong or emptied mid-edit keeps the last result on screen,
  // dimmed, instead of collapsing the page under the student's cursor.
  const hasInput = !isDefaultForm(form) || paste.trim() !== "";
  const [lastValid, setLastValid] = useState<ChecksumResult | null>(null);
  if (live && live !== lastValid) setLastValid(live);
  if (!hasInput && lastValid) setLastValid(null);
  const shown = live ?? (hasInput ? lastValid : null);
  const outdated = shown !== null && live === null;

  /**
   * Edits the form and rewrites the byte sequence as soon as the fields
   * describe a whole header again, so both always show the same header.
   */
  function updateForm(patch: Partial<FormState>) {
    const next = { ...form, ...patch };
    setForm(next);
    const header = toHeader(next, validate(next));
    if (!header) return;
    setPaste(headerToHex(header));
    setPasteError(null);
  }

  function setField(field: TextField, value: string) {
    updateForm({ [field]: value });
  }

  function setFlag(field: "df" | "mf", value: boolean) {
    updateForm({ [field]: value });
  }

  /** Fills the form only from a header that decodes; otherwise it stays. */
  function applyPaste(text: string) {
    setPaste(text);
    if (text.trim() === "") {
      setPasteError(null);
      return;
    }
    try {
      setForm(formFromHeader(parseHeaderHex(text)));
      setPasteError(null);
    } catch (error) {
      if (!(error instanceof ChecksumError)) throw error;
      setPasteError({ code: error.code, detail: error.detail });
    }
  }

  /** Showing the bytes shows the header in the fields, not a stale paste. */
  function toggleBytes(next: boolean) {
    setShowBytes(next);
    if (!next) return;
    const header = toHeader(form, errors);
    if (!header) return;
    setPaste(headerToHex(header));
    setPasteError(null);
  }

  function loadExample() {
    const example = EXAMPLES[exampleIndex.current % EXAMPLES.length];
    exampleIndex.current += 1;
    if (!example) return;
    applyPaste(example.hex);
    setMode(example.mode);
  }

  function clearAll() {
    setForm(DEFAULT_FORM);
    setMode("calculate");
    setPaste("");
    setPasteError(null);
    exampleIndex.current = 0;
  }

  /** Writes a checksum into the header, and so into the byte sequence. */
  function setChecksum(value: number) {
    setField("checksum", hex(value, 4));
  }

  function applyChecksum(value: number) {
    setChecksum(value);
    setMode("verify");
  }

  const isEmpty =
    paste === "" && isDefaultForm(form) && mode === "calculate";

  const fieldErrors = (Object.entries(errors) as [TextField, ChecksumErrorCode | null][])
    .filter((entry): entry is [TextField, ChecksumErrorCode] => entry[1] !== null)
    .map(([field, code]) =>
      t(`tools.ipv4Checksum.errors.${code}`, {
        field: labels[field],
        ...ERROR_LIMITS[code],
      }),
    );

  const pasteMessage = pasteError
    ? t(`tools.ipv4Checksum.errors.${pasteError.code}`, {
        digits: pasteError.detail,
        value: pasteError.detail,
        bytes: Number(pasteError.detail) * 4,
        ...ERROR_LIMITS[pasteError.code],
      })
    : null;

  return (
    <div className="mx-auto mt-16 mb-40 flex w-full max-w-5xl flex-col gap-6">
      <IPv4ChecksumActions
        onLoadExample={loadExample}
        onGenerateExercises={() => setExercisesOpen(true)}
        onClear={clearAll}
      />
      <ExerciseGeneratorDialog
        open={exercisesOpen}
        onOpenChange={setExercisesOpen}
        toolTitle={t("tools.ipv4Checksum.title")}
        generator={generateChecksumExercises}
      />

      <Card className="w-full bg-sidebar">
        <CardHeader className="text-center">
          <CardTitle>{t("tools.ipv4Checksum.title")}</CardTitle>
          <CardDescription>{t("tools.ipv4Checksum.subtitle")}</CardDescription>
          <CardAction>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("tools.ipv4Checksum.intro")}
                  />
                }
              >
                <Info />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-left">
                <p>{t("tools.ipv4Checksum.intro")}</p>
              </TooltipContent>
            </Tooltip>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={mode}
              onValueChange={(value) =>
                setMode(value === "verify" ? "verify" : "calculate")
              }
            >
              <TabsList aria-label={t("tools.ipv4Checksum.modes.label")}>
                <TabsTrigger value="calculate">
                  <Sigma />
                  {t("tools.ipv4Checksum.modes.calculate")}
                </TabsTrigger>
                <TabsTrigger value="verify">
                  <ShieldCheck />
                  {t("tools.ipv4Checksum.modes.verify")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={clearAll}
                    disabled={isEmpty}
                  >
                    <Trash2 />
                    {t("tools.ipv4Checksum.actions.clear")}
                  </Button>
                }
              />
              <TooltipContent>
                <Kbd>ESC</Kbd>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="m-0 text-sm text-muted-foreground">
            {t(`tools.ipv4Checksum.modes.${mode}Hint`)}
          </p>

          <Field orientation="horizontal">
            <Switch
              className="mt-0.5"
              id={bytesSwitchId}
              checked={showBytes}
              onCheckedChange={toggleBytes}
            />
            <FieldContent>
              <FieldLabel htmlFor={bytesSwitchId}>
                {t("tools.ipv4Checksum.bytes.toggle")}
              </FieldLabel>
              <FieldDescription>{t("tools.ipv4Checksum.bytes.toggleHint")}</FieldDescription>
            </FieldContent>
          </Field>

          {showBytes && (
            <Field data-invalid={pasteError !== null}>
              <FieldLabel htmlFor={pasteId} className="sr-only">
                {t("tools.ipv4Checksum.bytes.label")}
              </FieldLabel>
              <Textarea
                id={pasteId}
                value={paste}
                onChange={(event) => applyPaste(event.target.value)}
                placeholder={t("tools.ipv4Checksum.bytes.placeholder")}
                aria-invalid={pasteError !== null}
                spellCheck={false}
                autoComplete="off"
                rows={2}
                className="font-mono"
              />
              {pasteMessage ? (
                <p role="alert" className="m-0 text-xs text-destructive">
                  {pasteMessage}
                </p>
              ) : (
                <FieldDescription>{t("tools.ipv4Checksum.bytes.hint")}</FieldDescription>
              )}
            </Field>
          )}

          <HeaderForm
            form={form}
            errors={errors}
            labels={labels}
            onField={setField}
            onFlag={setFlag}
          />
          <ErrorList errors={fieldErrors} />

          <section className="flex flex-col gap-4">
            <h3 className="m-0 text-base font-semibold">
              {t("tools.ipv4Checksum.results")}
            </h3>
            {shown ? (
              <div className="flex flex-col gap-3">
                {outdated && (
                  <p className="m-0 text-center text-xs text-muted-foreground">
                    {t("tools.ipv4Checksum.outdated")}
                  </p>
                )}
                <div
                  // A result that no longer matches the fields is shown for its
                  // shape only: dimmed and out of reach.
                  inert={outdated}
                  className={cn("transition-opacity", outdated && "opacity-40")}
                >
                  <Results
                    result={shown}
                    labels={labels}
                    onUseChecksum={applyChecksum}
                    onZeroChecksum={() => setChecksum(0)}
                  />
                </div>
              </div>
            ) : (
              <EmptyResults />
            )}
          </section>
        </CardContent>
      </Card>
      <BackToTopButton />
    </div>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div role="alert" className="flex flex-col gap-1">
      {errors.map((error) => (
        <p key={error} className="m-0 text-center text-xs text-destructive">
          {error}
        </p>
      ))}
    </div>
  );
}

/**
 * The form drawn as RFC 791 draws the header: 32 bits per row, each field as
 * wide as its bits, with its hex value under the input. Scrolls sideways on a
 * phone instead of squeezing the one-bit flags out of sight.
 */
function HeaderForm({
  form,
  errors,
  labels,
  onField,
  onFlag,
}: {
  form: FormState;
  errors: FieldErrors;
  labels: FieldLabels;
  onField: (field: TextField, value: string) => void;
  onFlag: (field: "df" | "mf", value: boolean) => void;
}) {
  const { t } = useTranslation();
  const baseId = useId();
  const id = (field: HeaderField) => `${baseId}-${field}`;

  function numberCell(field: TextField, bits: number, min: number, max: number) {
    const invalid = errors[field] !== null;
    const value = form[field];
    const name =
      field === "protocol" && !invalid ? PROTOCOL_NAMES[Number(value)] : undefined;
    const hexValue = invalid ? null : hexOf(value, bits);
    return (
      <FormCell
        field={field}
        bits={bits}
        label={labels[field]}
        htmlFor={id(field)}
        hint={hexValue && (name ? `${hexValue} · ${name}` : hexValue)}
      >
        <NumberInput
          id={id(field)}
          min={min}
          max={max}
          value={value}
          onValueChange={(next) => onField(field, next)}
          aria-invalid={invalid}
          className="h-9"
          inputClassName="text-center font-mono text-base text-quaternary-ink"
        />

      </FormCell>
    );
  }

  function ipCell(field: "sourceIp" | "destinationIp") {
    const invalid = errors[field] !== null;
    const value = form[field];
    return (
      <FormCell
        field={field}
        bits={32}
        label={labels[field]}
        htmlFor={id(field)}
        hint={!invalid && value !== "" ? `0x${ipHex(value).replace(" ", " 0x")}` : null}
      >
        <Input
          id={id(field)}
          value={value}
          onChange={(event) => onField(field, event.target.value)}
          aria-invalid={invalid}
          placeholder="0.0.0.0"
          inputMode="numeric"
          spellCheck={false}
          autoComplete="off"
          className="mx-auto h-9 max-w-xs text-center font-mono text-base text-tertiary-ink"
        />

      </FormCell>
    );
  }

  function flagCell(field: "df" | "mf") {
    return (
      <FormCell field={field} bits={1} label={labels[field]} htmlFor={id(field)}>
        <Checkbox
          id={id(field)}
          checked={form[field]}
          onCheckedChange={(checked) => onFlag(field, checked)}
          aria-label={t(`tools.ipv4Checksum.flags.${field}`)}
        />
      </FormCell>
    );
  }

  function fixedCell(field: HeaderField, bits: number, value: string) {
    return (
      <FormCell
        field={field}
        bits={bits}
        label={labels[field]}
        hint={bits > 1 ? t("tools.ipv4Checksum.fixed") : null}
      >
        <span className="font-mono text-base text-muted-foreground">{value}</span>
      </FormCell>
    );
  }

  const checksumInvalid = errors.checksum !== null;

  return (
    <div className="overflow-x-auto">
      {/* The gap shows the border colour through: one hairline per edge. */}
      <div className="grid min-w-[48rem] grid-cols-32 gap-px overflow-hidden rounded-md border bg-border">
        {BIT_RULER}
        {fixedCell("version", 4, String(IPV4_VERSION))}
        {fixedCell("ihl", 4, String(IPV4_IHL))}
        {numberCell("diffServ", 8, 0, MAX_BYTE)}
        {numberCell("totalLength", 16, MIN_TOTAL_LENGTH, MAX_WORD)}
        {numberCell("identification", 16, 0, MAX_WORD)}
        {fixedCell("reserved", 1, "0")}
        {flagCell("df")}
        {flagCell("mf")}
        {numberCell("fragmentOffset", 13, 0, MAX_FRAGMENT_OFFSET)}
        {numberCell("ttl", 8, 0, MAX_BYTE)}
        {numberCell("protocol", 8, 0, MAX_BYTE)}
        <FormCell
          field="checksum"
          bits={16}
          label={labels.checksum}
          htmlFor={id("checksum")}
          hint={t("tools.ipv4Checksum.checksumHint")}
          highlight
        >
          <Input
            id={id("checksum")}
            value={form.checksum}
            onChange={(event) => {
              const digits = checksumDigits(event.target.value);
              if (digits.length <= CHECKSUM_DIGITS) onField("checksum", digits);
            }}
            aria-invalid={checksumInvalid}
            spellCheck={false}
            autoComplete="off"
            className="mx-auto h-9 max-w-32 text-center font-mono text-base text-primary-ink"
          />

        </FormCell>
        {ipCell("sourceIp")}
        {ipCell("destinationIp")}
      </div>
    </div>
  );
}

function FormCell({
  field,
  bits,
  label,
  htmlFor,
  hint = null,
  highlight = false,
  children,
}: {
  field: HeaderField;
  bits: number;
  label: string;
  htmlFor?: string;
  hint?: string | null | undefined;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-field={field}
      title={label}
      style={{ gridColumn: `span ${bits} / span ${bits}` }}
      className={cn("min-w-0 bg-card", highlight && "bg-primary/10")}
    >
      <div className="flex size-full flex-col items-center justify-start gap-1 px-1 py-2 text-center">
        <label
          htmlFor={htmlFor}
          className="w-full truncate text-xs leading-tight text-muted-foreground"
        >
          {label}
        </label>
        <div className="flex min-h-9 w-full items-center justify-center">{children}</div>
        <span className="min-h-4 w-full truncate font-mono text-xs leading-4 text-muted-foreground">
          {hint}
        </span>
      </div>
    </div>
  );
}

function Results({
  result,
  labels,
  onUseChecksum,
  onZeroChecksum,
}: {
  result: ChecksumResult;
  labels: FieldLabels;
  onUseChecksum: (value: number) => void;
  onZeroChecksum: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <WordsStep result={result} labels={labels} />
      <SumStep result={result} />
      <FoldStep result={result} />
      <ComplementStep result={result} />
      <Verdict
        result={result}
        onUseChecksum={onUseChecksum}
        onZeroChecksum={onZeroChecksum}
      />
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Card className="w-full bg-background">
      <CardHeader>
        <CardTitle className="text-base">
          {t("tools.ipv4Checksum.steps.label", { step })} · {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

/** Step 1: the ten words, each with the fields its bits come from. */
function WordsStep({ result, labels }: { result: ChecksumResult; labels: FieldLabels }) {
  const { t } = useTranslation();
  const { mode, header, words } = result;
  const note =
    mode === "verify"
      ? "checksumVerify"
      : header.checksum === 0
        ? "checksumCalculate"
        : "checksumNotZero";

  return (
    <StepCard
      step={1}
      title={t("tools.ipv4Checksum.steps.words.title")}
      description={t("tools.ipv4Checksum.steps.words.description")}
    >
      <ol className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-5">
        {words.map(({ value, fields }, index) => {
          const isChecksum = index === CHECKSUM_WORD;
          return (
            <li
              key={index}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-center",
                isChecksum ? "border-primary bg-primary/10" : "bg-card",
              )}
            >
              <span className="text-xs text-muted-foreground">
                {t("tools.ipv4Checksum.steps.words.word", { index: index + 1 })}
              </span>
              <span
                className={cn(
                  "font-mono text-lg",
                  isChecksum && "font-semibold text-primary-ink",
                )}
              >
                {hex(value, 4)}
              </span>
              <span className="text-xs leading-tight text-muted-foreground">
                {[...new Set(fields)]
                  .filter((field) => field !== "reserved")
                  .map((field) => labels[field])
                  .join(" · ")}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="m-0 text-sm">
        {t(`tools.ipv4Checksum.steps.words.${note}`, { value: word(header.checksum) })}
      </p>
    </StepCard>
  );
}

/** Step 2: the column sum, with what spills past 16 bits marked as carry. */
function SumStep({ result }: { result: ChecksumResult }) {
  const { t } = useTranslation();
  const { sum } = result.steps;
  const total = sum.toString(16).padStart(4, "0");
  const carry = total.slice(0, -4);
  const width = total.length;

  return (
    <StepCard
      step={2}
      title={t("tools.ipv4Checksum.steps.sum.title")}
      description={t("tools.ipv4Checksum.steps.sum.description")}
    >
      <div className="mx-auto flex w-fit flex-col font-mono text-base leading-6 whitespace-pre">
        {result.words.map(({ value }, index) => (
          <span
            key={index}
            className={cn(index === CHECKSUM_WORD && "text-primary-ink")}
          >
            {index === 0 ? "  " : "+ "}
            {hex(value, 4).padStart(width, " ")}
          </span>
        ))}
        <span className="border-t font-semibold">
          {"= "}
          {carry && <span className="text-secondary-ink">{carry}</span>}
          {total.slice(-4)}
        </span>
      </div>
      <p className="m-0 text-sm">
        {carry
          ? t("tools.ipv4Checksum.steps.sum.carry", {
              sum: `0x${total}`,
              carry: `0x${carry}`,
            })
          : t("tools.ipv4Checksum.steps.sum.noCarry", { sum: `0x${total}` })}
      </p>
    </StepCard>
  );
}

/** Lines of binary under each other, the hex value of each at the side. */
function BinaryRows({
  rows,
  bits,
}: {
  rows: { operator: string; value: number; emphasis?: boolean }[];
  bits: number;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="mx-auto grid w-fit grid-cols-[auto_auto_auto] gap-x-3 font-mono text-sm leading-6 whitespace-pre">
        {rows.map(({ operator, value, emphasis }, index) => (
          <div
            key={index}
            className={cn(
              "col-span-3 grid grid-cols-subgrid",
              emphasis && "border-t font-semibold",
            )}
          >
            <span className="text-muted-foreground">{operator}</span>
            <span>{binary(value, bits)}</span>
            <span className="text-muted-foreground">{`0x${hex(value, Math.ceil(bits / 4))}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Step 3: every carry added back, a second time if the first fold carried. */
function FoldStep({ result }: { result: ChecksumResult }) {
  const { t } = useTranslation();
  const { folds, folded } = result.steps;

  return (
    <StepCard
      step={3}
      title={t("tools.ipv4Checksum.steps.fold.title")}
      description={t("tools.ipv4Checksum.steps.fold.why")}
    >
      {folds.length === 0 ? (
        <p className="m-0 text-sm">
          {t("tools.ipv4Checksum.steps.fold.none", { value: word(folded) })}
        </p>
      ) : (
        folds.map((fold, index) => {
          const bits = fold.result > MAX_WORD ? 17 : 16;
          return (
            <div key={index} className="flex flex-col gap-2">
              {folds.length > 1 && (
                <p className="m-0 text-sm font-medium">
                  {t(
                    index === 0
                      ? "tools.ipv4Checksum.steps.fold.first"
                      : "tools.ipv4Checksum.steps.fold.again",
                  )}
                </p>
              )}
              <p className="m-0 text-center font-mono text-lg">
                {word(fold.low)} + {word(fold.carry)} ={" "}
                <span className="font-semibold text-primary-ink">
                  {`0x${hex(fold.result, 4)}`}
                </span>
              </p>
              <BinaryRows
                bits={bits}
                rows={[
                  { operator: " ", value: fold.low },
                  { operator: "+", value: fold.carry },
                  { operator: "=", value: fold.result, emphasis: true },
                ]}
              />
            </div>
          );
        })
      )}
    </StepCard>
  );
}

/** Step 4: every bit of the folded sum flipped. */
function ComplementStep({ result }: { result: ChecksumResult }) {
  const { t } = useTranslation();
  const { folded, complement } = result.steps;

  return (
    <StepCard
      step={4}
      title={t("tools.ipv4Checksum.steps.complement.title")}
      description={t(`tools.ipv4Checksum.steps.complement.${result.mode}`)}
    >
      <BinaryRows
        bits={16}
        rows={[
          { operator: " ", value: folded },
          { operator: "~", value: complement, emphasis: true },
        ]}
      />
      <p className="m-0 text-center font-mono text-lg">
        ~{word(folded)} ={" "}
        <span className="font-semibold text-primary-ink">{word(complement)}</span>
      </p>
    </StepCard>
  );
}

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check /> : <Copy />}
      {t(copied ? "common.copied" : "common.copy")}
    </Button>
  );
}

/** What the result means for the chosen mode, with the next move offered. */
function Verdict({
  result,
  onUseChecksum,
  onZeroChecksum,
}: {
  result: ChecksumResult;
  onUseChecksum: (value: number) => void;
  onZeroChecksum: () => void;
}) {
  const { t } = useTranslation();
  const { interpretation, result: value, header } = result;
  const key = `tools.ipv4Checksum.verdict.${interpretation}`;
  const values = { result: word(value), checksum: word(header.checksum) };

  const tone =
    interpretation === "rejected"
      ? "destructive"
      : interpretation === "calculated" || interpretation === "accepted"
        ? "success"
        : "warning";
  const icon =
    tone === "destructive" ? (
      <CircleX />
    ) : tone === "success" ? (
      <CircleCheck />
    ) : (
      <TriangleAlert />
    );

  return (
    <Alert variant={tone}>
      {icon}
      <AlertTitle>{t(`${key}.title`, values)}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p className="m-0">{t(`${key}.description`, values)}</p>
        {interpretation === "calculated" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl font-semibold text-success-ink">
              {word(value)}
            </span>
            <CopyButton value={word(value)} />
            <Button type="button" size="sm" onClick={() => onUseChecksum(value)}>
              <ShieldCheck />
              {t("tools.ipv4Checksum.actions.useChecksum")}
            </Button>
          </div>
        )}
        {(interpretation === "checksumNotZero" ||
          interpretation === "alreadyCalculated") && (
          <div>
            <Button type="button" variant="outline" size="sm" onClick={onZeroChecksum}>
              <Eraser />
              {t("tools.ipv4Checksum.actions.setZero")}
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** The shape of the answer, before there is an answer to put in it. */
function EmptyResults() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-background p-3 sm:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
      <p className="m-0 text-center text-xs text-muted-foreground">
        {t("tools.ipv4Checksum.noData")}
      </p>
    </div>
  );
}
