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
import { ChevronDown, Network } from "lucide-react"

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

import { NAV_TREE, type NavItem } from "@/config/navigation"
import { cn } from "@/lib/utils"

/** Tailwind text color applied to every nav icon. */
const ICON_ACCENT = "text-secondary-ink"

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
        {NAV_TREE.map((group) => (
          <NavGroup key={group.path} group={group} pathname={pathname} />
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <AccountMenu />
      </SidebarFooter>
    </Sidebar>
  )
}

function NavGroup({
  group,
  pathname,
}: {
  /** A top-level node of `NAV_TREE`; its children are sections or links. */
  group: NavItem
  pathname: string
}) {
  const { t } = useTranslation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-semibold tracking-wide uppercase">
        {t(group.titleKey)}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {group.children.map((item) =>
            item.branch ? (
              <NavSection key={item.path} section={item} pathname={pathname} />
            ) : (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  isActive={pathname === item.path}
                  tooltip={t(item.titleKey)}
                  render={<Link to={item.path} className="no-underline" />}
                >
                  {item.icon && <item.icon className={ICON_ACCENT} />}
                  <span>{t(item.titleKey)}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ),
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/** A collapsible section: a branch node whose children are page links. */
function NavSection({
  section,
  pathname,
}: {
  section: NavItem
  pathname: string
}) {
  const { t } = useTranslation()
  const Icon = section.icon

  return (
    <Collapsible className="group/collapsible" render={<SidebarMenuItem />}>
      <CollapsibleTrigger
        render={
          <SidebarMenuButton tooltip={t(section.titleKey)}>
            {Icon && <Icon className={ICON_ACCENT} />}
            <span>{t(section.titleKey)}</span>
            <ChevronDown className="ml-auto size-4 transition-transform duration-200 group-data-open/collapsible:rotate-180" />
          </SidebarMenuButton>
        }
      />
      <CollapsibleContent>
        <SidebarMenuSub className="border-sidebar-border">
          {section.children.map((link) => (
            <SidebarMenuSubItem key={link.path}>
              <SidebarMenuSubButton
                isActive={pathname === link.path}
                render={<Link to={link.path} className="no-underline" />}
              >
                <span>{t(link.titleKey)}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
          {section.children.length === 0 && (
            <SidebarMenuSubItem>
              <span className="block px-2 py-1 text-xs text-sidebar-foreground/50">
                {t("sidebar.empty")}
              </span>
            </SidebarMenuSubItem>
          )}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
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
