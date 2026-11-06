"use client";

import { useMemo, useRef, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { ChevronDown, Search } from "lucide-react";
import type { Sprint } from "@/lib/stores/sprintStore";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useBindable } from "./use-bindable";

export type SprintSelectValue = string | number | "all" | null;

type SearchableSprintSelectProps = {
  sprints?: Sprint[];
  value?: SprintSelectValue;
  onValueChange?: (value: SprintSelectValue) => void;
  id?: string;
  formMode?: boolean;
};

const formatShortDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function SearchableSprintSelect({
  sprints = [],
  value: valueProp = "all",
  onValueChange,
  id = "sprint",
  formMode = false,
}: SearchableSprintSelectProps) {
  const { t } = useI18n();
  const [value, setValue] = useBindable<SprintSelectValue>(valueProp, onValueChange);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const sortedSprints = useMemo(
    () =>
      sprints
        .filter((s): s is Sprint & { id: string | number } => s.id !== undefined)
        .sort((a, b) => {
          if (a.status === "active" && b.status !== "active") return -1;
          if (b.status === "active" && a.status !== "active") return 1;
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        }),
    [sprints],
  );

  const query = searchQuery.trim().toLowerCase();
  const displaySprints = query ? sortedSprints.filter((s) => s.name.toLowerCase().includes(query)) : sortedSprints;

  const unspecifiedLabel = t("page__filter_sprint_unspecified");
  const selectedLabel = (() => {
    if (value === "all") return formMode ? unspecifiedLabel : t("page__filter_sprint_all");
    if (value === null) return formMode ? unspecifiedLabel : t("page__filter_sprint_none");
    const sprint = sprints.find((s) => String(s.id) === String(value));
    if (!sprint) return formMode ? unspecifiedLabel : t("page__filter_sprint_all");
    const statusText =
      sprint.status === "active"
        ? ` (${t("page__filter_sprint_status_active")})`
        : sprint.status === "completed"
          ? ` (${t("page__filter_sprint_status_completed")})`
          : "";
    return sprint.name + statusText;
  })();

  const isUnset = value === "all" || value === null;

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) setSearchQuery("");
  }

  function selectSprint(sprintId: SprintSelectValue) {
    setValue(sprintId);
    setIsOpen(false);
    setSearchQuery("");
  }

  const optionClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-accent",
      active ? "font-bold text-primary" : "text-muted-foreground",
    );

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      <div className={cn("relative", isOpen ? "z-[9000]" : "z-auto")}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            id={id}
            className="group flex h-8 w-full items-center justify-between rounded-md border border-transparent bg-transparent px-2 text-left transition-all hover:border-border hover:bg-accent"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  isUnset ? "bg-muted-foreground/40" : "bg-brand-500 shadow-[0_0_8px_rgba(129,140,248,0.5)]",
                )}
              />
              <span
                className={cn(
                  "truncate text-[13px]",
                  isUnset ? "text-muted-foreground" : "font-medium text-foreground",
                )}
              >
                {selectedLabel}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                "ml-1 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
                isOpen && "rotate-180",
              )}
            />
          </button>
        </PopoverPrimitive.Trigger>
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            searchInputRef.current?.focus();
          }}
          style={{ width: "var(--radix-popover-trigger-width)" }}
          className="z-[9000] min-w-[200px] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("page__filter_sprint_search_placeholder")}
                aria-label={t("page__filter_sprint_search_placeholder")}
                className="h-8 w-full rounded-lg border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none transition-all placeholder:text-muted-foreground focus:border-ring"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {!formMode && (
              <button type="button" className={optionClass(value === "all")} onClick={() => selectSprint("all")}>
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    value === "all" ? "bg-primary" : "border border-muted-foreground/50 bg-transparent",
                  )}
                />
                {t("page__filter_sprint_all")}
              </button>
            )}
            <button type="button" className={optionClass(value === null)} onClick={() => selectSprint(null)}>
              <div
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  value === null ? "bg-primary" : "border border-muted-foreground/50 bg-transparent",
                )}
              />
              {formMode ? unspecifiedLabel : t("page__filter_sprint_none")}
            </button>

            {displaySprints.length > 0 ? (
              <>
                <div className="mx-2 my-1 h-px bg-border" />
                {displaySprints.map((sprint) => {
                  const active = String(value) === String(sprint.id);
                  return (
                    <button
                      key={sprint.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] transition-colors hover:bg-accent",
                        active ? "bg-accent font-bold text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => selectSprint(sprint.id)}
                    >
                      <div className="flex flex-1 flex-col overflow-hidden">
                        <span className="truncate">{sprint.name}</span>
                        <span className="text-[10px] uppercase tracking-tighter opacity-50">
                          {formatShortDate(sprint.start_date)} - {formatShortDate(sprint.end_date)}
                        </span>
                      </div>
                      {sprint.status === "active" ? (
                        <span className="shrink-0 rounded border border-green-500/20 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-500">
                          {t("page__filter_sprint_status_active")}
                        </span>
                      ) : sprint.status === "completed" ? (
                        <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {t("page__filter_sprint_status_completed")}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </>
            ) : searchQuery ? (
              <div className="px-4 py-4 text-center text-[13px] italic text-muted-foreground">
                {t("page__filter_sprint_not_found")}
              </div>
            ) : null}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
