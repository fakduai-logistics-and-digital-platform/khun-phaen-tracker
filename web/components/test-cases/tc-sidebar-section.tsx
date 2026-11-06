"use client";

import { ChevronDown, Plus } from "lucide-react";
import { ICON_BTN } from "./tc-styles";
import { cn } from "@/lib/utils";

type TcSidebarSectionHeaderProps = {
  title: string;
  open: boolean;
  onToggle: () => void;
  toggleLabel: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
};

export function TcSidebarSectionHeader({
  title,
  open,
  onToggle,
  toggleLabel,
  count,
  actionLabel,
  onAction,
}: TcSidebarSectionHeaderProps) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <button
        type="button"
        className={ICON_BTN}
        aria-label={toggleLabel}
        aria-expanded={open}
        title={toggleLabel}
        onClick={onToggle}
      >
        <ChevronDown size={16} className={cn("transition-transform duration-200", !open && "-rotate-90")} />
      </button>
      <h2 className="flex-1 text-sm font-semibold text-foreground">{title}</h2>
      {count !== undefined && <span className="text-xs font-semibold text-muted-foreground">{count}</span>}
      {onAction && (
        <button type="button" className={ICON_BTN} aria-label={actionLabel} title={actionLabel} onClick={onAction}>
          <Plus size={16} />
        </button>
      )}
    </div>
  );
}
