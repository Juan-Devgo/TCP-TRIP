import { describe, expect, test } from "bun:test";

import {
  AsciiError,
  codesToText,
  convertCodesBase,
  decodeBytes,
  encodeText,
  formatCodes,
  groupBytes,
  parseCodes,
  textToCodes,
} from "@/features/ascii-converter/lib/ascii";

describe("encodeText", () => {
  test("ASCII mode gives one byte per character", () => {
    expect(encodeText("AB", "ascii")).toEqual([[65], [66]]);
  });

  test("ASCII mode reaches the full 8 bits", () => {
    expect(encodeText("ÿ", "ascii")).toEqual([[255]]);
  });

  test("ASCII mode rejects a character above 255", () => {
    expect(() => encodeText("€", "ascii")).toThrow(AsciiError);
    try {
      encodeText("a€", "ascii");
    } catch (error) {
      expect((error as AsciiError).code).toBe("unrepresentable");
      expect((error as AsciiError).detail).toBe("€");
    }
  });

  test("Unicode mode groups the UTF-8 bytes of each character", () => {
    expect(encodeText("é", "unicode")).toEqual([[0xc3, 0xa9]]);
    expect(encodeText("€", "unicode")).toEqual([[0xe2, 0x82, 0xac]]);
    // 4 bytes = the 32-bit ceiling the Unicode tab advertises.
    expect(encodeText("😀", "unicode")).toEqual([[0xf0, 0x9f, 0x98, 0x80]]);
  });

  test("Unicode mode keeps a surrogate pair as one character", () => {
    expect(encodeText("😀", "unicode")).toHaveLength(1);
  });
});

describe("formatCodes", () => {
  test("pads every base to its fixed byte width", () => {
    expect(formatCodes([[65]], 2)).toBe("01000001");
    expect(formatCodes([[65]], 8)).toBe("101");
    expect(formatCodes([[65]], 10)).toBe("065");
    expect(formatCodes([[65]], 16)).toBe("41");
  });

  test("joins the bytes of one character and spaces the characters", () => {
    expect(formatCodes([[0xc3, 0xa9], [65]], 16)).toBe("C3A9 41");
  });
});

describe("parseCodes", () => {
  test("reads a stream with separators", () => {
    expect(parseCodes("41 42", 16)).toEqual({ bytes: [65, 66], incomplete: false });
    expect(parseCodes("41,42;43", 16).bytes).toEqual([65, 66, 67]);
  });

  test("reads a stream without separators by fixed byte width", () => {
    expect(parseCodes("0100000101000010", 2).bytes).toEqual([65, 66]);
    expect(parseCodes("065066", 10).bytes).toEqual([65, 66]);
  });

  test("keeps a half typed byte out of the result instead of failing", () => {
    expect(parseCodes("01000001010", 2)).toEqual({
      bytes: [65],
      incomplete: true,
    });
  });

  test("rejects a digit that is illegal in the base", () => {
    expect(() => parseCodes("41 4G", 16)).toThrow(AsciiError);
    expect(() => parseCodes("012", 2)).toThrow(AsciiError);
  });

  test("rejects a partial group with an illegal digit right away", () => {
    try {
      parseCodes("41 9", 8);
    } catch (error) {
      expect((error as AsciiError).code).toBe("invalidDigit");
    }
  });

  test("rejects a group above 255", () => {
    try {
      parseCodes("999", 10);
    } catch (error) {
      expect((error as AsciiError).code).toBe("outOfRange");
    }
    expect(() => parseCodes("777", 8)).toThrow(AsciiError);
  });

  test("is empty for blank input", () => {
    expect(parseCodes("   ", 16)).toEqual({ bytes: [], incomplete: false });
  });
});

describe("decodeBytes", () => {
  test("ASCII mode maps each byte to its character", () => {
    expect(decodeBytes([65, 66], "ascii")).toBe("AB");
    expect(decodeBytes([255], "ascii")).toBe("ÿ");
  });

  test("Unicode mode decodes UTF-8", () => {
    expect(decodeBytes([0xc3, 0xa9], "unicode")).toBe("é");
  });

  test("Unicode mode does not blank the pane on a half typed sequence", () => {
    expect(decodeBytes([65, 0xc3], "unicode")).toBe("A�");
  });
});

describe("round trips", () => {
  const bases = [2, 8, 10, 16] as const;

  test("text survives text → codes → text in ASCII mode", () => {
    for (const base of bases) {
      expect(codesToText(textToCodes("Hola ÿ!", base, "ascii"), base, "ascii")).toBe(
        "Hola ÿ!",
      );
    }
  });

  test("text survives text → codes → text in Unicode mode", () => {
    for (const base of bases) {
      const text = "Ñandú 😀 你好";
      expect(codesToText(textToCodes(text, base, "unicode"), base, "unicode")).toBe(
        text,
      );
    }
  });

  test("an empty text gives an empty stream", () => {
    expect(textToCodes("", 16, "ascii")).toBe("");
  });
});

describe("groupBytes", () => {
  test("ASCII mode gives one byte per group", () => {
    expect(groupBytes([65, 66], "ascii")).toEqual([[65], [66]]);
  });

  test("Unicode mode rebuilds the UTF-8 groups from the lead bytes", () => {
    expect(groupBytes([65, 0xc3, 0xa9, 0xf0, 0x9f, 0x98, 0x80], "unicode")).toEqual([
      [65],
      [0xc3, 0xa9],
      [0xf0, 0x9f, 0x98, 0x80],
    ]);
  });
});

describe("convertCodesBase", () => {
  test("re-renders the same bytes in the target base", () => {
    expect(convertCodesBase("41 42", 16, 2, "ascii")).toBe("01000001 01000010");
    expect(convertCodesBase("065 066", 10, 16, "ascii")).toBe("41 42");
  });

  test("keeps characters grouped in Unicode mode", () => {
    expect(convertCodesBase("C3A9 41", 16, 10, "unicode")).toBe("195169 065");
  });

  test("is empty for blank input", () => {
    expect(convertCodesBase("", 16, 2, "ascii")).toBe("");
  });
});
