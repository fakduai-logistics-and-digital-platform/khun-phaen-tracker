"use client";

import { workspaceIdFromSlug } from "@/lib/routes";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { writable } from "@/lib/store";

/** Stand-in for SvelteKit's `$app/stores` page store, kept in sync by <PageStoreSync />. */
export const page = writable<{ params: Record<string, string>; url: URL }>({
  params: {},
  url: new URL("http://localhost/"),
});

export function PageStoreSync() {
  const ws = useSearchParams().get("ws");
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    const url = new URL(pathname + (search?.toString() ? `?${search}` : ""), window.location.origin);
    const normalized: Record<string, string> = ws ? { workspace_id: workspaceIdFromSlug(ws) } : {};
    page.set({ params: normalized, url });
  }, [ws, pathname, search]);

  return null;
}
