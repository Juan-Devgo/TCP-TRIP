import {
  Fragment,
  memo,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleCheck,
  CircleX,
  Info,
  LayoutList,
  Table2,
  Trash2,
} from "lucide-react";

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { NumberInput } from "@/components/ui/number-input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsTabActive } from "@/context/TabsProvider";
import { IPv4FragmentationActions } from "@/features/ipv4-fragmentation/components/IPv4FragmentationActions";
import { generateFragmentationExercises } from "@/features/ipv4-fragmentation/exercises/fragmentationExercises";
import {
  checkDataSum,
  checkMtu,
  checkTotalLength,
  DEFAULT_DESTINATION_IP,
  DEFAULT_IDENTIFICATION,
  DEFAULT_PROTOCOL,
  DEFAULT_SOURCE_IP,
  DEFAULT_TTL,
  fragment,
  FragmentationError,
  IPV4_HEADER_BYTES,
  isValidIdentification,
  isValidIpv4,
  isValidProtocol,
  isValidTtl,
  MAX_IDENTIFICATION,
  MAX_MTU,
  MAX_PROTOCOL,
  MAX_TOTAL_LENGTH,
  MAX_TTL,
  MIN_MTU,
  MIN_TOTAL_LENGTH,
  type Fragment as IpFragment,
  type FragmentationResult,
  type Ipv4Header,
} from "@/features/ipv4-fragmentation/lib/fragmentation";
import { cn } from "@/lib/utils";

type Example = {
  totalLength: number;
  mtu: number;
  identification: number;
  ttl: number;
  protocol: number;
  sourceIp: string;
  destinationIp: string;
};

/**
 * Cycled by the example action. The last one fits its MTU on purpose, so the
 * student also sees the case where nothing happens.
 */
const EXAMPLES: Example[] = [
  { totalLength: 4000, mtu: 1500, identification: 54321, ttl: 64, protocol: 17, sourceIp: "192.168.1.10", destinationIp: "10.0.0.20" },
  { totalLength: 2400, mtu: 1004, identification: 1234, ttl: 128, protocol: 6, sourceIp: "172.16.0.5", destinationIp: "8.8.8.8" },
  { totalLength: 5000, mtu: 1492, identification: 777, ttl: 255, protocol: 1, sourceIp: "10.1.1.1", destinationIp: "192.168.100.1" },
  { totalLength: 1200, mtu: 596, identification: 4242, ttl: 32, protocol: 17, sourceIp: "200.10.20.30", destinationIp: "172.31.255.254" },
  { totalLength: 1000, mtu: 1500, identification: 100, ttl: 64, protocol: 6, sourceIp: "192.168.0.2", destinationIp: "192.168.0.1" },
];

type FieldKey = keyof Ipv4Header;

/** One cell of the RFC 791 grid: a field and the bits it takes on its row. */
type Cell = { field: FieldKey; bits: number };

