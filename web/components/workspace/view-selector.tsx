"use client";

import {
  CalendarDays,
  Columns3,
  GanttChart,
  List,
  Plus,
  Settings2,
  Table,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TabId } from "@/lib/stores/tabSettings";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabSettings } from "./tab-settings";

const TAB_ICONS: Record<string, LucideIcon> = {
  List,
  CalendarDays,
  Columns3,
  Table,
  GanttChart,
  UsersRound,
};

export interface ViewSelectorProps {
  currentView: string;
  visibleTabs?: { id: TabId; icon: string }[];
  isTabSettingsOpen?: boolean;
  showAddTask?: boolean;
  hiddenTabIds?: TabId[];
  onSwitchView?: (id: TabId) => void;
  onToggleTabSettings?: () => void;
  onCloseTabSettings?: () => void;
  onAddTask?: () => void;
}

export function ViewSelector({
  currentView,
  visibleTabs = [],
  isTabSettingsOpen = false,
  showAddTask = true,
  hiddenTabIds = [],
  onSwitchView,
  onToggleTabSettings,
  onCloseTabSettings,
  onAddTask,
}: ViewSelectorProps) {
  const { t } = useI18n();

  return (
    <div className="relative z-40 flex flex-col gap-2 lg:flex-row lg:items-center">
      <Tabs value={currentView} onValueChange={(id) => onSwitchView?.(id as TabId)} className="min-w-0 flex-1">
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
          {visibleTabs.map((tab) => {
            const Icon = TAB_ICONS[tab.icon];
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="flex-1">
                {Icon && <Icon />}
                {t(`tabs__${tab.id}`)}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="relative flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onToggleTabSettings}
          title={t("page__tab_settings")}
          aria-label={t("page__tab_settings")}
          aria-expanded={isTabSettingsOpen}
        >
          <Settings2 />
        </Button>

        {isTabSettingsOpen && (
          <div className="absolute top-[calc(100%+0.5rem)] right-0 z-[120] origin-top-right animate-in fade-in slide-in-from-top-2">
            <TabSettings hiddenTabIds={hiddenTabIds} onClose={onCloseTabSettings} onSave={onCloseTabSettings} />
          </div>
        )}

        {showAddTask && (
          <Button type="button" onClick={onAddTask} className="flex-1 lg:flex-none">
            <Plus />
            {t("page__add_task")}
          </Button>
        )}
      </div>
    </div>
  );
}
