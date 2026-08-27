import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Sidebar } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip"
import { Kbd, KbdGroup } from "./kbd"

export function AppSidebarTrigger() {
  const { toggleSidebar } = useSidebar()

  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" size="icon" onClick={toggleSidebar}><Sidebar /></Button>} />
      <TooltipContent side="bottom" className="max-w-xs text-left">
        <KbdGroup>
          <Kbd>Ctrl + B</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>

  )
}
