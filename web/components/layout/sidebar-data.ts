import {
  ClipboardCheck,
  HardDrive,
  LayoutDashboard,
  ListTodo,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserCog,
  Users,
} from "lucide-react";
import { MY_TASKS_WORKSPACE_ID } from "@/lib/workspace";
import { workspacePath } from "@/lib/routes";
import type { NavGroup } from "./types";

type NavContext = {
  /** Workspace id from the current URL, if any (the hub id counts as a workspace). */
  workspaceId: string | null;
  isAdmin: boolean;
};

export function buildNavGroups({ workspaceId, isAdmin }: NavContext): NavGroup[] {
  const groups: NavGroup[] = [
    {
      titleKey: "sidebar__personal",
      items: [
        { titleKey: "sidebar__dashboard", url: "/dashboard", icon: LayoutDashboard },
        { titleKey: "sidebar__focus_hub", url: workspacePath(MY_TASKS_WORKSPACE_ID), icon: Target },
      ],
    },
  ];

  if (workspaceId && workspaceId !== MY_TASKS_WORKSPACE_ID) {
    groups.push({
      titleKey: "sidebar__workspace",
      items: [
        { titleKey: "sidebar__issues", url: workspacePath(workspaceId), icon: ListTodo },
        { titleKey: "sidebar__overview", url: workspacePath(workspaceId, "overview"), icon: LayoutDashboard },
        { titleKey: "sidebar__test_cases", url: workspacePath(workspaceId, "test-cases"), icon: ClipboardCheck },
      ],
    });
  }

  groups.push({
    titleKey: "sidebar__configure",
    items: [
      {
        titleKey: "sidebar__settings",
        icon: Settings,
        items: [
          { titleKey: "layout__profile_settings", url: "/profile", icon: UserCog },
          ...(isAdmin
            ? [
                { titleKey: "settings__tab_general", url: "/settings", icon: SlidersHorizontal },
                { titleKey: "settings__tab_users", url: "/settings/users", icon: Users },
                { titleKey: "settings__tab_storage", url: "/settings/storage", icon: HardDrive },
                { titleKey: "settings__tab_ai", url: "/settings/ai", icon: Sparkles },
              ]
            : []),
        ],
      },
    ],
  });
  return groups;
}
