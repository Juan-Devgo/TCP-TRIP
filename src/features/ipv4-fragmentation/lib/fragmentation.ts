/**
 * IPv4 datagram fragmentation over a single link, as RFC 791 §3.2 describes
 * it: the header is copied into every fragment, the data is cut in blocks of
 * 8 bytes, and only Total Length, MF and Fragment Offset change.
 *
 * Out of scope on purpose: options (the header is always 20 bytes, IHL 5),
 * a real checksum (always 0), refragmentation and reassembly.
 */

/** IHL 5: a header without options. */
export const IPV4_HEADER_BYTES = 20;
/** Fragment Offset counts in units of 8 bytes (RFC 791 §3.1). */
export const FRAGMENT_BLOCK_BYTES = 8;

/** Every module must forward 68 bytes unfragmented (RFC 791 §3.2). */
export const MIN_MTU = 68;
/** Total Length is a 16-bit field (RFC 791 §3.1). */
export const MAX_MTU = 65535;
/** A header plus at least one byte of data. */
export const MIN_TOTAL_LENGTH = IPV4_HEADER_BYTES + 1;
export const MAX_TOTAL_LENGTH = 65535;
/** Identification is a 16-bit field. */
export const MAX_IDENTIFICATION = 65535;
/** TTL and Protocol are 8-bit fields (RFC 791 §3.1). */
export const MAX_TTL = 255;
export const MAX_PROTOCOL = 255;

/** What the form does not ask for, fixed so every card reads the same. */
export const HEADER_DEFAULTS = {
  version: 4,
  ihl: 5,
  diffServ: 0,
  ttl: 64,
  /** UDP. */
  protocol: 17,
  checksum: 0,
} as const;

/** Used while the optional fields are empty; shown as their placeholders. */
export const DEFAULT_TTL = HEADER_DEFAULTS.ttl;
export const DEFAULT_PROTOCOL = HEADER_DEFAULTS.protocol;
export const DEFAULT_IDENTIFICATION = 54321;
export const DEFAULT_SOURCE_IP = "192.168.1.10";
export const DEFAULT_DESTINATION_IP = "10.0.0.20";

export type FragmentationErrorCode =
  | "mtuOutOfRange"
  | "mtuNotMultipleOf8"
  | "totalLengthOutOfRange"
  | "invalidIdentification"
  | "invalidTtl"
  | "invalidProtocol"
  | "invalidIp";

export class FragmentationError extends Error {
  readonly code: FragmentationErrorCode;
  readonly detail: string;

  constructor(code: FragmentationErrorCode, detail = "") {
    super(`${code}: ${detail}`);
    this.name = "FragmentationError";
    this.code = code;
    this.detail = detail;
  }
}

/** The 20-byte header, field by field, in RFC 791 order. */
export type Ipv4Header = {
  version: number;
  ihl: number;
  diffServ: number;
  totalLength: number;
  identification: number;
  /** The reserved flag bit; always 0. */
  reserved: 0;
  /** Don't Fragment; this tool always sends 0. */
  df: 0 | 1;
  /** More Fragments. */
  mf: 0 | 1;
  /** In blocks of 8 bytes. */
  fragmentOffset: number;
  ttl: number;
  protocol: number;
  checksum: number;
  sourceIp: string;
  destinationIp: string;
};

export type Fragment = {
  header: Ipv4Header;
  /** Data bytes this fragment carries (Total Length minus the header). */
  dataBytes: number;
  /** Position of its first data byte in the original payload. */
  dataStart: number;
};

export type FragmentationResult = {
  /** The link MTU the datagram was split for. */
  mtu: number;
  original: Ipv4Header;
  /** The original datagram alone when it already fits the MTU. */
  fragments: Fragment[];
  /** Data bytes of the original datagram. */
  dataBytes: number;
  /** Largest data a fragment may carry on this link: `MTU − 20`. */
  maxFragmentData: number;
  needsFragmentation: boolean;
};

export type FragmentOptions = {
  identification?: number;
  ttl?: number;
  protocol?: number;
  sourceIp?: string;
  destinationIp?: string;
};

export function isValidIpv4(ip: string): boolean {
  const octets = ip.split(".");
  if (octets.length !== 4) return false;
  return octets.every((octet) => {
    const value = Number(octet);
    return (
      octet !== "" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 255 &&
      // Rejects "01" and " 1": the canonical spelling round-trips.
      octet === String(value)
    );
  });
}

export function isValidTtl(ttl: number): boolean {
  return Number.isInteger(ttl) && ttl >= 0 && ttl <= MAX_TTL;
}

export function isValidProtocol(protocol: number): boolean {
  return Number.isInteger(protocol) && protocol >= 0 && protocol <= MAX_PROTOCOL;
}

/** Why an MTU cannot be used, or `null` when it can. */
export function checkMtu(mtu: number): FragmentationErrorCode | null {
  if (!Number.isInteger(mtu) || mtu < MIN_MTU || mtu > MAX_MTU) {
    return "mtuOutOfRange";
  }
  // Every fragment but the last must end on an 8-byte boundary, or the next
  // offset could not be written.
  if ((mtu - IPV4_HEADER_BYTES) % FRAGMENT_BLOCK_BYTES !== 0) {
    return "mtuNotMultipleOf8";
  }
  return null;
}

