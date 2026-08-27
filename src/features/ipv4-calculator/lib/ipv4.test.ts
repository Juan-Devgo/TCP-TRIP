import { describe, expect, test } from "bun:test";

import {
  calculateIpv4,
  formatIpv4,
  Ipv4Error,
  isValidIpv4,
  isValidSubmask,
  MAX_LISTED_SUBNETS,
  maskFromPrefix,
  parseIpv4,
} from "@/features/ipv4-calculator/lib/ipv4";

describe("validation", () => {
  test("accepts canonical dotted quads", () => {
    expect(isValidIpv4("0.0.0.0")).toBe(true);
    expect(isValidIpv4("255.255.255.255")).toBe(true);
    expect(isValidIpv4("192.168.1.100")).toBe(true);
  });

  test("rejects malformed addresses", () => {
    expect(isValidIpv4("192.168.1")).toBe(false);
    expect(isValidIpv4("192.168.1.256")).toBe(false);
    expect(isValidIpv4("192.168.01.1")).toBe(false);
    expect(isValidIpv4("192.168.1.")).toBe(false);
    expect(isValidIpv4("a.b.c.d")).toBe(false);
  });

  test("added bits must fit in the host part", () => {
    expect(isValidSubmask(3, 24)).toBe(true);
    expect(isValidSubmask(8, 24)).toBe(true);
    expect(isValidSubmask(9, 24)).toBe(false);
    expect(isValidSubmask(0, 24)).toBe(false);
  });

  test("reports the offending value through the error code", () => {
    expect(() => calculateIpv4("1.2.3", 24)).toThrow(Ipv4Error);
    expect(() => calculateIpv4("1.2.3.4", 33)).toThrow(Ipv4Error);
    try {
      calculateIpv4("1.2.3.4", 24, 9);
    } catch (error) {
      expect(error).toBeInstanceOf(Ipv4Error);
      expect((error as Ipv4Error).code).toBe("invalidSubmask");
      // The bound the message quotes: bits still free after the mask.
      expect((error as Ipv4Error).detail).toBe("8");
    }
  });
});

describe("address arithmetic above 128.0.0.0", () => {
  test("round-trips addresses in the top half of the space", () => {
    expect(formatIpv4(parseIpv4("240.0.0.1"))).toBe("240.0.0.1");
    expect(formatIpv4(parseIpv4("255.255.255.255"))).toBe("255.255.255.255");
  });

  test("/0 is the whole space, not a wrapped shift", () => {
    expect(maskFromPrefix(0)).toBe(0);
    const result = calculateIpv4("10.0.0.1", 0);
    expect(result.netMask).toBe("0.0.0.0");
    expect(result.broadcastAddress).toBe("255.255.255.255");
    expect(result.totalHosts).toBe(2 ** 32 - 2);
  });
});

describe("a plain network", () => {
  const result = calculateIpv4("192.168.1.100", 24);

  test("derives the network block", () => {
    expect(result.networkAddress).toBe("192.168.1.0");
    expect(result.broadcastAddress).toBe("192.168.1.255");
    expect(result.netMask).toBe("255.255.255.0");
    expect(result.wildcardMask).toBe("0.0.0.255");
    expect(result.ipClass).toBe("C");
  });

  test("host range excludes the network and the broadcast", () => {
    expect(result.firstHost).toBe("192.168.1.1");
    expect(result.lastHost).toBe("192.168.1.254");
    expect(result.totalHosts).toBe(254);
    expect(result.hasHosts).toBe(true);
  });

  test("carries no subnetting fields", () => {
    expect(result.subMask).toBeNull();
    expect(result.fullMask).toBeNull();
    expect(result.subnets).toBeNull();
    expect(result.totalSubnets).toBeNull();
  });

  test("a /31 leaves no assignable range", () => {
    const tight = calculateIpv4("192.168.1.100", 31);
    expect(tight.hasHosts).toBe(false);
    expect(tight.totalHosts).toBe(0);
  });

  test("reverse-DNS drops trailing zero octets", () => {
    expect(calculateIpv4("10.0.0.0", 8).inAddrArpa).toBe("10.in-addr.arpa");
    expect(result.inAddrArpa).toBe("100.1.168.192.in-addr.arpa");
  });

  test("maps to the IPv4-mapped IPv6 form", () => {
    expect(result.ipv6Mapped).toBe("::ffff:c0a8:0164");
  });
});

describe("a subnetted network", () => {
  const result = calculateIpv4("192.168.1.100", 24, 3);

  test("splits the mask into prefix, added bits and full mask", () => {
    expect(result.netMask).toBe("255.255.255.0");
    expect(result.subMask).toBe("0.0.0.224");
    expect(result.fullMask).toBe("255.255.255.224");
    expect(result.prefix).toBe(27);
  });

  test("lists every subnet from subnet zero, not from the address given", () => {
    expect(result.totalSubnets).toBe(8);
    expect(result.subnets).toHaveLength(8);
    expect(result.subnets?.[0]?.networkAddress).toBe("192.168.1.0");
    expect(result.subnets?.[3]?.networkAddress).toBe("192.168.1.96");
    expect(result.subnets?.[7]?.networkAddress).toBe("192.168.1.224");
    expect(result.subnets?.[7]?.broadcastAddress).toBe("192.168.1.255");
  });

  test("the network address is the subnet the address falls in", () => {
    expect(result.networkAddress).toBe("192.168.1.96");
    expect(result.broadcastAddress).toBe("192.168.1.127");
  });

  test("the usable range skips subnet zero and the all-ones subnet", () => {
    expect(result.firstHost).toBe("192.168.1.33");
    expect(result.lastHost).toBe("192.168.1.222");
    // 30 hosts in each of the 6 usable subnets.
    expect(result.totalHosts).toBe(180);
  });

  test("adding a single bit leaves nothing usable", () => {
    const split = calculateIpv4("192.168.1.100", 24, 1);
    expect(split.totalSubnets).toBe(2);
    expect(split.totalHosts).toBe(0);
    expect(split.hasHosts).toBe(false);
  });

  test("caps the listing but still reports the real count", () => {
    const wide = calculateIpv4("10.0.0.1", 8, 12);
    expect(wide.totalSubnets).toBe(4096);
    expect(wide.subnets).toHaveLength(MAX_LISTED_SUBNETS);
    expect(wide.subnetsTruncated).toBe(true);
    expect(calculateIpv4("192.168.1.100", 24, 3).subnetsTruncated).toBe(false);
  });
});
