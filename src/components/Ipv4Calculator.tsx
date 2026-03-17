import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import calculateIpv4 from '../lib/functions/ipv4Calculator';
import { translations, type Language, defaultLang } from '../i18n/translations';

// ─── Types ───────────────────────────────────────────────────────────────────

type CalcResult = ReturnType<typeof calculateIpv4>;

interface TableRow {
  cells: { content?: React.ReactNode; color?: string; className?: string }[];
  bg?: string;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function isValidIp(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return !isNaN(n) && n >= 0 && n <= 255 && p === String(n);
  });
}

function isValidMask(mask: string): boolean {
  if (!mask) return false;
  const n = Number(mask);
  return !isNaN(n) && Number.isInteger(n) && n >= 0 && n <= 32;
}

function isValidSubmask(submask: string, mask: number): boolean {
  if (!submask) return false;
  const n = Number(submask);
  return !isNaN(n) && Number.isInteger(n) && n >= 1 && n <= 32 - mask;
}

function ipToNum(ip: string): number {
  const p = ip.split('.').map(Number);
  return ((p[0]! << 24) | (p[1]! << 16) | (p[2]! << 8) | p[3]!) >>> 0;
}

function isHostRangeValid(first: string, last: string): boolean {
  return ipToNum(first) < ipToNum(last);
}

function getIpClassRange(cls: string): string {
  const map: Record<string, string> = {
    A: '0.0.0.0 - 127.255.255.255',
    B: '128.0.0.0 - 191.255.255.255',
    C: '192.0.0.0 - 223.255.255.255',
    D: '224.0.0.0 - 239.255.255.255',
    E: '240.0.0.0 - 255.255.255.255',
  };
  return map[cls] ?? 'Unknown';
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconX({ className = '' }: { className?: string }) {
  return (
    <svg className={`inline align-middle shrink-0 ${className}`} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  );
}

function IconCheck({ className = '' }: { className?: string }) {
  return (
    <svg className={`inline align-middle shrink-0 ${className}`} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

function IconChevron({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
    </svg>
  );
}

// ─── AnimatedDetails ─────────────────────────────────────────────────────────

interface AnimatedDetailsProps {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  summaryClassName?: string;
}

function AnimatedDetails({ summary, children, className = '', summaryClassName = '' }: AnimatedDetailsProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    if (open) {
      const el = contentRef.current;
      if (!el) return;
      el.style.animation = 'detailsHide 0.15s ease-in forwards';
      el.addEventListener('animationend', () => {
        el.style.animation = '';
        setOpen(false);
      }, { once: true });
    } else {
      setOpen(true);
    }
  }, [open]);

  useEffect(() => {
    if (open && contentRef.current) {
      const el = contentRef.current;
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'detailsReveal 0.2s ease-out';
    }
  }, [open]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        className={`flex items-center justify-between w-full text-left ${summaryClassName}`}
      >
        {summary}
        <IconChevron className={`w-4 h-4 text-zinc-500 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={contentRef} className="border-t border-zinc-700">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── DataTable ───────────────────────────────────────────────────────────────

interface DataTableProps {
  rows?: TableRow[];
  headers?: { label: string; className?: string }[];
  bare?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function DataTable({ rows = [], headers, bare = false, className = '', children }: DataTableProps) {
  const tbody = (
    <tbody>
      {rows.map((row, i) => {
        const bg = row.bg ?? (i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-800/50');
        return (
          <tr key={i} className={bg}>
            {row.cells.map((cell, j) => (
              <td
                key={j}
                className={`px-4 py-2 ${j === 0 ? 'text-zinc-400 font-medium w-1/3' : 'font-mono'} ${cell.color ?? ''} ${cell.className ?? ''}`}
              >
                {cell.content}
              </td>
            ))}
          </tr>
        );
      })}
      {children}
    </tbody>
  );

  const table = (
    <table className="w-full text-sm">
      {headers && headers.length > 0 && (
        <thead>
          <tr className="bg-zinc-800 border-b border-zinc-700">
            {headers.map((h, i) => (
              <th key={i} className={`px-4 py-2 text-zinc-400 font-medium text-left ${h.className ?? ''}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
      )}
      {tbody}
    </table>
  );

  if (bare) return table;
  return (
    <div className={`bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden ${className}`}>
      {table}
    </div>
  );
}

