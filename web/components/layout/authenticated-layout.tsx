"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DevToolsHost } from "@/components/devtools/devtools-host";
import { SkipToMain } from "@/components/skip-to-main";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { LayoutProvider } from "@/context/layout-provider";
import { SearchProvider } from "@/context/search-provider";
import { useAuth } from "@/lib/auth/auth-provider";
import { getCookie } from "@/lib/cookies";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./app-sidebar";

/** Authenticated page chrome (shadcn-admin layout). Redirects to /login once auth resolves without a user. */
export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [defaultOpen, setDefaultOpen] = useState(true);

  useEffect(() => {
    setDefaultOpen(getCookie("sidebar_state") !== "false");
  }, []);

  // Every page is a static file shared by all ids, so warming these few routes makes later navigation instant.
  useEffect(() => {
    const warm = () => {
      for (const path of [
        "/dashboard/",
        "/workspaces/",
        "/workspaces/overview/",
        "/workspaces/test-cases/",
        "/workspaces/task/",
      ]) {
        router.prefetch(path);
      }
    };
    const idle = window.requestIdleCallback?.(warm) ?? window.setTimeout(warm, 500);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(idle) : window.clearTimeout(idle));
  }, [router]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider key={String(defaultOpen)} defaultOpen={defaultOpen}>
          <SkipToMain />
          <AppSidebar />
          <SidebarInset
            className={cn(
              "@container/content",
              "has-data-[layout=fixed]:h-svh",
              "peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]",
            )}
          >
            {children}
          </SidebarInset>
          <DevToolsHost />
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  );
}