/** RFC 791 §3.1, figure 4: five rows of 32 bits for a header without options. */
const HEADER_LAYOUT: Cell[][] = [
  [
    { field: "version", bits: 4 },
    { field: "ihl", bits: 4 },
    { field: "tos", bits: 8 },
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

const HEADER_CELLS = HEADER_LAYOUT.flat();

/** The only fields fragmentation rewrites — highlighted on every fragment. */
const FRAGMENT_FIELDS: ReadonlySet<FieldKey> = new Set([
  "totalLength",
  "mf",
  "fragmentOffset",
]);

type FieldLabels = Record<FieldKey, string>;

/** Bit positions labelled above the grid, at the byte boundaries. */
const BIT_MARKS = [0, 8, 16, 24, 31];

/** Built once: every card draws the same ruler, so none re-renders it. */
const BIT_RULER = Array.from({ length: 32 }, (_, bit) => (
  <span
    key={`bit-${bit}`}
    aria-hidden
    className="bg-muted text-center font-mono text-xs leading-6 text-muted-foreground"
  >
    {BIT_MARKS.includes(bit) ? bit : ""}
  </span>
));

/**
 * A long split runs to over a thousand fragments (65 535 bytes over a 68-byte
 * MTU). Mounting them all on every keystroke is what made typing stall, so
 * each view mounts a batch and adds the next one as the reader nears its end.
 */
const CARD_BATCH = 12;
const ROW_BATCH = 150;

type View = "full" | "table";

export function IPv4Fragmentation() {
  const { t } = useTranslation();
  const totalLengthId = useId();
  const mtuId = useId();
  const identificationId = useId();
  const ttlId = useId();
  const protocolId = useId();
  const sourceIpId = useId();
  const destinationIpId = useId();
  const exampleIndex = useRef(0);
  const formRef = useRef<HTMLDivElement>(null);

  const [totalLength, setTotalLength] = useState("");
  const [mtu, setMtu] = useState("");
  const [identification, setIdentification] = useState("");
  const [ttl, setTtl] = useState("");
  const [protocol, setProtocol] = useState("");
  const [sourceIp, setSourceIp] = useState("");
  const [destinationIp, setDestinationIp] = useState("");
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [exercisesOpen, setExercisesOpen] = useState(false);
  const [view, setView] = useState<View>("full");

  const formOutOfView = useScrolledPast(formRef);

  // An empty field is not a mistake yet — it is a form still being filled in.
  const errors = useMemo(() => {
    const key = (name: string) => `tools.ipv4Fragmentation.errors.${name}`;
    const lengthCode = totalLength ? checkTotalLength(Number(totalLength)) : null;
    const mtuCode = mtu ? checkMtu(Number(mtu)) : null;

    return {
      totalLength: lengthCode
        ? t(key(lengthCode), { min: MIN_TOTAL_LENGTH, max: MAX_TOTAL_LENGTH })
        : null,
      mtu: mtuCode
        ? t(key(mtuCode), {
            min: MIN_MTU,
            max: MAX_MTU,
            mtu: Number(mtu),
            data: Number(mtu) - IPV4_HEADER_BYTES,
          })
        : null,
      identification:
        identification && !isValidIdentification(Number(identification))
          ? t(key("invalidIdentification"), { max: MAX_IDENTIFICATION })
          : null,
      ttl:
        ttl && !isValidTtl(Number(ttl))
          ? t(key("invalidTtl"), { max: MAX_TTL })
          : null,
      protocol:
        protocol && !isValidProtocol(Number(protocol))
          ? t(key("invalidProtocol"), { max: MAX_PROTOCOL })
          : null,
      sourceIp:
        sourceIp && !isValidIpv4(sourceIp)
          ? t(key("invalidIp"), {
              field: t("tools.ipv4Fragmentation.sourceIp"),
            })
          : null,
      destinationIp:
        destinationIp && !isValidIpv4(destinationIp)
          ? t(key("invalidIp"), {
              field: t("tools.ipv4Fragmentation.destinationIp"),
            })
          : null,
    };
  }, [totalLength, mtu, identification, ttl, protocol, sourceIp, destinationIp, t]);

  const mainErrors = presentErrors([errors.totalLength, errors.mtu]);
  // The table draws none of the optional fields, so they only count — and can
  // only be flagged — on the full simulation.
  const optionalActive = view === "full";
  const optionalErrors = optionalActive
    ? presentErrors([
        errors.identification,
        errors.ttl,
        errors.protocol,
        errors.sourceIp,
        errors.destinationIp,
      ])
    : [];

  // The fields answer every keystroke; the split follows when React has time,
  // so typing a five-digit length never waits on a thousand cards.
  const deferredTotalLength = useDeferredValue(totalLength);
  const deferredMtu = useDeferredValue(mtu);

  const live = useMemo(
    () =>
      split(deferredTotalLength, deferredMtu, {
        identification: optionalActive ? identification : "",
        ttl: optionalActive ? ttl : "",
        protocol: optionalActive ? protocol : "",
        sourceIp: optionalActive ? sourceIp : "",
        destinationIp: optionalActive ? destinationIp : "",
      }),
    [
      deferredTotalLength,
      deferredMtu,
      optionalActive,
      identification,
      ttl,
      protocol,
      sourceIp,
      destinationIp,
    ],
  );

  // While a field is mid-edit or flagged, the last valid split stays on screen
  // dimmed instead of vanishing: the page keeps its height, so editing from the
  // floating fields does not throw the reader back to the top.
  const [lastValid, setLastValid] = useState<FragmentationResult | null>(null);
  const hasInput = deferredTotalLength !== "" || deferredMtu !== "";
  if (live && live !== lastValid) setLastValid(live);
  if (!hasInput && lastValid) setLastValid(null);

  const shown = live ?? (hasInput ? lastValid : null);
  const outdated = shown !== null && live === null;
  const pending = deferredTotalLength !== totalLength || deferredMtu !== mtu;

  function loadExample() {
    const example = EXAMPLES[exampleIndex.current % EXAMPLES.length];
    exampleIndex.current += 1;
    if (!example) return;

    setTotalLength(String(example.totalLength));
    setMtu(String(example.mtu));
    setIdentification(String(example.identification));
    setTtl(String(example.ttl));
    setProtocol(String(example.protocol));
    setSourceIp(example.sourceIp);
    setDestinationIp(example.destinationIp);
  }

  function clearAll() {
    setTotalLength("");
    setMtu("");
    setIdentification("");
    setTtl("");
    setProtocol("");
    setSourceIp("");
    setDestinationIp("");
    exampleIndex.current = 0;
  }

  const isEmpty =
    !totalLength &&
    !mtu &&
    !identification &&
    !ttl &&
    !protocol &&
    !sourceIp &&
    !destinationIp;

  return (
    <div className="mx-auto mt-16 mb-40 flex w-full max-w-5xl flex-col gap-6">
      <IPv4FragmentationActions
        onLoadExample={loadExample}
        onGenerateExercises={() => setExercisesOpen(true)}
        onClear={clearAll}
      />
      <ExerciseGeneratorDialog
        open={exercisesOpen}
        onOpenChange={setExercisesOpen}
        toolTitle={t("tools.ipv4Fragmentation.title")}
        generator={generateFragmentationExercises}
      />

      <Card className="w-full bg-sidebar">
        <CardHeader className="text-center">
          <CardTitle>{t("tools.ipv4Fragmentation.title")}</CardTitle>
          <CardDescription>{t("tools.ipv4Fragmentation.subtitle")}</CardDescription>
          <CardAction>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("tools.ipv4Fragmentation.intro")}
                  />
                }
              >
                <Info />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-left">
                <p>{t("tools.ipv4Fragmentation.intro")}</p>
              </TooltipContent>
            </Tooltip>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center">
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
                    {t("tools.ipv4Fragmentation.actions.clear")}
                  </Button>
                }
              />
              <TooltipContent>
                <Kbd>ESC</Kbd>
              </TooltipContent>
            </Tooltip>
          </div>

          <div
            ref={formRef}
            className="flex flex-wrap items-start justify-center gap-4"
          >
            <Field className="w-44" data-invalid={errors.totalLength !== null}>
              <FieldLabel htmlFor={totalLengthId}>
                {t("tools.ipv4Fragmentation.totalLength")}
              </FieldLabel>
              <TotalLengthInput
                id={totalLengthId}
                value={totalLength}
                onValueChange={setTotalLength}
                invalid={errors.totalLength !== null}
                className="h-10"
                inputClassName="text-lg"
              />
            </Field>

            <Field className="w-44" data-invalid={errors.mtu !== null}>
              <FieldLabel htmlFor={mtuId}>
                {t("tools.ipv4Fragmentation.mtu")}
              </FieldLabel>
              <MtuInput
                id={mtuId}
                value={mtu}
                onValueChange={setMtu}
                invalid={errors.mtu !== null}
                className="h-10"
                inputClassName="text-lg"
              />
            </Field>
          </div>

          <ErrorList errors={mainErrors} />

          <section className="flex flex-col gap-4">
            <Tabs
              value={view}
              onValueChange={(value) => setView(value === "table" ? "table" : "full")}
              className="gap-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="m-0 text-base font-semibold">
                  {t("tools.ipv4Fragmentation.results")}
                </h3>
                <TabsList aria-label={t("tools.ipv4Fragmentation.views.label")}>
                  <TabsTrigger value="full">
                    <LayoutList />
                    {t("tools.ipv4Fragmentation.views.full")}
                  </TabsTrigger>
                  <TabsTrigger value="table">
                    <Table2 />
                    {t("tools.ipv4Fragmentation.views.table")}
                  </TabsTrigger>
                </TabsList>
              </div>

              {view === "full" && (
                <Collapsible
                  // A mistake inside the section must never hide behind its fold.
                  open={optionalOpen || optionalErrors.length > 0}
                  onOpenChange={setOptionalOpen}
                  className="overflow-hidden rounded-lg border bg-background"
                >
                  <CollapsibleTrigger
                    render={
                      <Button
                        variant="ghost"
                        className="w-full justify-start rounded-none px-3"
                      >
                        {t("tools.ipv4Fragmentation.optional")}
                        <ChevronDown className="ml-auto transition-transform group-data-panel-open/button:rotate-180" />
                      </Button>
                    }
                  />
                  <CollapsibleContent>
                    <div className="flex flex-col gap-4 border-t p-3">
                      <div className="flex flex-wrap items-start justify-center gap-4">
                        <Field
                          className="w-36"
                          data-invalid={errors.identification !== null}
                        >
                          <FieldLabel htmlFor={identificationId}>
                            {t("tools.ipv4Fragmentation.identification")}
                          </FieldLabel>
                          <NumberInput
                            id={identificationId}
                            min={0}
                            max={MAX_IDENTIFICATION}
                            placeholder={String(DEFAULT_IDENTIFICATION)}
                            value={identification}
                            onValueChange={setIdentification}
                            aria-invalid={errors.identification !== null}
                            className="h-10"
                            inputClassName="text-center font-mono text-lg text-quaternary-ink"
                          />
                        </Field>
                        <Field className="w-28" data-invalid={errors.ttl !== null}>
                          <FieldLabel htmlFor={ttlId}>
                            {t("tools.ipv4Fragmentation.fields.ttl")}
                          </FieldLabel>
                          <NumberInput
                            id={ttlId}
                            min={0}
                            max={MAX_TTL}
                            placeholder={String(DEFAULT_TTL)}
                            value={ttl}
                            onValueChange={setTtl}
                            aria-invalid={errors.ttl !== null}
                            className="h-10"
                            inputClassName="text-center font-mono text-lg text-quaternary-ink"
                          />
                        </Field>
                        <Field className="w-28" data-invalid={errors.protocol !== null}>
                          <FieldLabel htmlFor={protocolId}>
                            {t("tools.ipv4Fragmentation.fields.protocol")}
                          </FieldLabel>
                          <NumberInput
                            id={protocolId}
                            min={0}
                            max={MAX_PROTOCOL}
                            placeholder={String(DEFAULT_PROTOCOL)}
                            value={protocol}
                            onValueChange={setProtocol}
                            aria-invalid={errors.protocol !== null}
                            className="h-10"
                            inputClassName="text-center font-mono text-lg text-quaternary-ink"
                          />
                        </Field>
                        <IpField
                          id={sourceIpId}
                          label={t("tools.ipv4Fragmentation.sourceIp")}
                          placeholder={DEFAULT_SOURCE_IP}
                          value={sourceIp}
                          onValueChange={setSourceIp}
                          invalid={errors.sourceIp !== null}
                        />
                        <IpField
                          id={destinationIpId}
                          label={t("tools.ipv4Fragmentation.destinationIp")}
                          placeholder={DEFAULT_DESTINATION_IP}
                          value={destinationIp}
                          onValueChange={setDestinationIp}
                          invalid={errors.destinationIp !== null}
                        />
                      </div>
                      <ErrorList errors={optionalErrors} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {shown ? (
                <div className="flex flex-col gap-3">
                  {outdated && (
                    <p className="m-0 text-center text-xs text-muted-foreground">
                      {t("tools.ipv4Fragmentation.outdated")}
                    </p>
                  )}
                  <div
                    // A split that no longer matches the fields is shown for
                    // its shape only: dimmed and out of reach.
                    inert={outdated}
                    aria-busy={pending}
                    className={cn(
                      "transition-opacity",
                      outdated ? "opacity-40" : pending && "opacity-70",
                    )}
                  >
                    <TabsContent value="full">
                      <FullResults result={shown} />
                    </TabsContent>
                    <TabsContent value="table">
                      <TableResults result={shown} />
                    </TabsContent>
                  </div>
                </div>
              ) : (
                <EmptyResults />
              )}
            </Tabs>
          </section>
        </CardContent>
      </Card>

      <FloatingControls
        open={formOutOfView}
        totalLength={totalLength}
        mtu={mtu}
        onTotalLengthChange={setTotalLength}
        onMtuChange={setMtu}
        totalLengthInvalid={errors.totalLength !== null}
        mtuInvalid={errors.mtu !== null}
        error={mainErrors[0] ?? optionalErrors[0] ?? null}
      />
    </div>
  );
}

/** The split for the current fields, or `null` while one is empty or flagged. */
function split(
  totalLength: string,
  mtu: string,
  optional: {
    identification: string;
    ttl: string;
    protocol: string;
    sourceIp: string;
    destinationIp: string;
  },
): FragmentationResult | null {
  if (!totalLength || !mtu) return null;
  try {
    return fragment(Number(totalLength), Number(mtu), {
      identification: optional.identification
        ? Number(optional.identification)
        : DEFAULT_IDENTIFICATION,
      ttl: optional.ttl ? Number(optional.ttl) : DEFAULT_TTL,
      protocol: optional.protocol ? Number(optional.protocol) : DEFAULT_PROTOCOL,
      sourceIp: optional.sourceIp || DEFAULT_SOURCE_IP,
      destinationIp: optional.destinationIp || DEFAULT_DESTINATION_IP,
    });
  } catch (cause) {
    // Every rejection is already on screen as the field's own error.
    if (cause instanceof FragmentationError) return null;
    throw cause;
  }
}

/**
 * True once `ref` has scrolled above the viewport. Observed only while this
 * tab is on screen: inactive tabs stay mounted, hidden.
 */
function useScrolledPast(ref: RefObject<HTMLElement | null>): boolean {
  const isActive = useIsTabActive();
  const [past, setPast] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || !isActive) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, isActive]);

  return isActive && past;
}

