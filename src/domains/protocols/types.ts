export type FieldType = 'uint' | 'flags' | 'ascii' | 'hex' | 'ipv4' | 'enum' | 'padding' | 'composite';

// SubFieldType excludes composite (no recursive composites) and ipv4 (always 4B, too rigid for sub-fields)
export type SubFieldType = 'uint' | 'flags' | 'ascii' | 'hex' | 'padding' | 'enum';

export interface DocLink {
  label: string;
  url: string;
}

export interface FlagBit {
  name: string;
  value: boolean;   // kept for future header-editor use; not exposed in structure editor
  reserved: boolean;
}

export interface EnumOption {
  value: number;
  label: string;
}

export interface SubField {
  id: string;
  name: string;
  type: SubFieldType;
  sizeBits: number;
  meaning: string;
}

export interface ProtocolField {
  id: string;
  name: string;
  type: FieldType;
  sizeBytes: number;
  sizeBits?: number;
  meaning: string;
  docLinks?: DocLink[];
  // Value fields kept for future header-editor view (not shown in structure editor)
  uintValue?: number;
  flagBits?: FlagBit[];
  asciiValue?: string;
  asciiFixedSize?: boolean;
  hexValue?: string;
  ipv4Value?: [number, number, number, number];
  enumOptions?: EnumOption[];
  enumSelected?: number;
  paddingByte?: number;
  subFields?: SubField[];
}

export interface Protocol {
  id: string;
  name: string;
  description: string;
  fields: ProtocolField[];
  createdAt: Date;
}