export function checkTotalLength(
  totalLength: number,
): FragmentationErrorCode | null {
  return Number.isInteger(totalLength) &&
    totalLength >= MIN_TOTAL_LENGTH &&
    totalLength <= MAX_TOTAL_LENGTH
    ? null
    : "totalLengthOutOfRange";
}

export function isValidIdentification(id: number): boolean {
  return Number.isInteger(id) && id >= 0 && id <= MAX_IDENTIFICATION;
}

/**
 * How many fragments a datagram of `totalLength` bytes becomes on a link of
 * `mtu` bytes, without building them: 1 when it already fits. Assumes inputs
 * `checkTotalLength` and `checkMtu` accept.
 */
export function fragmentCount(totalLength: number, mtu: number): number {
  if (totalLength <= mtu) return 1;
  return Math.ceil(
    (totalLength - IPV4_HEADER_BYTES) / (mtu - IPV4_HEADER_BYTES),
  );
}

/**
 * Splits a datagram of `totalLength` bytes for a link of `mtu` bytes. Throws
 * `FragmentationError` for any input the form would have flagged.
 */
export function fragment(
  totalLength: number,
  mtu: number,
  options: FragmentOptions = {},
): FragmentationResult {
  const lengthError = checkTotalLength(totalLength);
  if (lengthError) throw new FragmentationError(lengthError, String(totalLength));
  const mtuError = checkMtu(mtu);
  if (mtuError) throw new FragmentationError(mtuError, String(mtu));

  const identification = options.identification ?? DEFAULT_IDENTIFICATION;
  if (!isValidIdentification(identification)) {
    throw new FragmentationError("invalidIdentification", String(identification));
  }
  const ttl = options.ttl ?? DEFAULT_TTL;
  if (!isValidTtl(ttl)) throw new FragmentationError("invalidTtl", String(ttl));
  const protocol = options.protocol ?? DEFAULT_PROTOCOL;
  if (!isValidProtocol(protocol)) {
    throw new FragmentationError("invalidProtocol", String(protocol));
  }
  const sourceIp = options.sourceIp ?? DEFAULT_SOURCE_IP;
  const destinationIp = options.destinationIp ?? DEFAULT_DESTINATION_IP;
  for (const ip of [sourceIp, destinationIp]) {
    if (!isValidIpv4(ip)) throw new FragmentationError("invalidIp", ip);
  }

  const original: Ipv4Header = {
    ...HEADER_DEFAULTS,
    totalLength,
    identification,
    reserved: 0,
    df: 0,
    mf: 0,
    fragmentOffset: 0,
    ttl,
    protocol,
    sourceIp,
    destinationIp,
  };

  const dataBytes = totalLength - IPV4_HEADER_BYTES;
  const maxFragmentData = mtu - IPV4_HEADER_BYTES;

  if (totalLength <= mtu) {
    return {
      mtu,
      original,
      fragments: [{ header: original, dataBytes, dataStart: 0 }],
      dataBytes,
      maxFragmentData,
      needsFragmentation: false,
    };
  }

  // The count is known up front, so the array is sized once and each header is
  // written field by field: no spread copy, no growth, no division per step.
  const count = fragmentCount(totalLength, mtu);
  const fragments = new Array<Fragment>(count);
  const lastIndex = count - 1;
  let dataStart = 0;
  for (let index = 0; index < count; index++) {
    const isLast = index === lastIndex;
    const size = isLast ? dataBytes - dataStart : maxFragmentData;
    fragments[index] = {
      header: {
        version: original.version,
        ihl: original.ihl,
        diffServ: original.diffServ,
        totalLength: size + IPV4_HEADER_BYTES,
        identification,
        reserved: 0,
        df: 0,
        mf: isLast ? 0 : 1,
        fragmentOffset: dataStart / FRAGMENT_BLOCK_BYTES,
        ttl: original.ttl,
        protocol: original.protocol,
        checksum: original.checksum,
        sourceIp,
        destinationIp,
      },
      dataBytes: size,
      dataStart,
    };
    dataStart += maxFragmentData;
  }

  return {
    mtu,
    original,
    fragments,
    dataBytes,
    maxFragmentData,
    needsFragmentation: true,
  };
}

/** A run of consecutive fragments that carry the same amount of data. */
export type DataTerm = { bytes: number; count: number };

export type DataSumCheck = {
  /** The fragments' data sizes, consecutive equal ones grouped. */
  terms: DataTerm[];
  /** Sum of every fragment's data. */
  sum: number;
  /** `sum` plus one 20-byte header: what the original Total Length must be. */
  total: number;
  matches: boolean;
};

/**
 * The check a student does by hand on a fragmentation table: add up the data
 * of every fragment, add back one header, and land on the original Total
 * Length. Summed from the fragments themselves, not from the formula that
 * built them, so it would catch a split that lost or duplicated bytes.
 */
export function checkDataSum(result: FragmentationResult): DataSumCheck {
  const terms: DataTerm[] = [];
  let sum = 0;
  for (const { dataBytes } of result.fragments) {
    sum += dataBytes;
    const last = terms.at(-1);
    if (last && last.bytes === dataBytes) last.count += 1;
    else terms.push({ bytes: dataBytes, count: 1 });
  }
  const total = sum + IPV4_HEADER_BYTES;
  return { terms, sum, total, matches: total === result.original.totalLength };
}
