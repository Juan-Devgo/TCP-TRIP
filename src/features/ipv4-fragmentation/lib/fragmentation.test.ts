import { describe, expect, test } from "bun:test";

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
  fragmentCount,
  FragmentationError,
  HEADER_DEFAULTS,
  isValidIdentification,
  isValidIpv4,
  isValidProtocol,
  isValidTtl,
} from "@/features/ipv4-fragmentation/lib/fragmentation";

function codeOf(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (cause) {
    return cause instanceof FragmentationError ? cause.code : "unexpected";
  }
}

describe("fragment", () => {
  test("splits 4000 bytes over a 1500-byte MTU into three fragments", () => {
    const result = fragment(4000, 1500);
    expect(result.needsFragmentation).toBe(true);
    expect(result.dataBytes).toBe(3980);
    expect(result.maxFragmentData).toBe(1480);
    expect(
      result.fragments.map(({ header, dataBytes }) => ({
        totalLength: header.totalLength,
        dataBytes,
        mf: header.mf,
        offset: header.fragmentOffset,
      })),
    ).toEqual([
      { totalLength: 1500, dataBytes: 1480, mf: 1, offset: 0 },
      { totalLength: 1500, dataBytes: 1480, mf: 1, offset: 185 },
      { totalLength: 1040, dataBytes: 1020, mf: 0, offset: 370 },
    ]);
  });

  test("every fragment keeps the fields the original carries", () => {
    const { original, fragments } = fragment(9000, 596, {
      identification: 7,
      ttl: 32,
      protocol: 6,
      sourceIp: "1.2.3.4",
      destinationIp: "5.6.7.8",
    });
    // Everything but Total Length, MF and Fragment Offset.
    const sameAsOriginal = { ...original, totalLength: 0, mf: 0, fragmentOffset: 0 };
    for (const { header } of fragments) {
      expect({ ...header, totalLength: 0, mf: 0, fragmentOffset: 0 }).toEqual(
        sameAsOriginal,
      );
      expect(header.df).toBe(0);
    }
  });

  test("fragments cover the payload end to end with no gap", () => {
    const { fragments, dataBytes } = fragment(12345, 508);
    let next = 0;
    for (const { dataStart, dataBytes: size, header } of fragments) {
      expect(dataStart).toBe(next);
      expect(header.fragmentOffset * 8).toBe(dataStart);
      next += size;
    }
    expect(next).toBe(dataBytes);
    expect(fragments.filter(({ header }) => header.mf === 0)).toHaveLength(1);
    expect(fragments.at(-1)?.header.mf).toBe(0);
  });

  test("a datagram that fits the MTU is sent as is", () => {
    for (const totalLength of [1000, 1500]) {
      const result = fragment(totalLength, 1500);
      expect(result.needsFragmentation).toBe(false);
      expect(result.fragments).toHaveLength(1);
      expect(result.fragments[0]?.header).toEqual(result.original);
      expect(result.original.mf).toBe(0);
      expect(result.original.fragmentOffset).toBe(0);
    }
  });

  test("falls back to the defaults for the optional fields", () => {
    const { original } = fragment(100, 1500);
    expect(original).toMatchObject({
      ...HEADER_DEFAULTS,
      identification: DEFAULT_IDENTIFICATION,
      ttl: DEFAULT_TTL,
      protocol: DEFAULT_PROTOCOL,
      sourceIp: DEFAULT_SOURCE_IP,
      destinationIp: DEFAULT_DESTINATION_IP,
      checksum: 0,
    });
  });

  test("matches a byte-by-byte reference split on every MTU it accepts", () => {
    for (let mtu = 68; mtu <= 1500; mtu += 8) {
      for (const totalLength of [21, 67, 68, 69, mtu, mtu + 1, 4000, 65535]) {
        const { fragments, dataBytes } = fragment(totalLength, mtu);
        expect(fragments).toHaveLength(fragmentCount(totalLength, mtu));

        // The reference walks the payload one byte at a time.
        const step = totalLength <= mtu ? dataBytes : mtu - 20;
        let start = 0;
        fragments.forEach(({ header, dataBytes: size, dataStart }, index) => {
          let expected = 0;
          while (expected < step && start + expected < dataBytes) expected++;
          const isLast = index === fragments.length - 1;
          expect(dataStart).toBe(start);
          expect(size).toBe(expected);
          expect(header.totalLength).toBe(expected + 20);
          expect(header.totalLength).toBeLessThanOrEqual(mtu);
          expect(header.mf).toBe(isLast ? 0 : 1);
          expect(header.fragmentOffset).toBe(start / 8);
          start += expected;
        });
        expect(start).toBe(dataBytes);
      }
    }
  });

  test("rejects what the form would flag", () => {
    expect(codeOf(() => fragment(4000, 576))).toBe("mtuNotMultipleOf8");
    expect(codeOf(() => fragment(4000, 67))).toBe("mtuOutOfRange");
    expect(codeOf(() => fragment(20, 1500))).toBe("totalLengthOutOfRange");
    expect(codeOf(() => fragment(4000, 1500, { identification: 65536 }))).toBe(
      "invalidIdentification",
    );
    expect(codeOf(() => fragment(4000, 1500, { ttl: 256 }))).toBe("invalidTtl");
    expect(codeOf(() => fragment(4000, 1500, { protocol: -1 }))).toBe(
      "invalidProtocol",
    );
    expect(codeOf(() => fragment(4000, 1500, { sourceIp: "1.2.3" }))).toBe(
      "invalidIp",
    );
  });
});