/**
 * How many of `total` items to mount: one batch, then another each time the
 * sentinel after the last one comes within a screen of the viewport.
 */
function useProgressiveCount(total: number, batch: number) {
  const isActive = useIsTabActive();
  const [count, setCount] = useState(batch);
  const sentinel = useRef<HTMLDivElement>(null);
  const visible = Math.min(count, total);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !isActive || visible >= total) return;
    // Re-created after every batch, so a sentinel still in range fires again.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setCount((current) => current + batch);
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, total, batch, isActive]);

  return {
    visible,
    sentinel,
    showMore: () => setCount((current) => current + batch),
  };
}

function ShowMore({
  sentinel,
  visible,
  total,
  onShowMore,
}: {
  sentinel: RefObject<HTMLDivElement | null>;
  visible: number;
  total: number;
  onShowMore: () => void;
}) {
  const { t } = useTranslation();
  if (visible >= total) return null;
  return (
    <div ref={sentinel} className="flex justify-center">
      <Button type="button" variant="outline" size="sm" onClick={onShowMore}>
        {t("tools.ipv4Fragmentation.showMore", { shown: visible, total })}
      </Button>
    </div>
  );
}

function presentErrors(errors: (string | null)[]): string[] {
  return errors.filter((error): error is string => error !== null);
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div role="alert" className="flex flex-col gap-1">
      {errors.map((error) => (
        <p key={error} className="text-center text-xs text-destructive">
          {error}
        </p>
      ))}
    </div>
  );
}

