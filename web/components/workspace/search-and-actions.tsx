"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Filter,
  Flag,
  Folder,
  MessageSquareQuote,
  Rocket,
  Settings,
  SlidersHorizontal,
  UserCheck,
  Users,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ColumnSettingsDropdown } from "./column-settings-dropdown";
import { Portal } from "./portal";

export interface SearchAndActionsProps {
  isFiltersOpen?: boolean;
  isOwner?: boolean;
  isMyTasksActive?: boolean;
  showTeam?: boolean;
  showProjects?: boolean;
  showSprints?: boolean;
  showSummary?: boolean;
  showDailyReflect?: boolean;
  showWorkspaceSettings?: boolean;
  showMilestones?: boolean;
  onToggleFilters?: (position: { top: number; left: number } | null) => void;
  onCloseFilters?: () => void;
  onOpenWorkerManager?: () => void;
  onOpenProjectManager?: () => void;
  onOpenSprintManager?: () => void;
  onOpenMonthlySummary?: () => void;
  onOpenDailyReflect?: () => void;
  onOpenMilestoneManager?: () => void;
  onOpenWorkspaceSettings?: () => void;
  onToggleMyTasks?: () => void;
}

function ActionButton({
  title,
  onClick,
  active = false,
  children,
}: {
  title: string;
  onClick?: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      size="icon"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}

function LabeledButton({ title, onClick, children }: { title: string; onClick?: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} title={title}>
      {children}
      <span className="hidden lg:inline">{title}</span>
    </Button>
  );
}

export function SearchAndActions({
  isFiltersOpen = false,
  isOwner = false,
  isMyTasksActive = false,
  showTeam = true,
  showProjects = true,
  showSprints = true,
  showSummary = true,
  showDailyReflect = true,
  showWorkspaceSettings = true,
  showMilestones = true,
  onToggleFilters,
  onCloseFilters,
  onOpenWorkerManager,
  onOpenProjectManager,
  onOpenSprintManager,
  onOpenMonthlySummary,
  onOpenDailyReflect,
  onOpenMilestoneManager,
  onOpenWorkspaceSettings,
  onToggleMyTasks,
}: SearchAndActionsProps) {
  const { t } = useI18n();
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColumnSettings) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setDropdownPos({ top: rect.bottom + 8, left: rect.left });

    function handleWindowClick(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setShowColumnSettings(false);
    }
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [showColumnSettings]);

  function toggleColumnSettings() {
    if (!showColumnSettings) onCloseFilters?.();
    setShowColumnSettings((open) => !open);
  }

  function toggleFilters() {
    setShowColumnSettings(false);
    const rect = filterButtonRef.current?.getBoundingClientRect();
    onToggleFilters?.(rect ? { top: rect.bottom + 8, left: rect.left } : null);
  }

  return (
    <div className="relative z-30 flex items-center gap-2 overflow-x-auto">
      <Button
        ref={filterButtonRef}
        type="button"
        variant={isFiltersOpen ? "secondary" : "outline"}
        size="icon"
        onClick={toggleFilters}
        title={t("page__filters")}
        aria-label={t("page__filters")}
        aria-expanded={isFiltersOpen}
      >
        <Filter />
      </Button>

      <div className="relative">
        <Button
          ref={buttonRef}
          type="button"
          variant={showColumnSettings ? "secondary" : "outline"}
          size="icon"
          onClick={toggleColumnSettings}
          title={t("page__display_settings")}
          aria-label={t("page__display_settings")}
          aria-expanded={showColumnSettings}
        >
          <SlidersHorizontal />
        </Button>

        {showColumnSettings && (
          <Portal>
            <div ref={dropdownRef} className="fixed z-[9999]" style={{ top: dropdownPos.top, left: dropdownPos.left }}>
              <ColumnSettingsDropdown />
            </div>
          </Portal>
        )}
      </div>

      {showTeam && (
        <ActionButton title={t("page__team")} onClick={onOpenWorkerManager}>
          <Users />
        </ActionButton>
      )}

      {isOwner && showWorkspaceSettings && (
        <ActionButton title={t("page__workspace_settings")} onClick={onOpenWorkspaceSettings}>
          <Settings />
        </ActionButton>
      )}

      <ActionButton title={t("page__my_tasks")} onClick={onToggleMyTasks} active={isMyTasksActive}>
        <UserCheck />
      </ActionButton>

      <Separator orientation="vertical" className="mx-1 hidden h-6 md:block" />

      {showProjects && (
        <LabeledButton title={t("page__projects")} onClick={onOpenProjectManager}>
          <Folder />
        </LabeledButton>
      )}

      {showSprints && (
        <LabeledButton title={t("page__sprint")} onClick={onOpenSprintManager}>
          <Flag />
        </LabeledButton>
      )}

      {showSummary && (
        <LabeledButton title={t("page__summary_30_days")} onClick={onOpenMonthlySummary}>
          <CalendarDays />
        </LabeledButton>
      )}

      {showDailyReflect && (
        <LabeledButton title={t("dailyReflect__btn_open")} onClick={onOpenDailyReflect}>
          <MessageSquareQuote />
        </LabeledButton>
      )}

      {isOwner && showMilestones && (
        <LabeledButton title={t("milestone.btn_countdown")} onClick={onOpenMilestoneManager}>
          <Rocket />
        </LabeledButton>
      )}
    </div>
  );
}