// ─── SkeletonPulse ────────────────────────────────────────────────────────────

function SkeletonPulse() {
  return <div className="h-4 bg-zinc-700/50 rounded animate-pulse w-3/4" />;
}

// ─── InlineError ──────────────────────────────────────────────────────────────

function InlineError({ message }: { message: string }) {
  return (
    <>
      <IconX className="w-3.5 h-3.5 ml-1" />
      <span className="text-red-400/70 text-xs ml-1">{message}</span>
    </>
  );
}

// ─── SubnetCard ───────────────────────────────────────────────────────────────

interface SubnetCardProps {
  subnet: CalcResult;
  index: number;
  total: number;
  t: (typeof translations)[Language]['subnet'];
}

function SubnetCard({ subnet, index, total, t }: SubnetCardProps) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const hostValid = isHostRangeValid(subnet.firstHost, subnet.lastHost);
  const isUsable = !isFirst && !isLast && hostValid;

  const hostColor = hostValid ? 'text-emerald-400' : 'text-red-400';
  const netColor  = isFirst   ? 'text-red-400'     : 'text-amber-400';
  const bcastColor = isLast   ? 'text-red-400'     : 'text-amber-400';
  const showIpRow  = subnet.ipAddress !== subnet.networkAddress;

  const reasonText = isFirst  ? t.firstSubnetReason
    : isLast                  ? t.lastSubnetReason
    : !hostValid              ? t.invalidHostRange
    : '';

  // Main rows
  const mainRows: TableRow[] = [];
  if (showIpRow) {
    mainRows.push({ cells: [{ content: 'IP' }, { content: subnet.ipAddress, color: 'text-green-400' }] });
  }
  mainRows.push(
    { cells: [{ content: t.netMaskLabel },          { content: subnet.netMask,          color: 'text-blue-400' }] },
    { cells: [{ content: t.networkAddressLabel },   { content: <>{subnet.networkAddress}{isFirst && <InlineError message={t.firstSubnetReason} />}</>,   color: netColor }] },
    { cells: [{ content: t.broadcastAddressLabel }, { content: <>{subnet.broadcastAddress}{isLast && <InlineError message={t.lastSubnetReason} />}</>, color: bcastColor }] },
    { cells: [{ content: t.classLabel },            { content: `${subnet.class} (${getIpClassRange(subnet.class)})`,            color: 'text-lime-400' }] },
  );
  if (hostValid) {
    mainRows.push({ cells: [{ content: t.ipRangeLabel }, { content: `${subnet.firstHost} — ${subnet.lastHost}`, color: 'text-emerald-400' }] });
  }

  // Detail rows
  const detailRows: TableRow[] = [
    { cells: [{ content: t.firstHostLabel },    { content: hostValid ? subnet.firstHost : <>{subnet.firstHost}<InlineError message={t.invalidHostRange} /></>, color: hostColor }] },
    { cells: [{ content: t.lastHostLabel },     { content: hostValid ? subnet.lastHost  : <>{subnet.lastHost}<InlineError message={t.invalidHostRange} /></>,  color: hostColor }] },
    { cells: [{ content: t.totalHostsLabel },   { content: String(subnet.totalHosts),   color: 'text-orange-400' }] },
    { cells: [{ content: t.wildcardMaskLabel }, { content: subnet.wildcardMask,         color: 'text-blue-400' }] },
    { cells: [{ content: t.inAddrArpaLabel },   { content: subnet.inAddrArpa,           color: 'text-zinc-300', className: 'text-xs' }] },
    { cells: [{ content: t.ipv6MappedLabel },   { content: subnet.ipv6Mapped,           color: 'text-zinc-300', className: 'text-xs' }] },
  ];

  return (
    <AnimatedDetails
      className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden"
      summaryClassName="px-4 py-3 cursor-pointer select-none hover:bg-zinc-800/50 transition-colors"
      summary={
        <div className="flex items-center gap-3 flex-wrap">
          {isUsable ? (
            <span className="bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-700/50 inline-flex items-center">
              <IconCheck className="w-3.5 h-3.5" />
            </span>
          ) : (
            <span className="bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full border border-red-700/50 inline-flex items-center">
              <IconX className="w-3.5 h-3.5" />
            </span>
          )}
          <span className="text-zinc-300 font-medium text-sm">{t.subnetLabel} {index}</span>
          <span className="text-zinc-500 font-mono text-xs">{subnet.networkAddress}</span>
          {reasonText && <span className="text-red-400/80 text-xs italic">— {reasonText}</span>}
        </div>
      }
    >
      <DataTable bare rows={mainRows} />
      <AnimatedDetails
        className="border-t border-zinc-700"
        summaryClassName="px-4 py-3 cursor-pointer select-none hover:bg-zinc-800/50 transition-colors text-zinc-300 text-sm font-medium"
        summary={<span>{t.showDetails}</span>}
      >
        <DataTable bare rows={detailRows} />
      </AnimatedDetails>
    </AnimatedDetails>
  );
}

