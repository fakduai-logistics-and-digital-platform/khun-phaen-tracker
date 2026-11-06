"use client";

import Link from "next/link";
import { AppLogo } from "@/components/brand/app-logo";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

export function AppTitle() {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild>
          <Link href="/dashboard" onClick={() => setOpenMobile(false)}>
            <span className="flex aspect-square size-8 items-center justify-center">
              <AppLogo alt="" className="size-8 rounded-lg" />
            </span>
            <span className="grid flex-1 text-start text-sm leading-tight">
              <span className="truncate font-bold">Khun Phaen</span>
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
