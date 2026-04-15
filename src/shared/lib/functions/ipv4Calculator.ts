export default function calculateIpv4(
  ip: string,
  mask: number,
  submask?: number,
) {
  if (mask < 0 || mask > 32) {
    throw new Error('Invalid subnet mask (0-32)');
  }

  const octets = ip.split('.');
  if (octets.length !== 4) {
    throw new Error('Missing octets');
  }

  const octet1 = Number(octets[0]);
  const octet2 = Number(octets[1]);
  const octet3 = Number(octets[2]);
  const octet4 = Number(octets[3]);

  if (isNaN(octet1) || isNaN(octet2) || isNaN(octet3) || isNaN(octet4)) {
    throw new Error('Missing octets');
  }

  if (
    octet1 < 0 ||
    octet1 > 255 ||
    octet2 < 0 ||
    octet2 > 255 ||
    octet3 < 0 ||
    octet3 > 255 ||
    octet4 < 0 ||
    octet4 > 255
  ) {
    throw new Error('Octet value out of range (0-255)');
  }

  if (submask) {
    if (submask < 0 || submask > 32 - mask) {
      throw new Error(`Invalid submask (0-${32 - mask})`);
    }
  }

  const combinedMask = (0xffffffff << (32 - mask - (submask || 0))) >>> 0;
  const wildcardMask = ~combinedMask >>> 0;
  const networkAddress =
    ((octet1 << 24) | (octet2 << 16) | (octet3 << 8) | octet4) & combinedMask;
  const broadcastAddress = networkAddress | wildcardMask;

  const baseMask = (0xffffffff << (32 - mask)) >>> 0;
  const subMaskInt = submask
    ? (((1 << submask) - 1) << (32 - mask - submask)) >>> 0
    : null;

  const totalSubnets = submask ? 2 ** submask : null;

  const totalHosts =
    submask && totalSubnets
      ? Math.max(0, (1 << (32 - mask - submask)) - 2) * (totalSubnets - 2)
      : Math.max(0, (1 << (32 - mask)) - 2);

  const subnets =
    submask && totalSubnets
      ? generateSubnets(networkAddress, mask, submask, [])
      : null;

  const firstHost =
    submask && subnets && subnets.length >= 2
      ? parseIp(subnets[1]!.networkAddress) + 1
      : networkAddress + 1;
  const lastHost =
    submask && subnets && subnets.length >= 2
      ? parseIp(subnets[subnets.length - 2]!.broadcastAddress) - 1
      : broadcastAddress - 1;

  const networkOctets = [octet1, octet2, octet3, octet4];

  // in-addr.arpa for network zones omits trailing zero octets.
  while (
    networkOctets.length > 0 &&
    networkOctets[networkOctets.length - 1] === 0
  ) {
    networkOctets.pop();
  }

  const inAddrArpa =
    (networkOctets.length > 0
      ? [...networkOctets].reverse().join('.') + '.'
      : '') + 'in-addr.arpa';

  return {
    ipAddress: ip,
    networkAddress: [
      (networkAddress >> 24) & 0xff,
      (networkAddress >> 16) & 0xff,
      (networkAddress >> 8) & 0xff,
      networkAddress & 0xff,
    ].join('.'),
    class:
      octet1 < 128
        ? 'A'
        : octet1 < 192
          ? 'B'
          : octet1 < 224
            ? 'C'
            : octet1 < 240
              ? 'D'
              : 'E',
    netMask: [
      (baseMask >> 24) & 0xff,
      (baseMask >> 16) & 0xff,
      (baseMask >> 8) & 0xff,
      baseMask & 0xff,
    ].join('.'),
    subMask: subMaskInt !== null
      ? [
          (subMaskInt >> 24) & 0xff,
          (subMaskInt >> 16) & 0xff,
          (subMaskInt >> 8) & 0xff,
          subMaskInt & 0xff,
        ].join('.')
      : null,
    fullMask: submask
      ? [
          (combinedMask >> 24) & 0xff,
          (combinedMask >> 16) & 0xff,
          (combinedMask >> 8) & 0xff,
          combinedMask & 0xff,
        ].join('.')
      : null,
    wildcardMask: [
      (wildcardMask >> 24) & 0xff,
      (wildcardMask >> 16) & 0xff,
      (wildcardMask >> 8) & 0xff,
      wildcardMask & 0xff,
    ].join('.'),
    broadcastAddress: [
      (broadcastAddress >> 24) & 0xff,
      (broadcastAddress >> 16) & 0xff,
      (broadcastAddress >> 8) & 0xff,
      broadcastAddress & 0xff,
    ].join('.'),
    firstHost: [
      (firstHost >> 24) & 0xff,
      (firstHost >> 16) & 0xff,
      (firstHost >> 8) & 0xff,
      firstHost & 0xff,
    ].join('.'),
    lastHost: [
      (lastHost >> 24) & 0xff,
      (lastHost >> 16) & 0xff,
      (lastHost >> 8) & 0xff,
      lastHost & 0xff,
    ].join('.'),
    totalHosts: totalHosts,
    inAddrArpa: inAddrArpa,
    ipv6Mapped: `::ffff:${octet1.toString(16).padStart(2, '0')}${octet2.toString(16).padStart(2, '0')}:${octet3.toString(16).padStart(2, '0')}${octet4.toString(16).padStart(2, '0')}`,
    subnets: subnets,
  };
}

function parseIp(ip: string): number {
  const p = ip.split('.').map(Number);
  return ((p[0]! << 24) | (p[1]! << 16) | (p[2]! << 8) | p[3]!) >>> 0;
}

function generateSubnets(
  networkAddress: number,
  netMask: number,
  submask: number,
  subnets: any[],
): any[] {
  const currentSubnet =
    (networkAddress >> (32 - netMask - submask)) & ((1 << submask) - 1);

  const isLastSubnet = currentSubnet === (1 << submask) - 1;

  const networkAddressStr = [
    (networkAddress >> 24) & 0xff,
    (networkAddress >> 16) & 0xff,
    (networkAddress >> 8) & 0xff,
    networkAddress & 0xff,
  ].join('.');

  subnets.push(calculateIpv4(networkAddressStr, netMask + submask));

  if (isLastSubnet) return subnets;

  const nextSubnetAddress = networkAddress + (1 << (32 - netMask - submask));

  return generateSubnets(nextSubnetAddress, netMask, submask, subnets);
}
