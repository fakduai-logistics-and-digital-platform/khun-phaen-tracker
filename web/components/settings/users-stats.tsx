"use client";

import type { ManagedUser } from "@/components/settings/user-types";
import { useI18n } from "@/lib/i18n";

export function UsersStats({ users }: { users: ManagedUser[] }) {
  const { t } = useI18n();
  const stats = [
    { label: t("users__total_users"), value: users.length, tone: "" },
    { label: t("users__active"), value: users.filter((u) => u.is_active).length, tone: "text-success" },
    { label: t("users__pending"), value: users.filter((u) => !u.is_active).length, tone: "text-warning" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border bg-card p-4 shadow-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</span>
          <div className={`mt-1 text-2xl font-bold ${stat.tone}`}>{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
