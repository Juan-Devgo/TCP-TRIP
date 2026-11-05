import { describe, expect, test } from "bun:test";

import {
  binary,
  checksum,
  ChecksumError,
  computeChecksum,
  headerToHex,
  headerToWords,
  interpret,
  onesComplementSum,
  parseHeaderHex,
  type Ipv4Header,
} from "@/features/ipv4-checksum/lib/checksum";

/** The worked example of the US: RFC 1071's classic, checksum still 0000. */
const EXAMPLE_HEX = "45 00 00 3c 1c 46 40 00 40 06 00 00 ac 10 0a 63 ac 10 0a 0c";

function example(overrides: Partial<Ipv4Header> = {}): Ipv4Header {
  return { ...parseHeaderHex(EXAMPLE_HEX), ...overrides };
}

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof ChecksumError) return error.code;
    throw error;
  }
  return undefined;
}

describe("parseHeaderHex", () => {
  test("decodes every field of the worked example", () => {
    expect(example()).toEqual({
      version: 4,
      ihl: 5,
      diffServ: 0,
      totalLength: 60,
      identification: 0x1c46,
      reserved: 0,
      df: 1,
      mf: 0,
      fragmentOffset: 0,
      ttl: 64,
      protocol: 6,
      checksum: 0,
      sourceIp: "172.16.10.99",
      destinationIp: "172.16.10.12",
    });
  });

  test("tolerates spaces, line breaks, colons and 0x prefixes", () => {
    const variants = [
      "4500003c1c4640004006 0000ac100a63ac100a0c",
      "45:00:00:3c:1c:46:40:00\n40:06:00:00:ac:10:0a:63:ac:10:0a:0c",
      "0x45 0x00 0x00 0x3C 0x1c 0x46 0x40 0x00 0x40 0x06 0x00 0x00 0xac 0x10 0x0a 0x63 0xac 0x10 0x0a 0x0c",
      "  4500 003c 1c46 4000\t4006 0000 ac10 0a63 ac10 0a0c  ",
    ];
    for (const text of variants) {
      expect(parseHeaderHex(text)).toEqual(example());
    }
  });

  test("round-trips through headerToHex", () => {
    expect(headerToHex(example())).toBe(EXAMPLE_HEX);
  });

  test("rejects what is not exactly 20 bytes of hex", () => {
    expect(codeOf(() => parseHeaderHex("4500 003c"))).toBe("pasteLength");
    expect(codeOf(() => parseHeaderHex(`${EXAMPLE_HEX} 0`))).toBe("pasteLength");
    expect(codeOf(() => parseHeaderHex(EXAMPLE_HEX.replace("ac", "zz")))).toBe(
      "pasteNotHex",
    );
  });

  test("reports the hex digits read, odd counts included", () => {
    try {
      parseHeaderHex("450");
    } catch (error) {
      expect((error as ChecksumError).detail).toBe("3");
    }
  });

  test("rejects a version other than 4 and headers with options", () => {
    expect(codeOf(() => parseHeaderHex(EXAMPLE_HEX.replace(/^45/, "65")))).toBe(
      "pasteVersion",
    );
    expect(codeOf(() => parseHeaderHex(EXAMPLE_HEX.replace(/^45/, "46")))).toBe(
      "pasteIhl",
    );
  });

  test("rejects the reserved flag bit and a Total Length below 20", () => {
    expect(
      codeOf(() => parseHeaderHex(EXAMPLE_HEX.replace("40 00 40 06", "c0 00 40 06"))),
    ).toBe("pasteReserved");
    expect(
      codeOf(() => parseHeaderHex(EXAMPLE_HEX.replace("00 00 3c", "00 00 13"))),
    ).toBe("totalLengthOutOfRange");
  });
});

describe("headerToWords", () => {
  test("groups the header into ten 16-bit words with their fields", () => {
    const words = headerToWords(example());
    expect(words.map((word) => word.value.toString(16).padStart(4, "0"))).toEqual(
      ["4500", "003c", "1c46", "4000", "4006", "0000", "ac10", "0a63", "ac10", "0a0c"],
    );
    expect(words[3]?.fields).toEqual(["reserved", "df", "mf", "fragmentOffset"]);
    expect(words[5]?.fields).toEqual(["checksum"]);
  });

  test("packs flags and Fragment Offset into one word", () => {
    const [, , , word] = headerToWords(example({ df: 0, mf: 1, fragmentOffset: 185 }));
    expect(word?.value).toBe(0x2000 | 185);
  });
});

