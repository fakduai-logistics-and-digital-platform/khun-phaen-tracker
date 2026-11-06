"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, LayoutGrid } from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { api } from "@/lib/api/apis";
import { useAuth } from "@/lib/auth/auth-provider";
import { getWorkspaceIcon } from "@/lib/dashboard/workspace-options";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { setWorkspaceRoom } from "@/lib/room";
import { workspacePath } from "@/lib/routes";
import { useStore } from "@/lib/store";
import {
  currentWorkspaceColor,
  currentWorkspaceIcon,
  currentWorkspaceId,
  currentWorkspaceName,
} from "@/lib/stores/workspace";
import { useRouteIds } from "@/lib/use-route-ids";
import { setWorkspaceId, type Workspace } from "@/lib/workspace";

function WorkspaceTile({ ws, className }: { ws: Pick<Workspace, "icon" | "color">; className?: string }) {
  const Icon = getWorkspaceIcon(ws.icon);
  const color = ws.color || "#6366f1";
  // Same tinted tile as the dashboard cards; text-inherit keeps menu items from greying the icon.
  return (
    <span
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", className)}
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <Icon className="size-4 text-inherit" />
    </span>
  );
}

/** Lists the workspaces the signed-in user belongs to; loaded once, the first time the menu opens. */
export function WorkspaceSwitcher() {
  const { t } = useI18n();
  const { isMobile, setOpenMobile } = useSidebar();
  const router = useRouter();
  const { workspaceId } = useRouteIds();
  const { user } = useAuth();
  const userKey = user?.id ?? "";
  const storedId = useStore(currentWorkspaceId);
  const storedName = useStore(currentWorkspaceName);
  const storedColor = useStore(currentWorkspaceColor);
  const storedIcon = useStore(currentWorkspaceIcon);
  const [loaded, setLoaded] = useState<{ userKey: string; list: Workspace[] } | null>(null);

  const workspaces = loaded?.userKey === userKey ? loaded.list : [];
  // The stores already hold the open workspace, so the trigger needs no request.
  const active =
    workspaceId && storedId === workspaceId && storedName
      ? { name: storedName, color: storedColor ?? undefined, icon: storedIcon ?? undefined }
      : null;

  async function loadWorkspaces() {
    if (loaded?.userKey === userKey) return;
    try {
      const res = await api.workspaces.getList();
      const data = await res.json();
      if (res.ok) setLoaded({ userKey, list: data.workspaces || [] });
    } catch {
      /* The menu still offers the dashboard link when the list cannot load. */
    }
  }

  function switchTo(ws: Workspace) {
    setWorkspaceId(ws.id, ws.name, ws.owner_id, ws.color, ws.icon, ws.short_name);
    setWorkspaceRoom(ws.id, ws.room_code);
    setOpenMobile(false);
    router.push(workspacePath(ws.id));
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={(open) => open && void loadWorkspaces()}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {active ? (
                <WorkspaceTile ws={active} />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center">
                  <AppLogo alt="" className="size-8 rounded-lg" />
                </span>
              )}
              <span className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">{active?.name ?? "Khun Phaen"}</span>
                <span className="truncate text-xs">{active ? "Khun Phaen" : t("sidebar__workspaces_switcher")}</span>
              </span>
              <ChevronsUpDown className="ms-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("sidebar__workspaces_switcher")}
            </DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem key={ws.id} className="gap-2 p-2" onClick={() => switchTo(ws)}>
                <WorkspaceTile ws={ws} className="size-6 rounded-md" />
                <span className="truncate">{ws.name}</span>
                {ws.id === workspaceId && <Check className="ms-auto size-4" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2 p-2">
              <Link href="/dashboard" onClick={() => setOpenMobile(false)}>
                <span className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <LayoutGrid className="size-3.5" />
                </span>
                <span className="text-muted-foreground">{t("dashboard__all_section")}</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