describe("checkDataSum", () => {
  test("adds the data back up to the original Total Length", () => {
    expect(checkDataSum(fragment(4000, 1500))).toEqual({
      terms: [
        { bytes: 1480, count: 2 },
        { bytes: 1020, count: 1 },
      ],
      sum: 3980,
      total: 4000,
      matches: true,
    });
    expect(checkDataSum(fragment(1000, 1500))).toMatchObject({
      terms: [{ bytes: 980, count: 1 }],
      total: 1000,
      matches: true,
    });
  });

  test("holds for every split, including the longest", () => {
    for (const [totalLength, mtu] of [[65535, 68], [3000, 1500], [2981, 1500]]) {
      expect(checkDataSum(fragment(totalLength!, mtu!)).matches).toBe(true);
    }
  });

  test("flags a split that lost bytes", () => {
    const result = fragment(4000, 1500);
    const broken = { ...result, fragments: result.fragments.slice(0, -1) };
    expect(checkDataSum(broken)).toMatchObject({ total: 2980, matches: false });
  });
});

describe("fragmentCount", () => {
  test("is 1 when the datagram fits and rounds up otherwise", () => {
    expect(fragmentCount(1500, 1500)).toBe(1);
    expect(fragmentCount(4000, 1500)).toBe(3);
    expect(fragmentCount(65535, 68)).toBe(1365);
  });
});

describe("checkMtu", () => {
  test("accepts the RFC 791 range boundaries", () => {
    expect(checkMtu(68)).toBeNull();
    expect(checkMtu(1500)).toBeNull();
    expect(checkMtu(67)).toBe("mtuOutOfRange");
    expect(checkMtu(65536)).toBe("mtuOutOfRange");
    expect(checkMtu(1500.5)).toBe("mtuOutOfRange");
  });

  test("rejects an MTU whose data is not a whole number of 8-byte blocks", () => {
    expect(checkMtu(576)).toBe("mtuNotMultipleOf8");
    // 65535 − 20 = 65515, not a multiple of 8.
    expect(checkMtu(65535)).toBe("mtuNotMultipleOf8");
    expect(checkMtu(596)).toBeNull();
  });
});

describe("checkTotalLength", () => {
  test("needs a header plus one byte, and fits 16 bits", () => {
    expect(checkTotalLength(21)).toBeNull();
    expect(checkTotalLength(65535)).toBeNull();
    expect(checkTotalLength(20)).toBe("totalLengthOutOfRange");
    expect(checkTotalLength(65536)).toBe("totalLengthOutOfRange");
  });
});

describe("validators", () => {
  test("identification is 16 bits", () => {
    expect(isValidIdentification(0)).toBe(true);
    expect(isValidIdentification(65535)).toBe(true);
    expect(isValidIdentification(-1)).toBe(false);
    expect(isValidIdentification(65536)).toBe(false);
  });

  test("TTL and protocol are 8 bits", () => {
    for (const isValid of [isValidTtl, isValidProtocol]) {
      expect(isValid(0)).toBe(true);
      expect(isValid(255)).toBe(true);
      expect(isValid(-1)).toBe(false);
      expect(isValid(256)).toBe(false);
      expect(isValid(1.5)).toBe(false);
    }
  });

  test("addresses are four canonical octets", () => {
    expect(isValidIpv4("192.168.1.10")).toBe(true);
    expect(isValidIpv4("256.0.0.1")).toBe(false);
    expect(isValidIpv4("01.2.3.4")).toBe(false);
    expect(isValidIpv4("1.2.3")).toBe(false);
  });
});
