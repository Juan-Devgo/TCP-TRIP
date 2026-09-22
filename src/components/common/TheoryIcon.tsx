import {
  Binary,
  BookOpen,
  Cable,
  FileText,
  Globe,
  GraduationCap,
  Layers,
  Mail,
  Network,
  Presentation,
  Radio,
  Route,
  Server,
  Shield,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import {
  DEFAULT_THEORY_ICON,
  type TheoryIconName,
} from "@/lib/theory/contract";

/**
 * The icon behind each name an administrator can choose.
 *
 * A `Record` over the name union rather than a lookup by string: adding a name
 * to `THEORY_ICON_NAMES` without adding it here is a compile error, which is
 * the only thing keeping the allowlist and the rendering in step.
 */
const ICONS: Record<TheoryIconName, LucideIcon> = {
  "book-open": BookOpen,
  layers: Layers,
  network: Network,
  globe: Globe,
  route: Route,
  cable: Cable,
  server: Server,
  mail: Mail,
  radio: Radio,
  shield: Shield,
  binary: Binary,
  waypoints: Waypoints,
  "file-text": FileText,
  presentation: Presentation,
  "graduation-cap": GraduationCap,
};

/** The Lucide component for a stored icon name. */
export function theoryIcon(name: TheoryIconName): LucideIcon {
  return ICONS[name] ?? ICONS[DEFAULT_THEORY_ICON];
}

/** The icon itself, for the picker and the sidebar. */
export function TheoryIcon({
  name,
  className,
}: {
  name: TheoryIconName;
  className?: string;
}) {
  const Icon = theoryIcon(name);
  return <Icon className={className} />;
}
