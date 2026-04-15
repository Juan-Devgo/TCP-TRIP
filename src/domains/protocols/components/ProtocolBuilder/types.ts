import type { ProtocolField } from "../../types";

export interface EditorProps {
  field: ProtocolField;
  onChange: (updates: Partial<ProtocolField>) => void;
}

export interface FieldSegment {
  field: ProtocolField;
  startBitInRow: number;
  widthBits: number;
  isStart: boolean;
  isEnd: boolean;
  bitOffsetInField: number;
}
