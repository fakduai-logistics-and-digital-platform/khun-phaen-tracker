"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n";
import type { NavCollapsible, NavGroup as NavGroupProps, NavItem, NavLink } from "./types";

export function NavGroup({ titleKey, items }: NavGroupProps) {
  const { state, isMobile } = useSidebar();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const pathname = `${usePathname()}?ws=${searchParams.get("ws") ?? ""}`;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t(titleKey)}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const key = `${item.titleKey}-${item.url}`;
          if (!item.items) return <SidebarMenuLink key={key} item={item} pathname={pathname} />;
          if (state === "collapsed" && !isMobile) {
            return <SidebarMenuCollapsedDropdown key={key} item={item} pathname={pathname} />;
          }
          return <SidebarMenuCollapsible key={key} item={item} pathname={pathname} />;
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function NavBadge({ children }: { children: React.ReactNode }) {
  return <Badge className="rounded-full px-1 py-0 text-xs">{children}</Badge>;
}

function SidebarMenuLink({ item, pathname }: { item: NavLink; pathname: string }) {
  const { setOpenMobile } = useSidebar();
  const { t } = useI18n();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={checkIsActive(pathname, item)} tooltip={t(item.titleKey)}>
        <Link href={item.url} onClick={() => setOpenMobile(false)}>
          {item.icon && <item.icon />}
          <span>{t(item.titleKey)}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarMenuCollapsible({ item, pathname }: { item: NavCollapsible; pathname: string }) {
  const { setOpenMobile } = useSidebar();
  const { t } = useI18n();
  return (
    <Collapsible asChild defaultOpen={checkIsActive(pathname, item, true)} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={t(item.titleKey)}>
            {item.icon && <item.icon />}
            <span>{t(item.titleKey)}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="CollapsibleContent">
          <SidebarMenuSub>
            {item.items.map((subItem) => (
              <SidebarMenuSubItem key={subItem.titleKey}>
                <SidebarMenuSubButton asChild isActive={checkIsActive(pathname, subItem)}>
                  <Link href={subItem.url} onClick={() => setOpenMobile(false)}>
                    {subItem.icon && <subItem.icon />}
                    <span>{t(subItem.titleKey)}</span>
                    {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function SidebarMenuCollapsedDropdown({ item, pathname }: { item: NavCollapsible; pathname: string }) {
  const { t } = useI18n();
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={t(item.titleKey)} isActive={checkIsActive(pathname, item)}>
            {item.icon && <item.icon />}
            <span>{t(item.titleKey)}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className="ms-auto" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={4}>
          <DropdownMenuLabel>
            {t(item.titleKey)} {item.badge ? `(${item.badge})` : ""}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.items.map((sub) => (
            <DropdownMenuItem key={`${sub.titleKey}-${sub.url}`} asChild>
              <Link href={sub.url} className={checkIsActive(pathname, sub) ? "bg-secondary" : ""}>
                {sub.icon && <sub.icon />}
                <span className="max-w-52 text-wrap">{t(sub.titleKey)}</span>
                {sub.badge && <span className="ms-auto text-xs">{sub.badge}</span>}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

/** Location key: path plus the `ws` query param, since workspaces are told apart by query, not path. */
const pathOf = (url?: string) => {
  if (!url) return undefined;
  const [path, query = ""] = url.split("?");
  return `${path}?ws=${new URLSearchParams(query).get("ws") ?? ""}`;
};

function checkIsActive(pathname: string, item: NavItem, mainNav = false) {
  return (
    pathname === pathOf(item.url) ||
    !!item.items?.some((i) => pathOf(i.url) === pathname) ||
    (mainNav && pathname.split("/")[1] !== "" && pathname.split("/")[1] === pathOf(item.url)?.split("/")[1])
  );
}
