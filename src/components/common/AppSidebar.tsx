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

import { TheoryIcon } from "@/components/common/TheoryIcon"
import { NAV_TREE, isVisibleTo, type NavItem } from "@/config/navigation"
import { useAppRole } from "@/hooks/useAppRole"
import { useReadingProgressIndex, useTheoryMenu } from "@/hooks/useTheoryMenu"
import type { AppRole } from "@/lib/auth/roles"
import {
  isProgressComplete,
  publishedPresentationPath,
} from "@/lib/presentations/contract"
import { cn } from "@/lib/utils"

/**
 * The group whose contents an administrator builds at runtime.
 *
 * Its static nodes (the TCP/IP model, and the reader every entry opens) stay in
 * `src/config/navigation.ts`; the sections below them are rows in
 * `theory_sections`, so publishing a presentation and putting it in the
 * syllabus no longer means editing the navigation tree.
 */
const THEORY_GROUP_PATH = "/theory"

/** Tailwind text color applied to every nav icon. */
const ICON_ACCENT = "text-secondary-ink"

export function AppSidebar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  // Hiding only: a student who types a teacher's path still gets a 403 from
  // the server, which is where the role actually decides anything.
  const { role } = useAppRole()

  const groups = NAV_TREE.filter((group) => isVisibleTo(group, role)).filter(
    // A group whose every entry is hidden is an empty heading, not a group.
    (group) => group.children.some((item) => isVisibleTo(item, role)),
  )

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
        {groups.map((group) => (
          <NavGroup key={group.path} group={group} pathname={pathname} role={role} />
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
  role,
}: {
  /** A top-level node of `NAV_TREE`; its children are sections or links. */
  group: NavItem
  pathname: string
  role: AppRole
}) {
  const { t } = useTranslation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-semibold tracking-wide uppercase">
        {t(group.titleKey)}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {group.children.filter((item) => isVisibleTo(item, role)).map((item) =>
            item.branch ? (
              <NavSection
                key={item.path}
                section={item}
                pathname={pathname}
                role={role}
              />
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

          {group.path === THEORY_GROUP_PATH && <TheoryMenuSections pathname={pathname} />}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/**
 * The Theory sections an administrator created, appended to the static ones.
 *
 * Each entry links to `/theory/presentations/<slug>`, which is *not* a
 * registered page — the tab system treats it as navigation inside the Theory
 * reader's tab, so a student clicking three presentations in a row keeps one
 * tab and a working back button.
 *
 * The badge is the reader's own percentage, the same number both the page and
 * presentation mode write. It is the cheapest place to answer "where was I?",
 * which is why the whole index arrives in one request.
 */
function TheoryMenuSections({ pathname }: { pathname: string }) {
  const { t } = useTranslation()
  const { sections } = useTheoryMenu()
  const progress = useReadingProgressIndex()

  return sections.map((section) => (
    <Collapsible key={section.id} className="group/collapsible" render={<SidebarMenuItem />}>
      <CollapsibleTrigger
        render={
          <SidebarMenuButton tooltip={section.label}>
            <TheoryIcon name={section.icon} className={ICON_ACCENT} />
            <span className="truncate">{section.label}</span>
            <ChevronDown className="ml-auto size-4 transition-transform duration-200 group-data-open/collapsible:rotate-180" />
          </SidebarMenuButton>
        }
      />
      <CollapsibleContent>
        <SidebarMenuSub className="border-sidebar-border">
          {section.items.map((item) => {
            const path = publishedPresentationPath(item.slug)
            const read = progress[item.slug]

            return (
              <SidebarMenuSubItem key={item.id}>
                <SidebarMenuSubButton
                  isActive={pathname === path}
                  render={<Link to={path} className="no-underline" />}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {read && read.percent > 0 && (
                    <span
                      className={cn(
                        "shrink-0 text-[10px] font-medium",
                        isProgressComplete(read.percent)
                          ? "text-tertiary-ink"
                          : "text-sidebar-foreground/50",
                      )}
                    >
                      {isProgressComplete(read.percent)
                        ? t("presentations.read.complete")
                        : `${read.percent}%`}
                    </span>
                  )}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}

          {section.items.length === 0 && (
            <SidebarMenuSubItem>
              <span className="block px-2 py-1 text-xs text-sidebar-foreground/50">
                {t("sidebar.empty")}
              </span>
            </SidebarMenuSubItem>
          )}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  ))
}

/** A collapsible section: a branch node whose children are page links. */
function NavSection({
  section,
  pathname,
  role,
}: {
  section: NavItem
  pathname: string
  role: AppRole
}) {
  const { t } = useTranslation()
  const Icon = section.icon
  const links = section.children.filter((link) => isVisibleTo(link, role))

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
          {links.map((link) => (
            <SidebarMenuSubItem key={link.path}>
              <SidebarMenuSubButton
                isActive={pathname === link.path}
                render={<Link to={link.path} className="no-underline" />}
              >
                <span>{t(link.titleKey)}</span>
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
