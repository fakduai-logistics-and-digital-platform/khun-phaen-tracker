"use client";

import { useSearchParams } from "next/navigation";
import { workspaceIdFromSlug } from "@/lib/routes";

/** Workspace id (`ws`) and task id (`id`) taken from the query string of the current page. */
export function useRouteIds() {
  const searchParams = useSearchParams();
  const ws = searchParams.get("ws");
  return {
    workspaceId: ws ? workspaceIdFromSlug(ws) : undefined,
    taskId: searchParams.get("id") || undefined,
  };
}
