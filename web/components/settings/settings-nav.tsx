"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, HardDrive, Settings, Shield, Sparkles, Users, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  exact?: boolean;
};

const TABS: Tab[] = [
  {
    href: "/settings",
    label: "settings__tab_general",
    description: "settings__tab_general_desc",
    icon: Settings,
    exact: true,
  },
  { href: "/settings/users", label: "settings__tab_users", description: "settings__tab_users_desc", icon: Users },
  {
    href: "/settings/storage",
    label: "settings__tab_storage",
    description: "settings__tab_storage_desc",
    icon: HardDrive,
  },
  { href: "/settings/ai", label: "settings__tab_ai", description: "settings__tab_ai_desc", icon: Sparkles },
];

function normalize(pathname: string) {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function SettingsNav() {
  const { t } = useI18n();
  const pathname = normalize(usePathname() || "/");

  return (
    <aside className="lg:sticky lg:top-4 lg:self-start">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b bg-gradient-to-br from-brand-500/15 via-muted/40 to-transparent p-5">
          <div className="mb-3 inline-flex rounded-xl bg-background/70 p-3 text-foreground ring-1 ring-border backdrop-blur">
            <Shield size={20} />
          </div>
          <h1 className="text-lg font-bold tracking-tight">{t("settings__title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("settings__subtitle")}</p>
        </div>

        <nav aria-label={t("settings__title")} className="space-y-1.5 p-3">
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-start gap-3 rounded-xl px-4 py-3 transition-colors",
                  active
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 rounded-lg p-2",
                    active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground group-hover:bg-background",
                  )}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{t(tab.label)}</span>
                    <ChevronRight
                      size={14}
                      className={active ? "opacity-100" : "opacity-40 transition-opacity group-hover:opacity-80"}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t(tab.description)}</p>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
