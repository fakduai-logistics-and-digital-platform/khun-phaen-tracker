"use client";

import { NotificationCenter } from "@/components/devtools/notification-center";
import { SidebarUtilityTools } from "@/components/devtools/sidebar-utility-tools";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { useLayout } from "@/context/layout-provider";
import { WorkzyTimeCard } from "@/components/workzy/workzy-time-card";
import { NavGroup } from "./nav-group";
import { NavUser } from "./nav-user";
import { useNavGroups } from "./use-nav-groups";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function AppSidebar() {
  const { collapsible, variant } = useLayout();
  const navGroups = useNavGroups();
  const mainGroups = navGroups.filter((group) => group.titleKey !== "sidebar__configure");
  const configGroups = navGroups.filter((group) => group.titleKey === "sidebar__configure");
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {mainGroups.map((group) => (
          <NavGroup key={group.titleKey} {...group} />
        ))}
        <SidebarUtilityTools />
        {configGroups.map((group) => (
          <NavGroup key={group.titleKey} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <WorkzyTimeCard />
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col-reverse">
          <div className="min-w-0 flex-1">
            <NavUser />
          </div>
          <NotificationCenter />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
