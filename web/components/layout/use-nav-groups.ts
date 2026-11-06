"use client";

import { useMemo } from "react";
import { useRouteIds } from "@/lib/use-route-ids";
import { useAuth } from "@/lib/auth/auth-provider";
import { buildNavGroups } from "./sidebar-data";

export function useNavGroups() {
  const { workspaceId: routeWorkspaceId } = useRouteIds();
  const { user } = useAuth();
  const workspaceId = routeWorkspaceId ?? null;
  const isAdmin = user?.role === "admin";

  return useMemo(() => buildNavGroups({ workspaceId, isAdmin }), [workspaceId, isAdmin]);
}
