import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * One line saying what a control does, on every control of the editor's bars.
 *
 * It composes with the child through Base UI's `render` prop, so the trigger is
 * the button (or the select trigger) itself rather than a wrapper: an extra
 * element around a `SelectTrigger` would break the select's own layout, and a
 * wrapper around a `Button` would swallow its focus ring.
 */
export function Tip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
