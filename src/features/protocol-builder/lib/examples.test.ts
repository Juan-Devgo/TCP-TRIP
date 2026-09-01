import { describe, expect, test } from "bun:test";

import {
  buildExampleProtocol,
  PROTOCOL_EXAMPLES,
} from "@/features/protocol-builder/lib/examples";
import {
  layoutProtocol,
  totalBits,
  validateProtocol,
} from "@/features/protocol-builder/lib/protocol";
import { renderProtocolSvg } from "@/features/protocol-builder/lib/protocolExport";

/** Stands in for `t`: the key itself is a non-empty string, which is enough. */
const t = (key: string) => key;

describe("examples", () => {
  test("every example is complete enough to be saved", () => {
    for (const example of PROTOCOL_EXAMPLES) {
      expect(validateProtocol(buildExampleProtocol(example, t))).toEqual([]);
    }
  });

  test("the headers are the size the RFCs say they are", () => {
    const sizes = Object.fromEntries(
      PROTOCOL_EXAMPLES.map((example) => [
        example.id,
        totalBits(buildExampleProtocol(example, t)),
      ]),
    );

    expect(sizes["udp"]).toBe(64);
    expect(sizes["ipv4"]).toBe(160);
    expect(sizes["ethernet"]).toBe(112);
  });

  test("the IPv4 header draws as five 32-bit rows", () => {
    const ipv4 = PROTOCOL_EXAMPLES.find((example) => example.id === "ipv4")!;
    expect(layoutProtocol(buildExampleProtocol(ipv4, t))).toHaveLength(5);
  });

  test("the SVG export carries one box per drawn segment", () => {
    const udp = PROTOCOL_EXAMPLES[0]!;
    const protocol = buildExampleProtocol(udp, t);
    const svg = renderProtocolSvg(protocol, {
      free: "Free",
      untitled: "Untitled",
      bits: (count) => `${count} bits`,
    });

    const segments = layoutProtocol(protocol).flatMap((row) => row.segments);
    // One background rect for the page, plus one per segment.
    expect(svg.match(/<rect /g)).toHaveLength(segments.length + 1);
    expect(svg).toContain("</svg>");
  });
});