type ControlledNumber = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  invalid: boolean;
  className?: string;
  inputClassName?: string;
};

function TotalLengthInput({ invalid, inputClassName, ...props }: ControlledNumber) {
  return (
    <NumberInput
      {...props}
      min={MIN_TOTAL_LENGTH}
      max={MAX_TOTAL_LENGTH}
      aria-invalid={invalid}
      inputClassName={cn("text-center font-mono text-primary-ink", inputClassName)}
    />
  );
}

/** Steps by 8, so the arrows only land on usable MTUs from a usable start. */
function MtuInput({ invalid, inputClassName, ...props }: ControlledNumber) {
  return (
    <NumberInput
      {...props}
      min={MIN_MTU}
      max={MAX_MTU}
      step={8}
      aria-invalid={invalid}
      inputClassName={cn("text-center font-mono text-secondary-ink", inputClassName)}
    />
  );
}

function IpField({
  id,
  label,
  placeholder,
  value,
  onValueChange,
  invalid,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  invalid: boolean;
}) {
  return (
    <Field className="w-48" data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="numeric"
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={invalid}
        className="h-10 text-center font-mono text-lg text-tertiary-ink"
      />
    </Field>
  );
}

/**
 * Total Length and MTU again, pinned to the corner once the form scrolls away,
 * so the student can change them and watch the fragments below react. Stays
 * mounted so it can fade out as well as in; closed, it is inert.
 */
