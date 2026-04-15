import type { EditorProps } from "./types";
import UintEditor from "./UintEditor";
import FlagsEditor from "./FlagsEditor";
import AsciiEditor from "./AsciiEditor";
import HexEditor from "./HexEditor";
import Ipv4Editor from "./Ipv4Editor";
import EnumEditor from "./EnumEditor";
import PaddingEditor from "./PaddingEditor";
import CompositeEditor from "./CompositeEditor";

export default function FieldEditor({ field, onChange }: EditorProps) {
  switch (field.type) {
    case "uint":
      return <UintEditor field={field} onChange={onChange} />;
    case "flags":
      return <FlagsEditor field={field} onChange={onChange} />;
    case "ascii":
      return <AsciiEditor field={field} onChange={onChange} />;
    case "hex":
      return <HexEditor field={field} onChange={onChange} />;
    case "ipv4":
      return <Ipv4Editor field={field} onChange={onChange} />;
    case "enum":
      return <EnumEditor field={field} onChange={onChange} />;
    case "padding":
      return <PaddingEditor field={field} onChange={onChange} />;
    case "composite":
      return <CompositeEditor field={field} onChange={onChange} />;
    default:
      return null;
  }
}
