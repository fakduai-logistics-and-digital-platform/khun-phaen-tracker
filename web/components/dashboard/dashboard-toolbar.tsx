"use client";

import { ArrowUpDown, LayoutGrid, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ViewMode } from "@/lib/dashboard/storage";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type SortKey = "newest" | "oldest" | "name_asc" | "name_desc" | "recent";

const SORT_OPTIONS: { value: SortKey; key: string }[] = [
  { value: "newest", key: "dashboard__sort_newest" },
  { value: "oldest", key: "dashboard__sort_oldest" },
  { value: "name_asc", key: "dashboard__sort_name_asc" },
  { value: "name_desc", key: "dashboard__sort_name_desc" },
  { value: "recent", key: "dashboard__sort_recent" },
];

export function DashboardToolbar({
  query,
  sortBy,
  viewMode,
  onQueryChange,
  onSortChange,
  onViewModeChange,
}: {
  query: string;
  sortBy: SortKey;
  viewMode: ViewMode;
  onQueryChange: (value: string) => void;
  onSortChange: (value: SortKey) => void;
  onViewModeChange: (value: ViewMode) => void;
}) {
  const { t } = useI18n();
  const modes = [
    { mode: "grid" as const, icon: LayoutGrid, label: t("dashboard__view_grid") },
    { mode: "list" as const, icon: List, label: t("dashboard__view_list") },
  ];

  return (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
      <div className="relative sm:w-56">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("dashboard__search_placeholder")}
          className="pl-9"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <ArrowUpDown size={14} className="text-muted-foreground" />
            {t(SORT_OPTIONS.find((o) => o.value === sortBy)?.key ?? "dashboard__sort_newest")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSortChange(v as SortKey)}>
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                {t(opt.key)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex overflow-hidden rounded-lg border" role="group">
        {modes.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
            title={label}
            aria-label={label}
            aria-pressed={viewMode === mode}
            className={cn(
              "p-2 transition-colors",
              mode === "list" && "border-l",
              viewMode === mode ? "bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