function FloatingControls({
  open,
  totalLength,
  mtu,
  onTotalLengthChange,
  onMtuChange,
  totalLengthInvalid,
  mtuInvalid,
  error,
}: {
  open: boolean;
  totalLength: string;
  mtu: string;
  onTotalLengthChange: (value: string) => void;
  onMtuChange: (value: string) => void;
  totalLengthInvalid: boolean;
  mtuInvalid: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const totalLengthId = useId();
  const mtuId = useId();

  return (
    <div
      role="region"
      aria-label={t("tools.ipv4Fragmentation.quickEdit")}
      inert={!open}
      className={cn(
        "fixed right-4 bottom-4 left-4 flex flex-col gap-2 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg sm:left-auto sm:max-w-sm",
        // Fades in moving up, fades out moving down.
        "transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
        open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <div className="flex items-end gap-2">
        <Field className="min-w-0 flex-1 gap-1" data-invalid={totalLengthInvalid}>
          <FieldLabel htmlFor={totalLengthId} className="text-xs">
            {t("tools.ipv4Fragmentation.totalLength")}
          </FieldLabel>
          <TotalLengthInput
            id={totalLengthId}
            value={totalLength}
            onValueChange={onTotalLengthChange}
            invalid={totalLengthInvalid}
          />
        </Field>
        <Field className="min-w-0 flex-1 gap-1" data-invalid={mtuInvalid}>
          <FieldLabel htmlFor={mtuId} className="text-xs">
            {t("tools.ipv4Fragmentation.mtu")}
          </FieldLabel>
          <MtuInput
            id={mtuId}
            value={mtu}
            onValueChange={onMtuChange}
            invalid={mtuInvalid}
          />
        </Field>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("tools.ipv4Fragmentation.backToTop")}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              />
            }
          >
            <ArrowUp />
          </TooltipTrigger>
          <TooltipContent>{t("tools.ipv4Fragmentation.backToTop")}</TooltipContent>
        </Tooltip>
      </div>
      {error && <p className="m-0 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function useFieldLabels(): FieldLabels {
  const { t } = useTranslation();
  return useMemo(
    () =>
      Object.fromEntries(
        HEADER_CELLS.map(({ field }) => [
          field,
          t(`tools.ipv4Fragmentation.fields.${field}`),
        ]),
      ) as FieldLabels,
    [t],
  );
}

/** The no-fragmentation notice, or the line that says how many came out. */
function SplitSummary({ result }: { result: FragmentationResult }) {
  const { t } = useTranslation();

  if (!result.needsFragmentation) {
    return (
      <Alert>
        <CircleCheck className="text-tertiary-ink" />
        <AlertDescription>
          {t("tools.ipv4Fragmentation.noFragmentation", {
            totalLength: result.original.totalLength,
            mtu: result.mtu,
          })}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <p className="m-0 text-center text-xs text-muted-foreground">
      {t("tools.ipv4Fragmentation.fragmentedInto", {
        count: result.fragments.length,
        mtu: result.mtu,
        data: result.maxFragmentData,
      })}
    </p>
  );
}

/** Every header drawn whole, as a card: the original, then each fragment. */
function FullResults({ result }: { result: FragmentationResult }) {
  const { t } = useTranslation();
  const labels = useFieldLabels();
  const { original, fragments, needsFragmentation } = result;
  const total = needsFragmentation ? fragments.length : 0;
  const { visible, sentinel, showMore } = useProgressiveCount(total, CARD_BATCH);

  const originalCard = (
    <HeaderCard
      title={t("tools.ipv4Fragmentation.originalTitle")}
      description={t("tools.ipv4Fragmentation.originalDescription", {
        data: result.dataBytes,
      })}
      header={original}
      dataStart={0}
      labels={labels}
    />
  );

  if (!needsFragmentation) {
    return (
      <div className="flex flex-col gap-4">
        <SplitSummary result={result} />
        {originalCard}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {originalCard}

      <div className="flex flex-col items-center gap-1">
        <ArrowDown aria-hidden className="size-8 text-primary-ink" />
        <SplitSummary result={result} />
      </div>

      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {fragments.slice(0, visible).map((item, index) => (
          <li
            key={index}
            // Off-screen cards skip layout and paint until scrolled to.
            className="m-0 [contain-intrinsic-size:auto_22rem] [content-visibility:auto]"
          >
            <FragmentCard
              fragment={item}
              index={index}
              total={fragments.length}
              labels={labels}
            />
          </li>
        ))}
      </ol>
      <ShowMore
        sentinel={sentinel}
        visible={visible}
        total={total}
        onShowMore={showMore}
      />
    </div>
  );
}

function FragmentCard({
  fragment: item,
  index,
  total,
  labels,
}: {
  fragment: IpFragment;
  index: number;
  total: number;
  labels: FieldLabels;
}) {
  const { t } = useTranslation();
  return (
    <HeaderCard
      title={t("tools.ipv4Fragmentation.fragmentTitle", {
        index: index + 1,
        total,
      })}
      description={t("tools.ipv4Fragmentation.fragmentDescription", {
        data: item.dataBytes,
        from: item.dataStart,
        to: item.dataStart + item.dataBytes - 1,
      })}
      header={item.header}
      dataStart={item.dataStart}
      labels={labels}
      highlight
    />
  );
}

type HeaderCardProps = {
  title: string;
  description: string;
  header: Ipv4Header;
  /** Byte position the offset stands for, shown next to it. */
  dataStart: number;
  labels: FieldLabels;
  /** Marks the fields fragmentation rewrote. */
  highlight?: boolean;
};

function sameHeader(a: Ipv4Header, b: Ipv4Header): boolean {
  return HEADER_CELLS.every(({ field }) => a[field] === b[field]);
}

/**
 * Each split builds new header objects, but most cards keep their values when
 * a field changes (only the last fragment does when Total Length grows), so a
 * card re-renders only when what it draws changed.
 */
const HeaderCard = memo(
  function HeaderCard({
    title,
    description,
    header,
    dataStart,
    labels,
    highlight = false,
  }: HeaderCardProps) {
    return (
      <Card className="w-full bg-background">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <HeaderGrid
            header={header}
            dataStart={dataStart}
            labels={labels}
            highlight={highlight}
          />
        </CardContent>
      </Card>
    );
  },
  (previous, next) =>
    previous.title === next.title &&
    previous.description === next.description &&
    previous.dataStart === next.dataStart &&
    previous.labels === next.labels &&
    previous.highlight === next.highlight &&
    sameHeader(previous.header, next.header),
);

/**
 * The header drawn as RFC 791 draws it: 32 bits per row, each field as wide as
 * its bits. Scrolls sideways on a phone instead of squeezing the one-bit flags
 * out of sight.
 */
function HeaderGrid({
  header,
  dataStart,
  labels,
  highlight,
}: {
  header: Ipv4Header;
  dataStart: number;
  labels: FieldLabels;
  highlight: boolean;
}) {
  const { t } = useTranslation();

  function display(field: FieldKey): string {
    if (field === "fragmentOffset" && header.fragmentOffset !== 0) {
      return t("tools.ipv4Fragmentation.offsetValue", {
        blocks: header.fragmentOffset,
        bytes: dataStart,
      });
    }
    return String(header[field]);
  }

  return (
    <div className="overflow-x-auto">
      {/* The gap shows the border colour through: one hairline per edge. */}
      <div className="grid min-w-[46rem] grid-cols-32 gap-px overflow-hidden rounded-md border bg-border">
        {BIT_RULER}
        {HEADER_CELLS.map(({ field, bits }) => {
          const changed = highlight && FRAGMENT_FIELDS.has(field);
          return (
            <div
              key={field}
              title={labels[field]}
              style={{ gridColumn: `span ${bits} / span ${bits}` }}
              className="min-w-0 bg-card"
            >
              <div
                className={cn(
                  "flex size-full flex-col items-center justify-center gap-1 px-1 py-2.5 text-center",
                  changed && "bg-primary/10",
                )}
              >
                <span className="w-full truncate text-xs leading-tight text-muted-foreground">
                  {labels[field]}
                </span>
                <span
                  className={cn(
                    "font-mono text-base",
                    changed && "font-semibold text-primary-ink",
                  )}
                >
                  {display(field)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Highlighted columns of the table view: what fragmentation decides, plus DF.
 * The data column (Total Length − 20) sits right after Total Length.
 */
const TABLE_FIELDS = ["totalLength", "df", "mf", "fragmentOffset"] as const;

const HIGHLIGHT_CELL = "bg-primary/10 text-center font-semibold text-primary-ink";

/** One row per fragment with just the fields that tell them apart. */
function TableResults({ result }: { result: FragmentationResult }) {
  const { t } = useTranslation();
  const labels = useFieldLabels();
  const { original, fragments, needsFragmentation } = result;
  const total = needsFragmentation ? fragments.length : 0;
  const { visible, sentinel, showMore } = useProgressiveCount(total, ROW_BATCH);

  return (
    <div className="flex flex-col gap-4">
      <SplitSummary result={result} />

      <div className="overflow-hidden rounded-lg border bg-background">
        <Table className="m-0 font-mono">
          <TableHeader>
            <TableRow>
              <TableHead className="text-center font-sans">
                {t("tools.ipv4Fragmentation.table.fragment")}
              </TableHead>
              {TABLE_FIELDS.map((field) => (
                <Fragment key={field}>
                  <TableHead className={cn(HIGHLIGHT_CELL, "font-sans")}>
                    {labels[field]}
                  </TableHead>
                  {field === "totalLength" && (
                    <TableHead className="text-center font-sans">
                      {t("tools.ipv4Fragmentation.table.data")}
                    </TableHead>
                  )}
                </Fragment>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <SummaryRow
              label={t("tools.ipv4Fragmentation.table.original")}
              totalLength={original.totalLength}
              dataBytes={result.dataBytes}
              df={original.df}
              mf={original.mf}
              fragmentOffset={original.fragmentOffset}
              dataStart={0}
              muted={needsFragmentation}
            />
            {fragments.slice(0, visible).map(({ header, dataBytes, dataStart }, index) => (
              <SummaryRow
                key={index}
                label={String(index + 1)}
                totalLength={header.totalLength}
                dataBytes={dataBytes}
                df={header.df}
                mf={header.mf}
                fragmentOffset={header.fragmentOffset}
                dataStart={dataStart}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <ShowMore
        sentinel={sentinel}
        visible={visible}
        total={total}
        onShowMore={showMore}
      />
      <DataSumVerification result={result} />
    </div>
  );
}

/**
 * Closes the table with the check a student would do by hand: the data column
 * summed, plus one header, gives back the original Total Length. Runs of equal
 * sizes are written as a product so a thousand-fragment split stays one line.
 */
function DataSumVerification({ result }: { result: FragmentationResult }) {
  const { t } = useTranslation();
  const { terms, sum, total, matches } = useMemo(
    () => checkDataSum(result),
    [result],
  );
  const expression = terms
    .map(({ bytes, count }) => (count > 1 ? `${bytes} × ${count}` : String(bytes)))
    .join(" + ");
  const original = result.original.totalLength;

  return (
    <Alert variant={matches ? "default" : "destructive"}>
      {matches ? <CircleCheck className="text-tertiary-ink" /> : <CircleX />}
      <AlertTitle>{t("tools.ipv4Fragmentation.verification.title")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-1">
        <span className="font-mono">
          {t("tools.ipv4Fragmentation.verification.sum", { expression, sum })}
        </span>
        <span className="font-mono">
          {t("tools.ipv4Fragmentation.verification.total", { sum, total })}
        </span>
        <span>
          {t(
            matches
              ? "tools.ipv4Fragmentation.verification.matches"
              : "tools.ipv4Fragmentation.verification.mismatch",
            { original },
          )}
        </span>
      </AlertDescription>
    </Alert>
  );
}

/** Primitive props only, so `memo` skips every row whose values held. */
const SummaryRow = memo(function SummaryRow({
  label,
  totalLength,
  dataBytes,
  df,
  mf,
  fragmentOffset,
  dataStart,
  muted = false,
}: {
  label: string;
  totalLength: number;
  /** Total Length minus the 20-byte header. */
  dataBytes: number;
  df: number;
  mf: number;
  fragmentOffset: number;
  dataStart: number;
  /** The original row, set apart from the fragments below it. */
  muted?: boolean;
}) {
  const { t } = useTranslation();
  const cells: Record<(typeof TABLE_FIELDS)[number], ReactNode> = {
    totalLength,
    df,
    mf,
    fragmentOffset:
      fragmentOffset === 0
        ? 0
        : t("tools.ipv4Fragmentation.offsetValue", {
            blocks: fragmentOffset,
            bytes: dataStart,
          }),
  };

  return (
    <TableRow className={cn(muted && "text-muted-foreground")}>
      <TableCell className="text-center font-sans font-medium">{label}</TableCell>
      {TABLE_FIELDS.map((field) => (
        <Fragment key={field}>
          <TableCell
            className={cn(HIGHLIGHT_CELL, muted && "bg-transparent font-normal text-muted-foreground")}
          >
            {cells[field]}
          </TableCell>
          {field === "totalLength" && (
            <TableCell className="text-center">{dataBytes}</TableCell>
          )}
        </Fragment>
      ))}
    </TableRow>
  );
});

/** The shape of the answer, before there is an answer to put in it. */
function EmptyResults() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1 rounded-lg border bg-background p-3">
        {HEADER_LAYOUT.map((row) => (
          <Skeleton key={row[0]?.field} className="h-10 w-full" />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {t("tools.ipv4Fragmentation.noData")}
      </p>
    </div>
  );
}
