"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Columns3,
  Eye,
  EyeOff,
  GanttChart,
  GripVertical,
  List,
  RotateCcw,
  Settings2,
  Table,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { tabSettings, type TabConfig, type TabId } from "@/lib/stores/tabSettings";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<string, LucideIcon> = {
  List,
  CalendarDays,
  Columns3,
  Table,
  GanttChart,
  UsersRound,
};

const DEFAULT_TABS: TabConfig[] = [
  { id: "list", label: "list", icon: "List", enabled: true },
  { id: "calendar", label: "calendar", icon: "CalendarDays", enabled: true },
  { id: "kanban", label: "kanban", icon: "Columns3", enabled: true },
  { id: "table", label: "table", icon: "Table", enabled: true },
  { id: "gantt", label: "gantt", icon: "GanttChart", enabled: true },
  { id: "workload", label: "workload", icon: "UsersRound", enabled: true },
];

interface TabRowProps {
  tab: TabConfig;
  index: number;
  count: number;
  onToggle: (id: TabId) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

function TabRow({ tab, index, count, onToggle, onMoveUp, onMoveDown }: TabRowProps) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });
  const Icon = TAB_ICONS[tab.icon] ?? List;
  const toggleLabel = tab.enabled ? "Hide tab" : "Show tab";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 select-none",
        isDragging && "z-10 border-dashed border-primary bg-primary/10 opacity-70 ",
        !tab.enabled && "opacity-45",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t(`tabs__${tab.id}`)}
        className="cursor-grab touch-none text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
      <Icon size={17} className="text-muted-foreground" />
      <span className="flex-1 font-medium">{t(`tabs__${tab.id}`)}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onToggle(tab.id)}
          className={cn(
            "rounded-md border p-1.5 transition-colors",
            tab.enabled ? "border-success/40 bg-success/10 text-success " : "bg-muted/30 text-muted-foreground",
          )}
          title={toggleLabel}
          aria-label={toggleLabel}
        >
          {tab.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          type="button"
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          title={t("tabSettings__move_up")}
          aria-label={t("tabSettings__move_up")}
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          onClick={() => onMoveDown(index)}
          disabled={index === count - 1}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          title={t("tabSettings__move_down")}
          aria-label={t("tabSettings__move_down")}
        >
          <ChevronDown size={16} />
        </button>
      </div>
    </li>
  );
}

export interface TabSettingsProps {
  hiddenTabIds?: TabId[];
  onClose?: () => void;
  onSave?: () => void;
}

export function TabSettings({ hiddenTabIds = [], onClose, onSave }: TabSettingsProps) {
  const { t } = useI18n();
  const storeTabs = useStore(tabSettings);
  const visibleStoreTabs = useMemo(
    () => storeTabs.filter((tab) => !hiddenTabIds.includes(tab.id)),
    [storeTabs, hiddenTabIds],
  );
  const [editingTabs, setEditingTabs] = useState<TabConfig[]>(visibleStoreTabs);
  const [hasChanges, setHasChanges] = useState(false);
  const tabs = useMemo(() => editingTabs.filter((tab) => !hiddenTabIds.includes(tab.id)), [editingTabs, hiddenTabIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function update(next: TabConfig[]) {
    setEditingTabs(next);
    setHasChanges(true);
  }

  function toggleTabEnabled(id: TabId) {
    const enabledCount = tabs.filter((tab) => tab.enabled).length;
    update(
      tabs.map((tab) => {
        if (tab.id !== id) return tab;
        if (tab.enabled && enabledCount <= 1) return tab;
        return { ...tab, enabled: !tab.enabled };
      }),
    );
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    update(arrayMove(tabs, index, index - 1));
  }

  function moveDown(index: number) {
    if (index >= tabs.length - 1) return;
    update(arrayMove(tabs, index, index + 1));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = tabs.findIndex((tab) => tab.id === active.id);
    const to = tabs.findIndex((tab) => tab.id === over.id);
    if (from >= 0 && to >= 0) update(arrayMove(tabs, from, to));
  }

  function handleReset() {
    update(DEFAULT_TABS.filter((tab) => !hiddenTabIds.includes(tab.id)));
  }

  function handleSave() {
    const hiddenTabs = storeTabs.filter((tab) => hiddenTabIds.includes(tab.id));
    tabSettings.set([...tabs, ...hiddenTabs]);
    setHasChanges(false);
    onSave?.();
  }

  function handleCancel() {
    setEditingTabs(visibleStoreTabs);
    setHasChanges(false);
    onClose?.();
  }

  const [subtitleBefore, subtitleAfter] = t("tabSettings__subtitle").split("<icon />");

  return (
    <div className="w-72 overflow-hidden rounded-lg border bg-popover p-3 text-popover-foreground">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <Settings2 size={18} />
          {t("tabSettings__title")}
        </h3>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t("tabSettings__btn_cancel")}
        >
          <X size={18} />
        </button>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        <span>{subtitleBefore}</span>
        <GripVertical size={14} className="inline" />
        <span>{subtitleAfter}</span>
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tabs.map((tab) => tab.id)} strategy={verticalListSortingStrategy}>
          <ul className="mb-3 space-y-2">
            {tabs.map((tab, index) => (
              <TabRow
                key={tab.id}
                tab={tab}
                index={index}
                count={tabs.length}
                onToggle={toggleTabEnabled}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-2 border-t pt-3">
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCcw size={16} />
          {t("tabSettings__btn_reset")}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {t("tabSettings__btn_cancel")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check size={16} />
          {t("tabSettings__btn_save")}
        </button>
      </div>
    </div>
  );
}
