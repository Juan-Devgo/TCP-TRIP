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

  const netMask = (0xffffffff << (32 - mask - (submask || 0))) >>> 0;
  const wildcardMask = ~netMask >>> 0;
  const networkAddress =
    ((octet1 << 24) | (octet2 << 16) | (octet3 << 8) | octet4) & netMask;
  const broadcastAddress = networkAddress | wildcardMask;

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
    submask && subnets ? subnets[1].networkAddress + 1 : networkAddress + 1;
  const lastHost = broadcastAddress - 1;

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
    subnetMask: [
      (netMask >> 24) & 0xff,
      (netMask >> 16) & 0xff,
      (netMask >> 8) & 0xff,
      netMask & 0xff,
    ].join('.'),
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
    inAddrArpa: [octet4, octet3, octet2, octet1].join('.') + '.in-addr.arpa',
    ipv6Mapped: `::ffff:${octet1.toString(16)}${octet2.toString(16)}:${octet3.toString(16)}${octet4.toString(16)}`,
    subnets: subnets,
  };
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
