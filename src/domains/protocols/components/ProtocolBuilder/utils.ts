import type { ProtocolField, Protocol } from '../../types';

export const TYPE_CONFIG = {
  uint:      { bg: 'bg-blue-900/10',    border: 'border-blue-600/50',    text: 'text-blue-300',    dot: 'bg-blue-400',    label: 'uint',      labelFull: 'Entero sin signo' },
  flags:     { bg: 'bg-amber-900/10',   border: 'border-amber-600/50',   text: 'text-amber-300',   dot: 'bg-amber-400',   label: 'flags',     labelFull: 'Flags de bits' },
  ascii:     { bg: 'bg-emerald-900/10', border: 'border-emerald-600/50', text: 'text-emerald-300', dot: 'bg-emerald-400', label: 'ascii',     labelFull: 'Texto ASCII' },
  hex:       { bg: 'bg-violet-900/10',  border: 'border-violet-600/50',  text: 'text-violet-300',  dot: 'bg-violet-400',  label: 'hex',       labelFull: 'Hex raw' },
  ipv4:      { bg: 'bg-cyan-900/10',    border: 'border-cyan-600/50',    text: 'text-cyan-300',    dot: 'bg-cyan-400',    label: 'ipv4',      labelFull: 'Dirección IPv4' },
  enum:      { bg: 'bg-orange-900/10',  border: 'border-orange-600/50',  text: 'text-orange-300',  dot: 'bg-orange-400',  label: 'enum',      labelFull: 'Enumeración' },
  padding:   { bg: 'bg-zinc-900/20',    border: 'border-zinc-600/50',    text: 'text-zinc-500',    dot: 'bg-zinc-500',    label: 'padding',   labelFull: 'Relleno' },
  composite: { bg: 'bg-fuchsia-900/10', border: 'border-fuchsia-600/50', text: 'text-fuchsia-300', dot: 'bg-fuchsia-400', label: 'composite', labelFull: 'Campo compuesto' },
} as const;

export const TYPE_TOOLTIPS: Record<string, string> = {
  uint:      'Usa uint para valores numéricos como puertos, números de secuencia o contadores.',
  flags:     'Usa flags cuando necesites múltiples condiciones booleanas en pocos bits, como SYN, ACK y FIN en TCP.',
  ascii:     'Usa ascii para campos de texto plano como métodos HTTP o nombres de host.',
  hex:       'Usa hex para checksums, direcciones MAC o datos binarios arbitrarios.',
  ipv4:      'Usa ipv4 para campos que contienen una dirección IPv4 (siempre 4 bytes).',
  enum:      'Usa enum cuando el campo tiene un conjunto finito de valores significativos.',
  padding:   'Usa padding para alinear campos o reservar espacio con bytes de relleno.',
  composite: 'Usa composite para definir un campo que contiene subcampos con granularidad de bits, útil cuando los subcampos no se alinean a bytes.',
};

export const TYPE_DESCRIPTIONS: Record<string, string> = {
  uint:      'Entero sin signo (1–8 bytes)',
  flags:     'Flags de bits nombradas',
  ascii:     'Texto en ASCII',
  hex:       'Valor hexadecimal',
  ipv4:      'Dirección IPv4 (4 bytes)',
  enum:      'Enumeración de valores',
  padding:   'Relleno / Alineación',
  composite: 'Campo compuesto (subcampos en bits)',
};

export function getFieldBitSize(field: ProtocolField): number {
  return field.sizeBits ?? Math.round(field.sizeBytes * 8);
}

export function computeFieldOffsets(fields: ProtocolField[]): number[] {
  const offsets: number[] = [];
  let offset = 0;
  for (const field of fields) {
    offsets.push(offset);
    offset += getFieldBitSize(field);
  }
  return offsets;
}

export function computeBinaryHex(protocol: Protocol): string {
  const bytes: number[] = [];

  for (const field of protocol.fields) {
    switch (field.type) {
      case 'uint': {
        const val = field.uintValue ?? 0;
        const size = field.sizeBytes;
        for (let i = size - 1; i >= 0; i--) bytes.push((val >>> (i * 8)) & 0xff);
        break;
      }
      case 'flags': {
        const bits = field.flagBits ?? [];
        let byte = 0;
        for (let i = 0; i < bits.length; i++) {
          if (bits[i]!.value) byte |= 1 << (bits.length - 1 - i);
        }
        bytes.push(byte);
        break;
      }
      case 'ascii': {
        const text = field.asciiValue ?? '';
        const size = field.sizeBytes;
        for (let i = 0; i < size; i++) bytes.push(i < text.length ? text.charCodeAt(i) & 0xff : 0x00);
        break;
      }
      case 'hex': {
        const hexStr = (field.hexValue ?? '').replace(/[^0-9A-Fa-f]/g, '');
        const size = field.sizeBytes;
        for (let i = 0; i < size; i++) {
          const pair = hexStr.slice(i * 2, i * 2 + 2);
          bytes.push(pair ? parseInt(pair, 16) : 0x00);
        }
        break;
      }
      case 'ipv4': {
        const [a, b, c, d] = field.ipv4Value ?? [0, 0, 0, 0];
        bytes.push(a ?? 0, b ?? 0, c ?? 0, d ?? 0);
        break;
      }
      case 'enum': {
        const val = field.enumSelected ?? 0;
        if (field.sizeBytes >= 2) bytes.push((val >> 8) & 0xff, val & 0xff);
        else bytes.push(val & 0xff);
        break;
      }
      case 'padding': {
        const padByte = field.paddingByte ?? 0x00;
        for (let i = 0; i < field.sizeBytes; i++) bytes.push(padByte);
        break;
      }
      case 'composite': {
        const subFields = field.subFields ?? [];
        const totalBits = field.sizeBytes * 8;
        let packed = 0n;
        let shift = BigInt(totalBits);
        for (const sf of subFields) {
          shift -= BigInt(sf.sizeBits);
          const val = 0n; // values are defined in the header editor, not in the structure
          const mask = (1n << BigInt(sf.sizeBits)) - 1n;
          packed |= (val & mask) << shift;
        }
        for (let i = field.sizeBytes - 1; i >= 0; i--) {
          bytes.push(Number((packed >> BigInt(i * 8)) & 0xffn));
        }
        break;
      }
    }
  }

  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

export function computeBinaryHexGrouped(protocol: Protocol): Array<{ hex: string; groupIndex: number }> {
  const raw = computeBinaryHex(protocol);
  if (!raw) return [];

  const byteTokens = raw.split(' ');
  const result: Array<{ hex: string; groupIndex: number }> = [];

  for (let i = 0; i < byteTokens.length; i++) {
    const groupIndex = Math.floor(i / 4);
    result.push({ hex: byteTokens[i]!, groupIndex });
  }

  return result;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function generateSubId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
