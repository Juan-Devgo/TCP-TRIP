import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, CircleCheck, CircleX, Info, Trash2 } from "lucide-react";
import type { PaginationState } from "@tanstack/react-table";

import { ExerciseGeneratorDialog } from "@/components/common/ExerciseGeneratorDialog";
import { IPv4CalculatorActions } from "@/features/ipv4-calculator/components/IPv4CalculatorActions";
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
import { DataTable, dataTableColumns } from "@/components/ui/data-table";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { generateIpv4Exercises } from "@/features/ipv4-calculator/exercises/ipv4Exercises";
import {
  calculateIpv4,
  IP_CLASS_RANGES,
  Ipv4Error,
  isValidIpv4,
  isValidMask,
  isValidSubmask,
  type Ipv4Result,
} from "@/features/ipv4-calculator/lib/ipv4";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";

/** Cycled by the example action, so a student always has something to read. */
const EXAMPLES: { ip: string; mask: number; submask: number }[] = [
  { ip: "10.25.30.1", mask: 8, submask: 5 },
  { ip: "172.16.50.10", mask: 16, submask: 4 },
  { ip: "192.168.1.100", mask: 24, submask: 3 },
  { ip: "196.18.137.1", mask: 18, submask: 4 },
  { ip: "224.0.0.5", mask: 27, submask: 3 },
  { ip: "240.0.0.1", mask: 29, submask: 2 },
];

/** Powers of two, so the page size reads like the subnetting itself. */
const SUBNET_PAGE_SIZES = [8, 16, 32];
const SUBNETS_PER_PAGE = SUBNET_PAGE_SIZES[0]!;