// ─── Example data ─────────────────────────────────────────────────────────────

const EXAMPLE_IPS    = ['10.25.30.1', '172.16.50.10', '192.168.1.100', '196.18.137.1', '224.0.0.5', '240.0.0.1'];
const EXAMPLE_MASKS  = [8, 16, 18, 24, 27, 29];
const EXAMPLE_SUBS   = [8, 7, 6, 5, 3, 2];

// ─── IpCalculator ─────────────────────────────────────────────────────────────

export default function Ipv4Calculator({ lang }: { lang?: Language }) {
  const t = translations[lang ?? defaultLang].subnet;

  const [ip,          setIp]          = useState('');
  const [maskStr,     setMaskStr]     = useState('');
  const [maskDualStr, setMaskDualStr] = useState('');
  const [submaskStr,  setSubmaskStr]  = useState('');
  const [subnetMode,  setSubnetMode]  = useState(false);
  const [exampleIdx,  setExampleIdx]  = useState(0);

  // ── Derived: calculation result ─────────────────────────────────────────────
  const { result, error } = useMemo<{ result: CalcResult | null; error: string | null }>(() => {
    const effectiveMask = subnetMode ? maskDualStr : maskStr;

    if (!ip)                    return { result: null, error: null };
    if (!isValidIp(ip))         return { result: null, error: t.errInvalidIp };
    if (!effectiveMask)         return { result: null, error: null };
    if (!isValidMask(effectiveMask)) return { result: null, error: t.errInvalidMask };

    const mask = Number(effectiveMask);

    if (subnetMode) {
      if (!submaskStr) return { result: null, error: null };
      if (!isValidSubmask(submaskStr, mask))
        return { result: null, error: t.errInvalidSubmask.replace('{max}', String(32 - mask)) };
    }

    try {
      const submask = subnetMode ? Number(submaskStr) : undefined;
      return { result: calculateIpv4(ip, mask, submask), error: null };
    } catch (e: any) {
      return { result: null, error: e?.message ?? 'Error' };
    }
  }, [ip, maskStr, maskDualStr, submaskStr, subnetMode, t]);

  const hostValid = result ? isHostRangeValid(result.firstHost, result.lastHost) : false;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleExample = () => {
    const i = exampleIdx;
    const exIp   = EXAMPLE_IPS[i]!;
    const exMask = EXAMPLE_MASKS[i]!;
    const exSub  = subnetMode ? EXAMPLE_SUBS[i]! : 0;
    setIp(exIp);
    if (subnetMode) {
      setMaskDualStr(String(exMask));
      setSubmaskStr(String(exSub));
      setMaskStr(String(exMask + exSub));
    } else {
      setMaskStr(String(exMask));
      setMaskDualStr(String(exMask));
      setSubmaskStr('');
    }
    setExampleIdx((i + 1) % EXAMPLE_IPS.length);
  };

  const handleClear = () => {
    setIp(''); setMaskStr(''); setMaskDualStr(''); setSubmaskStr('');
    setSubnetMode(false); setExampleIdx(0);
  };

  const handleSubnetToggle = (checked: boolean) => {
    setSubnetMode(checked);
    if (checked) setMaskDualStr(maskStr);
    else         setMaskStr(maskDualStr);
  };

  // ── Skeleton rows ────────────────────────────────────────────────────────────
  const skeletonMainRows: TableRow[] = [
    { cells: [{ content: t.ipAddressLabel },       { content: <SkeletonPulse /> }] },
    { cells: [{ content: t.netMaskLabel },          { content: <SkeletonPulse /> }] },
    ...(subnetMode ? [
      { cells: [{ content: t.subMaskLabel },  { content: <SkeletonPulse /> }] } as TableRow,
      { cells: [{ content: t.fullMaskLabel }, { content: <SkeletonPulse /> }] } as TableRow,
    ] : []),
    { cells: [{ content: t.networkAddressLabel },   { content: <SkeletonPulse /> }] },
    { cells: [{ content: t.broadcastAddressLabel }, { content: <SkeletonPulse /> }] },
    { cells: [{ content: t.classLabel },            { content: <SkeletonPulse /> }] },
    { cells: [{ content: t.ipRangeLabel },          { content: <SkeletonPulse /> }] },
  ];

  const skeletonDetailRows: TableRow[] = [
    { cells: [{ content: t.firstHostLabel },    { content: <SkeletonPulse /> }] },
    { cells: [{ content: t.lastHostLabel },     { content: <SkeletonPulse /> }] },
    { cells: [{ content: t.totalHostsLabel },   { content: <SkeletonPulse /> }] },
    { cells: [{ content: t.wildcardMaskLabel }, { content: <SkeletonPulse /> }] },
    { cells: [{ content: t.inAddrArpaLabel },   { content: <SkeletonPulse /> }] },
    { cells: [{ content: t.ipv6MappedLabel },   { content: <SkeletonPulse /> }] },
  ];

  // ── Result rows ──────────────────────────────────────────────────────────────
  const mainResultRows: TableRow[] = [];
  const detailResultRows: TableRow[] = [];

  if (result) {
    if (result.ipAddress !== result.networkAddress) {
      mainResultRows.push({ cells: [{ content: t.ipAddressLabel }, { content: result.ipAddress, color: 'text-green-400' }] });
    }
    mainResultRows.push({ cells: [{ content: t.netMaskLabel }, { content: result.netMask, color: 'text-blue-400' }] });
    if (result.subMask !== null) {
      mainResultRows.push(
        { cells: [{ content: t.subMaskLabel },  { content: result.subMask,  color: 'text-violet-400' }] },
        { cells: [{ content: t.fullMaskLabel }, { content: result.fullMask!, color: 'text-purple-500' }] },
      );
    }
    mainResultRows.push(
      { cells: [{ content: t.networkAddressLabel },   { content: result.networkAddress,   color: 'text-amber-400' }] },
      { cells: [{ content: t.broadcastAddressLabel }, { content: result.broadcastAddress, color: 'text-amber-400' }] },
      { cells: [{ content: t.classLabel }, { content: `${result.class} (${getIpClassRange(result.class)})`, color: 'text-lime-400' }] },
    );
    if (hostValid) {
      mainResultRows.push({ cells: [{ content: t.ipRangeLabel }, { content: `${result.firstHost} — ${result.lastHost}`, color: 'text-emerald-400' }] });
    }

    detailResultRows.push(
      { cells: [{ content: t.firstHostLabel }, { content: hostValid ? result.firstHost : <>{result.firstHost}<InlineError message={t.invalidHostRange} /></>, color: hostValid ? 'text-emerald-400' : 'text-red-400' }] },
      { cells: [{ content: t.lastHostLabel },  { content: hostValid ? result.lastHost  : <>{result.lastHost}<InlineError message={t.invalidHostRange} /></>,  color: hostValid ? 'text-emerald-400' : 'text-red-400' }] },
      { cells: [{ content: t.totalHostsLabel },   { content: String(result.totalHosts), color: 'text-orange-400' }] },
      { cells: [{ content: t.wildcardMaskLabel }, { content: result.wildcardMask,       color: 'text-blue-400' }] },
      { cells: [{ content: t.inAddrArpaLabel },   { content: result.inAddrArpa,         color: 'text-zinc-300', className: 'text-xs' }] },
      { cells: [{ content: t.ipv6MappedLabel },   { content: result.ipv6Mapped,         color: 'text-zinc-300', className: 'text-xs' }] },
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <section className="flex justify-center items-center min-h-screen p-4">
      <div className="bg-linear-to-br from-zinc-800 to-zinc-900 rounded-3xl p-6 shadow-2xl w-full max-w-4xl border border-zinc-700/50">

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-white text-xl font-semibold mb-1">{t.title}</h2>
          <p className="text-zinc-500 text-sm">{t.subtitle}</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 bg-red-700/70 hover:bg-red-700 border border-red-600/50 hover:border-red-500 text-red-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer select-none"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t.clearBtn}
              </button>
              <button
                type="button"
                onClick={handleExample}
                className="flex items-center gap-1.5 bg-emerald-700/70 hover:bg-emerald-700 border border-emerald-600/50 hover:border-emerald-500 text-emerald-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer select-none"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t.examplesBtn}
              </button>
            </div>

            {/* Subnet toggle */}
            <div className="flex items-center gap-2">
              <label htmlFor="enable-subnets" className="text-zinc-400 text-sm cursor-pointer select-none">
                {t.enableSubnets}
              </label>
              <label htmlFor="enable-subnets" className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="enable-subnets"
                  className="peer sr-only"
                  checked={subnetMode}
                  onChange={(e) => handleSubnetToggle(e.target.checked)}
                />
                <span className="h-5 w-9 rounded-full bg-zinc-700/90 border border-zinc-600/70 transition-colors duration-200 peer-checked:bg-emerald-600/90 peer-checked:border-emerald-500/80" />
                <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-zinc-300 shadow-sm transition-transform duration-200 peer-checked:translate-x-4 peer-checked:bg-white" />
              </label>
            </div>
          </div>

          {/* IP / Mask inputs */}
          <div className="flex flex-wrap items-end justify-center gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="ip-address" className="text-zinc-400 text-xs font-medium">{t.ipAddress}</label>
              <input
                type="text"
                id="ip-address"
                placeholder={t.ipPlaceholder}
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                className="bg-zinc-900 border-2 border-zinc-700 rounded-lg px-3 py-2 text-green-400 font-mono text-lg outline-none w-64 text-center focus:border-zinc-500 transition-colors"
              />
            </div>

            <span className="text-zinc-400 text-2xl font-bold pb-1 select-none">/</span>

            {!subnetMode ? (
              <div className="flex flex-col gap-1">
                <label htmlFor="mask-input" className="text-zinc-400 text-xs font-medium">{t.mask}</label>
                <input
                  type="number"
                  id="mask-input"
                  min={0} max={32}
                  placeholder={t.maskPlaceholder}
                  value={maskStr}
                  onChange={(e) => setMaskStr(e.target.value)}
                  className="bg-zinc-900 border-2 border-zinc-700 rounded-lg px-3 py-2 text-blue-400 font-mono text-lg outline-none w-32 text-center focus:border-zinc-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            ) : (
              <div className="flex items-end gap-1">
                <span className="text-zinc-400 text-2xl font-bold pb-1 select-none">(</span>
                <div className="flex flex-col gap-1">
                  <label htmlFor="mask-input-dual" className="text-zinc-400 text-xs font-medium">{t.mask}</label>
                  <input
                    type="number"
                    id="mask-input-dual"
                    min={0} max={32}
                    placeholder={t.maskPlaceholder}
                    value={maskDualStr}
                    onChange={(e) => setMaskDualStr(e.target.value)}
                    className="bg-zinc-900 border-2 border-zinc-700 rounded-lg px-3 py-2 text-blue-400 font-mono text-lg outline-none w-32 text-center focus:border-zinc-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <span className="text-zinc-400 text-2xl font-bold pb-1 select-none">+</span>
                <div className="flex flex-col gap-1">
                  <label htmlFor="submask-input" className="text-zinc-400 text-xs font-medium">{t.submask}</label>
                  <input
                    type="number"
                    id="submask-input"
                    min={0} max={30}
                    placeholder={t.submaskPlaceholder}
                    value={submaskStr}
                    onChange={(e) => setSubmaskStr(e.target.value)}
                    className="bg-zinc-900 border-2 border-zinc-700 rounded-lg px-3 py-2 text-purple-400 font-mono text-lg outline-none w-32 text-center focus:border-zinc-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <span className="text-zinc-400 text-2xl font-bold pb-1 select-none">)</span>
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        </div>

        {/* Results */}
        <div className="mt-8">
          <h3 className="text-zinc-300 text-lg font-semibold mb-3">{t.results}</h3>

          {!result ? (
            /* Skeleton */
            <div>
              <DataTable rows={skeletonMainRows} />
              <AnimatedDetails
                className="mt-3 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden"
                summaryClassName="px-4 py-3 cursor-pointer select-none hover:bg-zinc-800/50 transition-colors text-zinc-300 text-sm font-medium"
                summary={<span>{t.showDetails}</span>}
              >
                <DataTable bare rows={skeletonDetailRows} />
              </AnimatedDetails>
              <p className="text-zinc-600 text-xs text-center mt-3">{t.noData}</p>
            </div>
          ) : (
            /* Real results */
            <div>
              <DataTable rows={mainResultRows} />
              <AnimatedDetails
                className="mt-3 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden"
                summaryClassName="px-4 py-3 cursor-pointer select-none hover:bg-zinc-800/50 transition-colors text-zinc-300 text-sm font-medium"
                summary={<span>{t.showDetails}</span>}
              >
                <DataTable bare rows={detailResultRows} />
              </AnimatedDetails>
            </div>
          )}
        </div>

        {/* Subnets */}
        {result?.subnets && result.subnets.length > 0 && (
          <div className="mt-8">
            <h3 className="text-zinc-300 text-lg font-semibold mb-3">{t.subnetsTitle}</h3>

            {/* Summary table */}
            <DataTable
              className="mb-4"
              headers={[
                { label: '#' },
                { label: t.networkAddressLabel },
                { label: t.ipRangeLabel },
                { label: t.broadcastAddressLabel },
                { label: t.usable, className: 'text-center' },
              ]}
            >
              {result.subnets.map((subnet, i) => {
                const isFirst   = i === 0;
                const isLast    = i === result.subnets!.length - 1;
                const subHostValid = isHostRangeValid(subnet.firstHost, subnet.lastHost);
                const isUsable  = !isFirst && !isLast && subHostValid;
                const bg        = i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-800/50';
                const netColor  = isFirst ? 'text-red-400'    : 'text-green-400';
                const bcastColor = isLast ? 'text-red-400'    : 'text-orange-400';
                const rangeColor = isUsable ? 'text-blue-400' : 'text-red-400';
                return (
                  <tr key={i} className={bg}>
                    <td className="px-4 py-2 text-zinc-300 font-mono">{i}</td>
                    <td className={`px-4 py-2 ${netColor} font-mono`}>
                      {subnet.networkAddress}
                      {isFirst && <IconX className="w-3.5 h-3.5 ml-1" />}
                    </td>
                    <td className={`px-4 py-2 ${rangeColor} font-mono text-xs`}>
                      {subnet.firstHost} — {subnet.lastHost}
                    </td>
                    <td className={`px-4 py-2 ${bcastColor} font-mono`}>
                      {subnet.broadcastAddress}
                      {isLast && <IconX className="w-3.5 h-3.5 ml-1" />}
                    </td>
                    <td className="px-4 py-2 flex justify-center">
                      {isUsable
                        ? <IconCheck className="w-5 h-5 text-emerald-400" />
                        : <IconX    className="w-5 h-5 text-red-400" />}
                    </td>
                  </tr>
                );
              })}
            </DataTable>

            {/* Accordion cards */}
            <div className="flex flex-col gap-2">
              {result.subnets.map((subnet, i) => (
                <SubnetCard
                  key={i}
                  subnet={subnet}
                  index={i}
                  total={result.subnets!.length}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
