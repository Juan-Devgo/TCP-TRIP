import { Link, useLocation } from "react-router"
import { useTranslation } from "react-i18next"
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react"
import {
  ArrowLeftRight,
  Calculator,
  FolderOpen,
  Layers,
  MessagesSquare,
  Network,
  PenLine,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "@/components/icons/ChevronDown"
import { cn } from "@/lib/utils"

type NavLink = {
  /** i18n key resolved with `t()` */
  labelKey: string
  to: string
}

type NavSection = {
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
  /** Add links here, e.g. { labelKey: "sidebar.converters.binaryDecimal", to: "/tools/converters/binary-decimal" } */
  links: NavLink[]
}

const TOOL_SECTIONS: NavSection[] = [
  {
    labelKey: "sidebar.tools.converters",
    icon: ArrowLeftRight,
    links: [
      {
        labelKey: "sidebar.converters.numberBases",
        to: "/tools/converters/number-bases",
      },
    ],
  },
  { labelKey: "sidebar.tools.calculators", icon: Calculator, links: [] },
]

const THEORY_SECTIONS: NavSection[] = [
  { labelKey: "sidebar.theory.tcpIpModel", icon: Layers, links: [] },
]

const PROTOCOL_LINKS: (NavLink & { icon: React.ComponentType<{ className?: string }> })[] = [
  { labelKey: "sidebar.protocol.builder", to: "/protocol/new", icon: PenLine },
  { labelKey: "sidebar.protocol.mine", to: "/protocol/mine", icon: FolderOpen },
  { labelKey: "sidebar.protocol.messages", to: "/messages", icon: MessagesSquare },
]

export function AppSidebar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="gap-3"
              render={<Link to="/" className="no-underline" />}
            >
              <span className="flex aspect-square size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Network className="size-5" />
              </span>
              <span className="grid flex-1 leading-tight">
                <span className="font-mono text-base font-semibold tracking-tight">
                  TCP<span className="text-primary-ink">-TRIP</span>
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {t("sidebar.tagline")}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1 py-2">
        <NavGroup
          labelKey="sidebar.groups.tools"
          sections={TOOL_SECTIONS}
          accent="text-secondary-ink"
          pathname={pathname}
        />
        <NavGroup
          labelKey="sidebar.groups.theory"
          sections={THEORY_SECTIONS}
          accent="text-secondary-ink"
          pathname={pathname}
        />

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold tracking-wide uppercase">
            {t("sidebar.groups.protocol")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {PROTOCOL_LINKS.map(({ labelKey, to, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    isActive={pathname === to}
                    tooltip={t(labelKey)}
                    render={<Link to={to} className="no-underline" />}
                  >
                    <Icon className="text-quaternary-ink" />
                    <span>{t(labelKey)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <AccountMenu />
      </SidebarFooter>
    </Sidebar>
  )
}

function NavGroup({
  labelKey,
  sections,
  accent,
  pathname,
}: {
  labelKey: string
  sections: NavSection[]
  /** Tailwind text color class applied to the section icons */
  accent: string
  pathname: string
}) {
  const { t } = useTranslation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-semibold tracking-wide uppercase">
        {t(labelKey)}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {sections.map(({ labelKey: sectionKey, icon: Icon, links }) => (
            <Collapsible
              key={sectionKey}
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton tooltip={t(sectionKey)}>
                    <Icon className={accent} />
                    <span>{t(sectionKey)}</span>
                    <ChevronDown className="ml-auto size-4 transition-transform duration-200 group-data-open/collapsible:rotate-180" />
                  </SidebarMenuButton>
                }
              />
              <CollapsibleContent>
                <SidebarMenuSub className="border-sidebar-border">
                  {links.map(({ labelKey: linkKey, to }) => (
                    <SidebarMenuSubItem key={to}>
                      <SidebarMenuSubButton
                        isActive={pathname === to}
                        render={<Link to={to} className="no-underline" />}
                      >
                        <span>{t(linkKey)}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                  {links.length === 0 && (
                    <SidebarMenuSubItem>
                      <span className="block px-2 py-1 text-xs text-sidebar-foreground/50">
                        {t("sidebar.empty")}
                      </span>
                    </SidebarMenuSubItem>
                  )}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function AccountMenu() {
  const { t } = useTranslation()
  const { isLoaded, user } = useUser()

  if (!isLoaded) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <>
      <SignedIn>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 rounded-md p-2">
              <UserButton
                appearance={{ elements: { userButtonAvatarBox: "size-8" } }}
              />
              <div className="grid flex-1 leading-tight">
                <span className="truncate text-sm font-medium">
                  {user?.fullName ?? user?.username ?? t("sidebar.account.user")}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {user?.primaryEmailAddress?.emailAddress}
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SignedIn>

      <SignedOut>
        <div className="flex flex-col gap-2 p-2">
          <p className="text-xs text-sidebar-foreground/60">
            {t("sidebar.account.hint")}
          </p>
          <SidebarSeparator className="mx-0" />
          <div className="flex gap-2">
            <SignInButton mode="modal">
              <Button variant="outline" size="sm" className="flex-1">
                {t("sidebar.account.signIn")}
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button
                size="sm"
                className={cn(
                  "flex-1 bg-primary text-primary-foreground",
                  "hover:bg-primary/80"
                )}
              >
                {t("sidebar.account.signUp")}
              </Button>
            </SignUpButton>
          </div>
        </div>
      </SignedOut>
    </>
  )
}