export function IPv4Calculator() {
  const { t } = useTranslation();
  const ipId = useId();
  const maskId = useId();
  const submaskId = useId();
  const subnetModeId = useId();
  const exampleIndex = useRef(0);

  const [ip, setIp] = useState("");
  /** The prefix while subnetting is off. */
  const [mask, setMask] = useState("");
  /** The prefix while subnetting is on, so toggling never loses either value. */
  const [dualMask, setDualMask] = useState("");
  const [submask, setSubmask] = useState("");
  const [subnetMode, setSubnetMode] = useState(false);
  const [exercisesOpen, setExercisesOpen] = useState(false);
  const [page, setPage] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: SUBNETS_PER_PAGE,
  });

  const effectiveMask = subnetMode ? dualMask : mask;

  const { result, error } = useMemo<{
    result: Ipv4Result | null;
    error: string | null;
  }>(() => {
    // An empty field is not a mistake yet — it is a form still being filled in.
    if (!ip) return { result: null, error: null };
    if (!isValidIpv4(ip)) {
      return { result: null, error: t("tools.ipv4Calculator.errors.invalidIp") };
    }
    if (!effectiveMask) return { result: null, error: null };

    const prefix = Number(effectiveMask);
    if (!isValidMask(prefix)) {
      return {
        result: null,
        error: t("tools.ipv4Calculator.errors.invalidMask"),
      };
    }

    let added: number | undefined;
    if (subnetMode) {
      if (!submask) return { result: null, error: null };
      added = Number(submask);
      if (!isValidSubmask(added, prefix)) {
        return {
          result: null,
          error: t("tools.ipv4Calculator.errors.invalidSubmask", {
            max: 32 - prefix,
          }),
        };
      }
    }

    try {
      return { result: calculateIpv4(ip, prefix, added), error: null };
    } catch (cause) {
      return {
        result: null,
        error:
          cause instanceof Ipv4Error
            ? t(`tools.ipv4Calculator.errors.${cause.code}`, {
                max: cause.detail,
              })
            : t("tools.ipv4Calculator.errors.generic"),
      };
    }
  }, [ip, effectiveMask, submask, subnetMode, t]);

  const subnets = result?.subnets ?? null;

  // A new split invalidates the page the reader was on.
  useEffect(() => {
    setPage((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    );
  }, [subnets]);

  function toggleSubnetMode(next: boolean) {
    setSubnetMode(next);
    // Carry the prefix across so the reading stays put while the split appears.
    if (next) setDualMask(mask);
    else setMask(dualMask);
  }

  function loadExample() {
    const example = EXAMPLES[exampleIndex.current % EXAMPLES.length];
    exampleIndex.current += 1;
    if (!example) return;

    setIp(example.ip);
    setDualMask(String(example.mask));
    setSubmask(subnetMode ? String(example.submask) : "");
    // Off, the two fields collapse into one prefix — the same network.
    setMask(String(subnetMode ? example.mask + example.submask : example.mask));
  }

  function clearAll() {
    setIp("");
    setMask("");
    setDualMask("");
    setSubmask("");
    setSubnetMode(false);
    exampleIndex.current = 0;
  }

  return (
    <div className="flex w-full flex-col gap-6 mt-16">
      <IPv4CalculatorActions
        onLoadExample={loadExample}
        onGenerateExercises={() => setExercisesOpen(true)}
        onClear={clearAll}
      />
      <ExerciseGeneratorDialog
        open={exercisesOpen}
        onOpenChange={setExercisesOpen}
        toolTitle={t("tools.ipv4Calculator.title")}
        generator={generateIpv4Exercises}
      />

      <Card className="w-full bg-sidebar">
      <CardHeader className="text-center">
        <CardTitle>{t("tools.ipv4Calculator.title")}</CardTitle>
        <CardDescription>{t("tools.ipv4Calculator.subtitle")}</CardDescription>
        <CardAction>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("tools.ipv4Calculator.intro")}
                />
              }
            >
              <Info />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-left">
              <p>{t("tools.ipv4Calculator.intro")}</p>
            </TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">

        <div className="flex justify-between items-center">
          <Tooltip>
            <TooltipTrigger render={
              <Button
                type="button"
                variant="destructive"
                onClick={clearAll}
                disabled={!ip && !mask && !submask}
              >
                <Trash2 />
                {t("tools.ipv4Calculator.actions.clear")}
              </Button>
            } />
          <TooltipContent><Kbd>ESC</Kbd></TooltipContent>
          </Tooltip>

        <div>
          <Field orientation="horizontal">
            <FieldLabel htmlFor={subnetModeId}>
              {t("tools.ipv4Calculator.enableSubnets")}
            </FieldLabel>
            <Switch
              id={subnetModeId}
              checked={subnetMode}
              onCheckedChange={toggleSubnetMode}
            />
          </Field>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-center gap-2">
          <Field className="w-64">
            <FieldLabel htmlFor={ipId}>
              {t("tools.ipv4Calculator.ipAddress")}
            </FieldLabel>
            <Input
              id={ipId}
              inputMode="numeric"
              spellCheck={false}
              autoComplete="off"
              placeholder={t("tools.ipv4Calculator.ipPlaceholder")}
              value={ip}
              onChange={(event) => setIp(event.target.value)}
              aria-invalid={ip !== "" && !isValidIpv4(ip)}
              className="h-10 text-center font-mono text-lg text-tertiary-ink"
            />
          </Field>

          <Separator>/</Separator>

          {subnetMode ? (
            <>
              <Separator>(</Separator>
              <PrefixField
                id={maskId}
                label={t("tools.ipv4Calculator.mask")}
                value={dualMask}
                onValueChange={setDualMask}
                max={32}
                inkClassName="text-secondary-ink"
              />
              <Separator>+</Separator>
              <PrefixField
                id={submaskId}
                label={t("tools.ipv4Calculator.submask")}
                value={submask}
                onValueChange={setSubmask}
                max={Math.max(1, 32 - (Number(dualMask) || 0))}
                inkClassName="text-quaternary-ink"
              />
              <Separator>)</Separator>
            </>
          ) : (
            <PrefixField
              id={maskId}
              label={t("tools.ipv4Calculator.mask")}
              value={mask}
              onValueChange={setMask}
              max={32}
              inkClassName="text-secondary-ink"
            />
          )}
        </div>

        {error && (
          <p role="alert" className="text-center text-xs text-destructive">
            {error}
          </p>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">
            {t("tools.ipv4Calculator.results")}
          </h3>
          {result ? (
            <ResultPanel result={result} />
          ) : (
            <SkeletonPanel subnetMode={subnetMode} />
          )}
        </section>

      </CardContent>
      </Card>

      {subnets && subnets.length > 0 && result && (
        <SubnetsSection
          result={result}
          subnets={subnets}
          page={page}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

/** The `/`, `(`, `+`, `)` glyphs that make the mask read like CIDR notation. */
function Separator({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pb-2 font-mono text-2xl font-bold text-muted-foreground select-none"
    >
      {children}
    </span>
  );
}

function PrefixField({
  id,
  label,
  value,
  onValueChange,
  max,
  inkClassName,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  max: number;
  /** Brand ink for the readout, matching the row this field feeds. */
  inkClassName: string;
}) {
  return (
    <Field className="w-28">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NumberInput
        id={id}
        min={0}
        max={max}
        value={value}
        onValueChange={onValueChange}
        className="h-10"
        inputClassName={cn("text-center font-mono text-lg", inkClassName)}
      />
    </Field>
  );
}

/** One label/value line of a readout. */
type Row = {
  label: string;
  value: React.ReactNode;
  /** Brand ink for the value cell. */
  ink?: string;
  /** Long values (reverse DNS, IPv6) that need to shrink rather than overflow. */
  small?: boolean;
};

function ReadoutTable({ rows }: { rows: Row[] }) {
  return (
    <Table>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label} className="hover:bg-transparent">
            <TableCell className="w-1/3 px-3 font-medium text-muted-foreground">
              {row.label}
            </TableCell>
            <TableCell
              className={cn(
                "px-3 font-mono whitespace-normal",
                row.small && "text-xs",
                row.ink,
              )}
            >
              {row.value}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Why an address is not assignable, shown inline next to the value. */
function InlineNote({ message }: { message: string }) {
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-xs text-destructive italic">
      <CircleX className="size-3.5 shrink-0" />
      {message}
    </span>
  );
}

/**
 * The rows shared by the whole-network readout and every subnet card. The two
 * differ only in which addresses are called out as unusable, which is what
 * `firstSubnet`/`lastSubnet` say.
 */
function useReadoutRows(
  result: Ipv4Result,
  { firstSubnet = false, lastSubnet = false } = {},
): { main: Row[]; details: Row[] } {
  const { t } = useTranslation();
  const key = (name: string) => t(`tools.ipv4Calculator.fields.${name}`);
  const hostInk = result.hasHosts ? "text-tertiary-ink" : "text-destructive";

  const main: Row[] = [];
  // Only worth a row when it differs from the network address it resolves to.
  if (result.ipAddress !== result.networkAddress) {
    main.push({
      label: key("ipAddress"),
      value: result.ipAddress,
      ink: "text-tertiary-ink",
    });
  }
  main.push({
    label: key("netMask"),
    value: result.netMask,
    ink: "text-secondary-ink",
  });
  if (result.subMask && result.fullMask) {
    main.push(
      {
        label: key("subMask"),
        value: result.subMask,
        ink: "text-quaternary-ink",
      },
      {
        label: key("fullMask"),
        value: `${result.fullMask} (/${result.prefix})`,
        ink: "text-quaternary-ink",
      },
    );
  }
  main.push(
    {
      label: key("networkAddress"),
      value: (
        <>
          {result.networkAddress}
          {firstSubnet && (
            <InlineNote message={t("tools.ipv4Calculator.firstSubnetReason")} />
          )}
        </>
      ),
      ink: firstSubnet ? "text-destructive" : "text-primary-ink",
    },
    {
      label: key("broadcastAddress"),
      value: (
        <>
          {result.broadcastAddress}
          {lastSubnet && (
            <InlineNote message={t("tools.ipv4Calculator.lastSubnetReason")} />
          )}
        </>
      ),
      ink: lastSubnet ? "text-destructive" : "text-primary-ink",
    },
    {
      label: key("ipClass"),
      value: `${result.ipClass} (${IP_CLASS_RANGES[result.ipClass]})`,
    },
  );
  if (result.hasHosts) {
    main.push({
      label: key("ipRange"),
      value: `${result.firstHost} — ${result.lastHost}`,
      ink: "text-tertiary-ink",
    });
  }

  const invalidRange = result.hasHosts ? null : (
    <InlineNote message={t("tools.ipv4Calculator.invalidHostRange")} />
  );

  const details: Row[] = [
    {
      label: key("firstHost"),
      value: (
        <>
          {result.firstHost}
          {invalidRange}
        </>
      ),
      ink: hostInk,
    },
    {
      label: key("lastHost"),
      value: (
        <>
          {result.lastHost}
          {invalidRange}
        </>
      ),
      ink: hostInk,
    },
    {
      label: key("totalHosts"),
      value: result.totalHosts.toLocaleString(),
      ink: "text-primary-ink",
    },
    {
      label: key("wildcardMask"),
      value: result.wildcardMask,
      ink: "text-secondary-ink",
    },
    { label: key("inAddrArpa"), value: result.inAddrArpa, small: true },
    { label: key("ipv6Mapped"), value: result.ipv6Mapped, small: true },
  ];

  return { main, details };
}

function ResultPanel({ result }: { result: Ipv4Result }) {
  const { t } = useTranslation();
  const { main, details } = useReadoutRows(result);

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <ReadoutTable rows={main} />
      <DetailsCollapsible rows={details} />
    </div>
  );
}

/** The "show details" panel, shared by the network readout and every subnet. */
function DetailsCollapsible({ rows }: { rows: Row[] }) {
  const { t } = useTranslation();

  return (
    <Collapsible className="border-t">
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            className="w-full justify-start rounded-none px-3"
          >
            {t("tools.ipv4Calculator.showDetails")}
            <ChevronDown className="ml-auto transition-transform group-data-panel-open/button:rotate-180" />
          </Button>
        }
      />
      <CollapsibleContent>
        <ReadoutTable rows={rows} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The shape of the answer, before there is an answer to put in it. */
function SkeletonPanel({ subnetMode }: { subnetMode: boolean }) {
  const { t } = useTranslation();
  const key = (name: string) => t(`tools.ipv4Calculator.fields.${name}`);

  const rows: Row[] = [
    { label: key("ipAddress"), value: <Skeleton className="h-4 w-3/4" /> },
    { label: key("netMask"), value: <Skeleton className="h-4 w-3/4" /> },
    ...(subnetMode
      ? [
          { label: key("subMask"), value: <Skeleton className="h-4 w-3/4" /> },
          { label: key("fullMask"), value: <Skeleton className="h-4 w-3/4" /> },
        ]
      : []),
    { label: key("networkAddress"), value: <Skeleton className="h-4 w-3/4" /> },
    {
      label: key("broadcastAddress"),
      value: <Skeleton className="h-4 w-3/4" />,
    },
    { label: key("ipClass"), value: <Skeleton className="h-4 w-3/4" /> },
    { label: key("ipRange"), value: <Skeleton className="h-4 w-3/4" /> },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border bg-background">
        <ReadoutTable rows={rows} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {t("tools.ipv4Calculator.noData")}
      </p>
    </div>
  );
}

/** One row of the subnet summary table. */
type SubnetRow = {
  index: number;
  subnet: Ipv4Result;
  isFirst: boolean;
  isLast: boolean;
  /** Neither subnet zero nor the all-ones subnet, and it has a host range. */
  usable: boolean;
};

const subnetColumn = dataTableColumns<SubnetRow>();

function SubnetsSection({
  result,
  subnets,
  page,
  onPageChange,
}: {
  result: Ipv4Result;
  subnets: Ipv4Result[];
  page: PaginationState;
  onPageChange: (pagination: PaginationState) => void;
}) {
  const { t } = useTranslation();

  const rows = useMemo<SubnetRow[]>(
    () =>
      subnets.map((subnet, index) => {
        const isFirst = index === 0;
        const isLast = index === subnets.length - 1;
        return {
          index,
          subnet,
          isFirst,
          isLast,
          usable: !isFirst && !isLast && subnet.hasHosts,
        };
      }),
    [subnets],
  );

  const columns = useMemo(
    () =>
      subnetColumn.columns([
        subnetColumn.display({
          id: "index",
          header: "#",
          cell: ({ row }) => (
            <span className="font-mono">{row.original.index}</span>
          ),
        }),
        subnetColumn.display({
          id: "network",
          header: t("tools.ipv4Calculator.fields.networkAddress"),
          cell: ({ row }) => (
            <span
              className={cn(
                "font-mono",
                row.original.isFirst ? "text-destructive" : "text-primary-ink",
              )}
            >
              {row.original.subnet.networkAddress}
            </span>
          ),
        }),
        subnetColumn.display({
          id: "range",
          header: t("tools.ipv4Calculator.fields.ipRange"),
          cell: ({ row }) => (
            <span
              className={cn(
                "font-mono text-xs",
                row.original.usable ? "text-tertiary-ink" : "text-destructive",
              )}
            >
              {row.original.subnet.firstHost} — {row.original.subnet.lastHost}
            </span>
          ),
        }),
        subnetColumn.display({
          id: "broadcast",
          header: t("tools.ipv4Calculator.fields.broadcastAddress"),
          cell: ({ row }) => (
            <span
              className={cn(
                "font-mono",
                row.original.isLast ? "text-destructive" : "text-primary-ink",
              )}
            >
              {row.original.subnet.broadcastAddress}
            </span>
          ),
        }),
        subnetColumn.display({
          id: "usable",
          header: t("tools.ipv4Calculator.usable"),
          cell: ({ row }) => <UsableMark usable={row.original.usable} />,
        }),
      ]),
    [t],
  );

  return (
    // Wider than the reading column: the split is a table, not prose. Only
    // past `xl` is there room to break out without pushing the page sideways.
    <Card className="w-full bg-sidebar xl:-mx-16 xl:w-[calc(100%+8rem)] mb-16">
      <CardHeader>
        <CardTitle>
          {t("tools.ipv4Calculator.subnetsTitle", {
            count: result.totalSubnets ?? subnets.length,
          })}
        </CardTitle>
        {result.subnetsTruncated && (
          <CardDescription>
            {t("tools.ipv4Calculator.subnetsTruncated", {
              listed: subnets.length,
              total: (result.totalSubnets ?? subnets.length).toLocaleString(),
            })}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent>
        <DataTable
          columns={columns}
          data={rows}
          className="bg-background"
          pagination={page}
          onPaginationChange={onPageChange}
          pageSizeOptions={SUBNET_PAGE_SIZES}
          expandedContent={(row) => <SubnetDetails row={row} />}
        />
      </CardContent>
    </Card>
  );
}

function UsableMark({ usable }: { usable: boolean }) {
  const { t } = useTranslation();
  const label = t(`tools.ipv4Calculator.${usable ? "usableYes" : "usableNo"}`);

  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center",
        usable ? "text-tertiary-ink" : "text-destructive",
      )}
    >
      {usable ? (
        <CircleCheck className="size-4" />
      ) : (
        <CircleX className="size-4" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * What the summary row leaves out, opened underneath it: the mask and class
 * the row is derived from, the host range spelled out end to end, and the
 * notations a student has to hand in (wildcard, reverse DNS, IPv6-mapped).
 */
function SubnetDetails({ row }: { row: SubnetRow }) {
  const { t } = useTranslation();
  const key = (name: string) => t(`tools.ipv4Calculator.fields.${name}`);
  const { subnet } = row;

  const hostInk = subnet.hasHosts ? "text-tertiary-ink" : "text-destructive";
  const invalidRange = subnet.hasHosts ? null : (
    <InlineNote message={t("tools.ipv4Calculator.invalidHostRange")} />
  );
  const reason = row.isFirst
    ? t("tools.ipv4Calculator.firstSubnetReason")
    : row.isLast
      ? t("tools.ipv4Calculator.lastSubnetReason")
      : null;

  const rows: Row[] = [
    {
      label: key("netMask"),
      value: `${subnet.netMask} (/${subnet.prefix})`,
      ink: "text-secondary-ink",
    },
    {
      label: key("ipClass"),
      value: `${subnet.ipClass} (${IP_CLASS_RANGES[subnet.ipClass]})`,
    },
    {
      label: key("firstHost"),
      value: (
        <>
          {subnet.firstHost}
          {invalidRange}
        </>
      ),
      ink: hostInk,
    },
    {
      label: key("lastHost"),
      value: (
        <>
          {subnet.lastHost}
          {invalidRange}
        </>
      ),
      ink: hostInk,
    },
    {
      label: key("totalHosts"),
      value: subnet.totalHosts.toLocaleString(),
      ink: "text-primary-ink",
    },
    {
      label: key("wildcardMask"),
      value: subnet.wildcardMask,
      ink: "text-secondary-ink",
    },
    { label: key("inAddrArpa"), value: subnet.inAddrArpa, small: true },
    { label: key("ipv6Mapped"), value: subnet.ipv6Mapped, small: true },
  ];

  return (
    <div className="border-t px-3 py-2">
      <p className="flex flex-wrap items-center gap-2 pb-1">
        <span className="font-medium">
          {t("tools.ipv4Calculator.subnetLabel", { index: row.index })}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {subnet.networkAddress}/{subnet.prefix}
        </span>
        {reason && (
          <span className="text-xs text-destructive italic">— {reason}</span>
        )}
      </p>
      <ReadoutTable rows={rows} />
    </div>
  );
}
