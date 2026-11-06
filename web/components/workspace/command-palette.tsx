"use client";

import { useEffect, useState } from "react";
import { Folder, Sparkles } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { currentWorkspaceShortName } from "@/lib/stores/workspace";
import type { Assignee, Project, Sprint, Task } from "@/lib/types";
import { normalizeForCommandSearch } from "@/lib/utils/command-palette";
import {
  CATEGORY_ORDER,
  buildBaseItems,
  buildDynamicItems,
  filterPaletteItems,
  getCategoryLabel,
  getCommandStatusInfo,
  type PaletteActions,
} from "./command-palette-items";
import { cn } from "@/lib/utils";

export interface CommandPaletteProps {
  open?: boolean;
  tasks?: Task[];
  sprints?: Sprint[];
  projects?: Project[];
  assignees?: Assignee[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  toggleTheme: () => void;
  switchView: (id: string) => void;
  openTask: (task: Task) => void;
  applyGlobalSearch: (query: string) => void;
  createTask: () => void;
  startTimer: () => void;
  openQuickNotes: () => void;
  openBookmarks: () => void;
  openWhiteboard: () => void;
  dailyReflect: () => void;
  openPageSize: () => void;
  onClose?: () => void;
  onClearFilters?: () => void;
  onFilterProject?: (project: string) => void;
  onFilterAssignee?: (assigneeId: string | number) => void;
  onFilterSprint?: (sprintId: string | number) => void;
}

export function CommandPalette({
  open = false,
  tasks = [],
  sprints = [],
  projects = [],
  assignees = [],
  t,
  onClose,
  onClearFilters,
  onFilterProject,
  onFilterAssignee,
  onFilterSprint,
  ...actionProps
}: CommandPaletteProps) {
  const shortName = useStore(currentWorkspaceShortName);
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeForCommandSearch(query.trim());

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const actions: PaletteActions = {
    ...actionProps,
    clearFilters: () => onClearFilters?.(),
    filterProject: onFilterProject,
    filterAssignee: onFilterAssignee,
    filterSprint: onFilterSprint,
  };

  const filtered = filterPaletteItems(
    [
      ...buildBaseItems(t, actions),
      ...buildDynamicItems({
        query: normalizedQuery,
        rawQuery: query.trim(),
        tasks,
        sprints,
        projects,
        assignees,
        fallbackShortName: shortName,
        t,
        actions,
      }),
    ],
    normalizedQuery,
  );

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    label: getCategoryLabel(category, t),
    items: filtered.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  async function runItem(item: (typeof filtered)[number]) {
    await item.run();
    onClose?.();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] z-[20001] max-w-2xl translate-y-0 gap-0 overflow-hidden rounded-lg p-0 sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">{t("commandPalette__title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("commandPalette__close_label")}</DialogDescription>
        <Command shouldFilter={false} loop className="bg-transparent">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">⌨️ {t("commandPalette__title")}</p>
            <kbd className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              {t("commandPalette__shortcut_hint")}
            </kbd>
          </div>
          <CommandInput value={query} onValueChange={setQuery} placeholder={t("commandPalette__placeholder_dynamic")} />
          <CommandList className="max-h-[48vh] p-2">
            <CommandEmpty className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("commandPalette__no_results_dynamic")}
            </CommandEmpty>
            {groups.map((group) => (
              <CommandGroup
                key={group.category}
                heading={group.label}
                className="**:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:"
              >
                {group.items.map((item) => {
                  const Icon = item.icon ?? Sparkles;
                  const statusInfo = item.status ? getCommandStatusInfo(item.status, t) : null;
                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => void runItem(item)}
                      className="mb-1 gap-3 rounded-lg border border-transparent px-4 py-3 data-[selected=true]:border-primary/30 data-[selected=true]:bg-primary/10"
                    >
                      <div className="shrink-0 rounded-lg bg-muted p-2 text-muted-foreground group-data-[selected=true]:text-primary">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.label}</p>
                        {item.project ? (
                          <div className="flex flex-wrap items-center gap-1.5 font-medium">
                            <span className="inline-flex items-center gap-1 rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
                              <Folder size={10} />
                              {item.project}
                            </span>
                            {statusInfo && (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium",
                                  statusInfo.className,
                                )}
                              >
                                {statusInfo.label}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{t("commandPalette__enter_key")}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
