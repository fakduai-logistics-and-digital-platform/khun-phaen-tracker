"use client";

import { useEffect } from "react";
import { Suspense } from "react";
import { useRouteIds } from "@/lib/use-route-ids";
import { get } from "@/lib/store";
import {
  currentWorkspaceColor,
  currentWorkspaceIcon,
  currentWorkspaceId,
  currentWorkspaceName,
  currentWorkspaceOwnerId,
  currentWorkspaceShortName,
  loadWorkspaceId,
} from "@/lib/stores/workspace";

/** Hydrates the workspace stores from storage, and drops stale details when the URL points elsewhere. */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { workspaceId } = useRouteIds();

  useEffect(() => {
    loadWorkspaceId();
    if (workspaceId && get(currentWorkspaceId) !== workspaceId) {
      currentWorkspaceId.set(workspaceId);
      currentWorkspaceName.set("");
      currentWorkspaceOwnerId.set(null);
      currentWorkspaceColor.set(null);
      currentWorkspaceIcon.set(null);
      currentWorkspaceShortName.set(null);
    }
  }, [workspaceId]);

  return <Suspense>{children}</Suspense>;
}
