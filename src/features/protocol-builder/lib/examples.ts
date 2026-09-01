/**
 * Real headers to start from. Field *names* stay as the RFCs write them —
 * `Source Port` is the same term in every language and in every capture — while
 * the meaning of each field is a locale key, so the example reads in the
 * language the app is in.
 */

import type { Protocol, ProtocolField, ProtocolNode, RulerWidth } from "./protocol";

type ExampleLeaf = {
  /** Suffix of the id and of the meaning's locale key. */
  key: string;
  name: string;
  typeId: string;
  length: number;
  options?: Record<string, string>;
};

type ExampleNode =
  | { kind: "single"; field: ExampleLeaf }
  | { kind: "group"; key: string; name: string; children: ExampleLeaf[] };

export type ProtocolExample = {
  id: string;
  rulerWidth: RulerWidth;
  nodes: ExampleNode[];
};

const leaf = (
  key: string,
  name: string,
  typeId: string,
  length: number,
  options?: Record<string, string>,
): { kind: "single"; field: ExampleLeaf } => ({
  kind: "single",
  field: options ? { key, name, typeId, length, options } : { key, name, typeId, length },
});

/** Cycled by the `Example` action, shortest header first. */
export const PROTOCOL_EXAMPLES: ProtocolExample[] = [
  {
    id: "udp",
    rulerWidth: 32,
    nodes: [
      leaf("sourcePort", "Source Port", "port", 16),
      leaf("destinationPort", "Destination Port", "port", 16),
      leaf("length", "Length", "uint", 16),
      leaf("checksum", "Checksum", "checksum", 16, {
        algorithm: "Internet checksum (RFC 1071)",
      }),
    ],
  },
  {
    id: "ipv4",
    rulerWidth: 32,
    nodes: [
      leaf("version", "Version", "uint", 4),
      leaf("ihl", "IHL", "uint", 4),
      leaf("dscp", "DSCP", "uint", 6),
      leaf("ecn", "ECN", "uint", 2),
      leaf("totalLength", "Total Length", "uint", 16),
      leaf("identification", "Identification", "uint", 16),
      {
        kind: "group",
        key: "flags",
        name: "Flags",
        children: [
          { key: "reservedFlag", name: "Reserved", typeId: "reserved", length: 1 },
          { key: "dontFragment", name: "DF", typeId: "flag", length: 1 },
          { key: "moreFragments", name: "MF", typeId: "flag", length: 1 },
        ],
      },
      leaf("fragmentOffset", "Fragment Offset", "uint", 13),
      leaf("ttl", "TTL", "uint", 8),
      leaf("protocol", "Protocol", "enum", 8, {
        values: "1 = ICMP\n6 = TCP\n17 = UDP",
      }),
      leaf("headerChecksum", "Header Checksum", "checksum", 16, {
        algorithm: "Internet checksum (RFC 1071)",
      }),
      leaf("sourceAddress", "Source Address", "ipv4", 32),
      leaf("destinationAddress", "Destination Address", "ipv4", 32),
    ],
  },
  {
    id: "ethernet",
    rulerWidth: 16,
    nodes: [
      leaf("destinationMac", "Destination MAC", "mac", 48),
      leaf("sourceMac", "Source MAC", "mac", 48),
      leaf("etherType", "EtherType", "enum", 16, {
        values: "0x0800 = IPv4\n0x0806 = ARP\n0x86DD = IPv6",
      }),
    ],
  },
];

/** Resolves an example into a protocol, with `t` supplying every meaning. */
export function buildExampleProtocol(
  example: ProtocolExample,
  t: (key: string) => string,
): Protocol {
  const base = `tools.protocolBuilder.examples.${example.id}`;

  const toField = (item: ExampleLeaf): ProtocolField => ({
    id: `${example.id}-${item.key}`,
    typeId: item.typeId,
    name: item.name,
    meaning: t(`${base}.fields.${item.key}`),
    length: item.length,
    documentation: "",
    options: item.options ?? {},
  });

  const nodes: ProtocolNode[] = example.nodes.map((node) =>
    node.kind === "single"
      ? { kind: "single", id: `${example.id}-${node.field.key}`, field: toField(node.field) }
      : {
          kind: "group",
          id: `${example.id}-${node.key}`,
          name: node.name,
          meaning: t(`${base}.groups.${node.key}`),
          documentation: "",
          children: node.children.map(toField),
        },
  );

  return { name: t(`${base}.name`), rulerWidth: example.rulerWidth, nodes };
}
