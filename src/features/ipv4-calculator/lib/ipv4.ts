/**
 * IPv4 addressing maths: the numbers a student would otherwise work out by
 * hand on paper — network and broadcast address, mask, wildcard, host range,
 * and the subnets an extended mask carves out of a network.
 *
 * Everything here is pure and framework-free: the component owns the copy, the
 * colours and the layout, this module owns the arithmetic.
 */

export const IP_CLASSES = ["A", "B", "C", "D", "E"] as const;

export type IpClass = (typeof IP_CLASSES)[number];

/** The address span each classful range covers, shown next to the class. */
export const IP_CLASS_RANGES: Record<IpClass, string> = {
  A: "0.0.0.0 - 127.255.255.255",
  B: "128.0.0.0 - 191.255.255.255",
  C: "192.0.0.0 - 223.255.255.255",
  D: "224.0.0.0 - 239.255.255.255",
  E: "240.0.0.0 - 255.255.255.255",
};

export type Ipv4ErrorCode =
  /** Not four dot-separated octets, or an octet outside 0–255. */
  | "invalidIp"
  /** The network mask is not an integer prefix in 0–32. */
  | "invalidMask"
  /** The added bits do not fit in what the network mask leaves free. */
  | "invalidSubmask";

/** Carries a code instead of a message: the component owns the translated copy. */
export class Ipv4Error extends Error {
  readonly code: Ipv4ErrorCode;
  /** The offending value or the bound that was exceeded, for the placeholder. */
  readonly detail: string;

