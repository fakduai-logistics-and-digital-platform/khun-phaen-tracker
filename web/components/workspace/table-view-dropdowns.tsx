"use client";

import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Portal } from "./portal";
import { PRIORITY_OPTIONS, STATUS_OPTIONS, type PriorityValue } from "./table-view-config";

export interface DropdownAnchor {
  taskId: string | number;
  top: number;
  left: number;
}

const ITEM = "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-accent";

export function PriorityDropdown({
  anchor,
  task,
  onSelect,
}: {
  anchor: DropdownAnchor;
  task: Task | undefined;
  onSelect: (taskId: string | number, priority: PriorityValue) => void;
}) {
  if (!task) return null;
  return (
    <Portal>
      <div
        role="menu"
        className="priority-dropdown-portal fixed z-[9999] min-w-35 rounded-lg border bg-popover py-1"
        style={{ top: anchor.top, left: anchor.left }}
      >
        {PRIORITY_OPTIONS.map((option) => {
          const Icon = option.icon;
          const current = task.priority === option.value || (!task.priority && option.value === "none");
          return (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(anchor.taskId, option.value);
              }}
              className={cn(ITEM, current && "bg-accent font-semibold")}
            >
              <Icon size={12} className={option.colorClass} />
              <span>{option.label}</span>
              {current && <Check size={12} className="ml-auto text-primary" />}
            </button>
          );
        })}
      </div>
    </Portal>
  );
}

export function StatusDropdown({
  anchor,
  task,
  onSelect,
}: {
  anchor: DropdownAnchor;
  task: Task | undefined;
  onSelect: (taskId: string | number, status: Task["status"]) => void;
}) {
  const { t } = useI18n();
  if (!task) return null;
  return (
    <Portal>
      <div
        role="menu"
        className="status-dropdown-portal fixed z-[9999] min-w-40 rounded-lg border bg-popover py-1"
        style={{ top: anchor.top, left: anchor.left }}
      >
        {STATUS_OPTIONS.map((option) => {
          const Icon = option.icon;
          const current = task.status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(anchor.taskId, option.value);
              }}
              className={cn(ITEM, current && "bg-accent font-semibold")}
            >
              <Icon size={12} className={option.colorClass} />
              <span>{t(option.labelKey)}</span>
              {current && <Check size={12} className="ml-auto text-primary" />}
            </button>
          );
        })}
      </div>
    </Portal>
  );
}