describe("onesComplementSum", () => {
  test("follows the worked example: 24e17 → 4e19 → b1e6", () => {
    const steps = onesComplementSum(headerToWords(example()).map((w) => w.value));
    expect(steps.sum).toBe(0x24e17);
    expect(steps.folds).toEqual([
      { value: 0x24e17, low: 0x4e17, carry: 0x2, result: 0x4e19 },
    ]);
    expect(steps.folded).toBe(0x4e19);
    expect(steps.complement).toBe(0xb1e6);
  });

  test("folds a second time when the first fold carries again", () => {
    const once = onesComplementSum([0xffff, 0x0001]);
    expect(once.folds).toHaveLength(1);
    expect(once.folded).toBe(0x0001);

    const twice = onesComplementSum([0xffff, 0xffff, 0xffff, 0x0002]);
    expect(twice.sum).toBe(0x30000 - 1);
    // 0x2ffff → 0xffff + 0x2 = 0x10001 → 0x0001 + 0x1 = 0x0002
    expect(twice.folds.map((fold) => fold.result)).toEqual([0x10001, 0x0002]);
    expect(twice.folded).toBe(0x0002);
  });

  test("has nothing to fold when the sum fits in 16 bits", () => {
    const steps = onesComplementSum([0x4500, 0x0014]);
    expect(steps.folds).toEqual([]);
    expect(steps.folded).toBe(0x4514);
    expect(steps.complement).toBe(0xbaeb);
  });
});

describe("checksum", () => {
  test("calculates the checksum of a header whose Checksum is 0000", () => {
    const result = checksum(example(), "calculate");
    expect(result.result).toBe(0xb1e6);
    expect(result.interpretation).toBe("calculated");
  });

  test("a header carrying its checksum verifies to 0000", () => {
    const result = checksum(example({ checksum: 0xb1e6 }), "verify");
    expect(result.steps.folded).toBe(0xffff);
    expect(result.result).toBe(0);
    expect(result.interpretation).toBe("accepted");
  });

  test("an altered byte is rejected", () => {
    const result = checksum(example({ checksum: 0xb1e6, ttl: 63 }), "verify");
    expect(result.result).not.toBe(0);
    expect(result.interpretation).toBe("rejected");
  });

  test("calculating over a filled Checksum warns, or says it is done", () => {
    expect(checksum(example({ checksum: 0xb1e6 }), "calculate").interpretation).toBe(
      "alreadyCalculated",
    );
    expect(checksum(example({ checksum: 0x1234 }), "calculate").interpretation).toBe(
      "checksumNotZero",
    );
  });

  test("computeChecksum ignores whatever Checksum held", () => {
    expect(computeChecksum(example({ checksum: 0x1234 }))).toBe(0xb1e6);
  });

  test("refuses fields outside their width", () => {
    expect(codeOf(() => checksum(example({ ttl: 256 }), "calculate"))).toBe(
      "ttlOutOfRange",
    );
    expect(codeOf(() => checksum(example({ totalLength: 19 }), "calculate"))).toBe(
      "totalLengthOutOfRange",
    );
    expect(
      codeOf(() => checksum(example({ fragmentOffset: 8192 }), "calculate")),
    ).toBe("fragmentOffsetOutOfRange");
    expect(codeOf(() => checksum(example({ sourceIp: "10.0.0" }), "calculate"))).toBe(
      "invalidIp",
    );
  });
});

describe("interpret", () => {
  test("covers the four readings of the US", () => {
    expect(interpret("calculate", 0, 0xb1e6)).toBe("calculated");
    expect(interpret("calculate", 0xb1e6, 0)).toBe("alreadyCalculated");
    expect(interpret("verify", 0xb1e6, 0)).toBe("accepted");
    expect(interpret("verify", 0xb1e6, 0x0100)).toBe("rejected");
  });
});

describe("binary", () => {
  test("splits into nibbles from the right", () => {
    expect(binary(0x4e19, 16)).toBe("0100 1110 0001 1001");
    expect(binary(0x10001, 17)).toBe("1 0000 0000 0000 0001");
  });
});