  constructor(code: Ipv4ErrorCode, detail = "") {
    super(`${code}: ${detail}`);
    this.name = "Ipv4Error";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * How many subnets are materialised for display. Adding 20 bits is a legal
 * exercise (`10.0.0.0/8` + 20) but it describes a million subnets: listing
 * them would freeze the tab for a table nobody can read. The count is always
 * reported exactly — only the listing is cut, and `subnetsTruncated` says so.
 */
export const MAX_LISTED_SUBNETS = 256;

export type Ipv4Result = {
  /** The address as typed, kept so the UI can show it next to the network. */
  ipAddress: string;
  networkAddress: string;
  broadcastAddress: string;
  ipClass: IpClass;
  /** Dotted mask for the network prefix alone. */
  netMask: string;
  /** Dotted mask of the added bits only, or `null` without subnetting. */
  subMask: string | null;
  /** Dotted mask for prefix + added bits, or `null` without subnetting. */
  fullMask: string | null;
  wildcardMask: string;
  /** Network bits actually in use: `mask + submask`. */
  prefix: number;
  /** First and last assignable address of the usable range. */
  firstHost: string;
  lastHost: string;
  /** `false` when the prefix leaves no room for two distinct hosts. */
  hasHosts: boolean;
  totalHosts: number;
  totalSubnets: number | null;
  /** Reverse-DNS name, trailing zero octets dropped as a zone name would. */
  inAddrArpa: string;
  ipv6Mapped: string;
  /** One entry per subnet, capped at `MAX_LISTED_SUBNETS`. */
  subnets: Ipv4Result[] | null;
  subnetsTruncated: boolean;
};

const OCTET = 256;

/** `2 ** 32`, spelled out because `1 << 32` silently wraps to `1` in JS. */
const ADDRESS_SPACE = 4294967296;

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

export function isValidMask(mask: number): boolean {
  return Number.isInteger(mask) && mask >= 0 && mask <= 32;
}

/** Added bits must leave the mask intact and carve at least two subnets. */
export function isValidSubmask(submask: number, mask: number): boolean {
  return Number.isInteger(submask) && submask >= 1 && submask <= 32 - mask;
}

/** @throws Ipv4Error `invalidIp` */
export function parseIpv4(ip: string): number {
  if (!isValidIpv4(ip)) throw new Ipv4Error("invalidIp", ip);
  return ip
    .split(".")
    .reduce((total, octet) => total * OCTET + Number(octet), 0);
}

export function formatIpv4(address: number): string {
  // Plain arithmetic, not `>>`: a bit shift would read anything above
  // 128.0.0.0 as a negative number.
  const value = ((address % ADDRESS_SPACE) + ADDRESS_SPACE) % ADDRESS_SPACE;
  return [
    Math.floor(value / 16777216) % OCTET,
    Math.floor(value / 65536) % OCTET,
    Math.floor(value / 256) % OCTET,
    value % OCTET,
  ].join(".");
}

/** The dotted mask of a `/prefix`, as an unsigned 32-bit number. */
export function maskFromPrefix(prefix: number): number {
  if (!isValidMask(prefix)) throw new Ipv4Error("invalidMask", String(prefix));
  // `0xffffffff << 32` is `0xffffffff` in JS, so /0 needs its own answer.
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function ipClassOf(address: number): IpClass {
  const first = Math.floor(address / 16777216) % OCTET;
  if (first < 128) return "A";
  if (first < 192) return "B";
  if (first < 224) return "C";
  if (first < 240) return "D";
  return "E";
}

/**
 * Everything the calculator shows for one address.
 *
 * @param ip      dotted address, e.g. `192.168.1.100`
 * @param mask    network prefix length, 0–32
 * @param submask bits added to the mask, taken from the host part, to make
 *                subnets. Omitted (or `0`) means no subnetting, and `subnets`
 *                comes back `null`.
 *
 * @throws Ipv4Error `invalidIp` | `invalidMask` | `invalidSubmask`
 */
export function calculateIpv4(
  ip: string,
  mask: number,
  submask?: number,
): Ipv4Result {
  const address = parseIpv4(ip);
  if (!isValidMask(mask)) throw new Ipv4Error("invalidMask", String(mask));

  const added = submask ?? 0;
  if (added !== 0 && !isValidSubmask(added, mask)) {
    throw new Ipv4Error("invalidSubmask", String(32 - mask));
  }

  const prefix = mask + added;
  const baseMask = maskFromPrefix(mask);
  const fullMask = maskFromPrefix(prefix);
  const wildcard = (~fullMask >>> 0) >>> 0;

  const networkAddress = (address & fullMask) >>> 0;
  const broadcastAddress = (networkAddress | wildcard) >>> 0;

  /** Addresses per subnet, minus network and broadcast. */
  const hostsPerBlock = Math.max(0, 2 ** (32 - prefix) - 2);
  const totalSubnets = added === 0 ? null : 2 ** added;

  // Subnet zero and the all-ones subnet are excluded by the classic rule the
  // course teaches, which is also why a /x + 1 split has no usable range.
  const totalHosts =
    totalSubnets === null
      ? hostsPerBlock
      : hostsPerBlock * Math.max(0, totalSubnets - 2);

  const [firstHost, lastHost] = usableRange({
    address,
    baseMask,
    prefix,
    networkAddress,
    broadcastAddress,
    totalSubnets,
  });

  return {
    ipAddress: ip,
    networkAddress: formatIpv4(networkAddress),
    broadcastAddress: formatIpv4(broadcastAddress),
    ipClass: ipClassOf(address),
    netMask: formatIpv4(baseMask),
    subMask: totalSubnets === null ? null : formatIpv4((fullMask ^ baseMask) >>> 0),
    fullMask: totalSubnets === null ? null : formatIpv4(fullMask),
    wildcardMask: formatIpv4(wildcard),
    prefix,
    firstHost: formatIpv4(firstHost),
    lastHost: formatIpv4(lastHost),
    hasHosts: firstHost < lastHost,
    totalHosts,
    totalSubnets,
    inAddrArpa: inAddrArpaOf(ip),
    ipv6Mapped: ipv6MappedOf(ip),
    subnets:
      totalSubnets === null
        ? null
        : listSubnets((address & baseMask) >>> 0, mask, added, totalSubnets),
    subnetsTruncated:
      totalSubnets !== null && totalSubnets > MAX_LISTED_SUBNETS,
  };
}

/**
 * The assignable range. Without subnetting it is the block itself; with
 * subnetting it spans the usable subnets, so it starts inside subnet 1 and
 * ends inside the second-to-last one.
 */
function usableRange({
  address,
  baseMask,
  prefix,
  networkAddress,
  broadcastAddress,
  totalSubnets,
}: {
  address: number;
  baseMask: number;
  prefix: number;
  networkAddress: number;
  broadcastAddress: number;
  totalSubnets: number | null;
}): [first: number, last: number] {
  if (totalSubnets === null) {
    return [networkAddress + 1, broadcastAddress - 1];
  }

  const parentNetwork = (address & baseMask) >>> 0;
  const blockSize = 2 ** (32 - prefix);
  // Subnet 1's network + 1 … subnet (n-2)'s broadcast - 1. When there are
  // fewer than four subnets these cross over, and `hasHosts` reports false.
  return [
    parentNetwork + blockSize + 1,
    parentNetwork + (totalSubnets - 1) * blockSize - 2,
  ];
}

/**
 * Every subnet of `parentNetwork`, in address order, each described as a plain
 * `/prefix` network so the UI can reuse the same row renderer. Capped at
 * `MAX_LISTED_SUBNETS`; the exact count lives in `totalSubnets`.
 */
function listSubnets(
  parentNetwork: number,
  mask: number,
  submask: number,
  totalSubnets: number,
): Ipv4Result[] {
  const blockSize = 2 ** (32 - mask - submask);
  const listed = Math.min(totalSubnets, MAX_LISTED_SUBNETS);

  const subnets: Ipv4Result[] = [];
  for (let index = 0; index < listed; index++) {
    subnets.push(
      calculateIpv4(formatIpv4(parentNetwork + index * blockSize), mask + submask),
    );
  }
  return subnets;
}

/**
 * Reverse-DNS name. Trailing zero octets are dropped because that is how a
 * delegated zone is written (`10.in-addr.arpa` for `10.0.0.0`), which is the
 * form the course shows.
 */
function inAddrArpaOf(ip: string): string {
  const octets = ip.split(".").map(Number);
  while (octets.length > 0 && octets[octets.length - 1] === 0) octets.pop();
  const prefix = octets.length > 0 ? `${[...octets].reverse().join(".")}.` : "";
  return `${prefix}in-addr.arpa`;
}

/** The IPv4-mapped IPv6 form, `::ffff:c0a8:0164`. */
function ipv6MappedOf(ip: string): string {
  const hex = ip
    .split(".")
    .map((octet) => Number(octet).toString(16).padStart(2, "0"));
  return `::ffff:${hex[0]}${hex[1]}:${hex[2]}${hex[3]}`;
}
