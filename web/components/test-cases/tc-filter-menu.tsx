"use client";

import { useI18n } from "@/lib/i18n";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHECKBOX, MENU_PANEL } from "./tc-styles";
import { useDismiss } from "./tc-use-dismiss";

type FilterProperty = { id: string; label: string };
type FilterOption = { value: string; label: string };

type TcFilterMenuProps = {
  properties: FilterProperty[];
  optionsFor: (property: string) => FilterOption[];
  selected: Record<string, string[]>;
  onToggle: (property: string, value: string) => void;
  onClearAll: () => void;
  clearLabel: string;
  clearOnlyWhenActive?: boolean;
  compact?: boolean;
};

export function TcFilterMenu({
  properties,
  optionsFor,
  selected,
  onToggle,
  onClearAll,
  clearLabel,
  clearOnlyWhenActive = false,
  compact = false,
}: TcFilterMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [activeProperty, setActiveProperty] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, open, () => setOpen(false));

  const total = Object.values(selected).reduce((sum, values) => sum + values.length, 0);
  const hasFilters = total > 0;

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-medium transition-all active:scale-95",
          compact && hasFilters
            ? "bg-primary/15 text-primary hover:bg-primary/20"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
        onClick={() => {
          setOpen((v) => !v);
          setActiveProperty(null);
        }}
      >
        <Plus size={16} />
        {t("tcopt__add_filter")}
        {compact && hasFilters && (
          <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {total}
          </span>
        )}
      </button>

      {open && (
        <div className={cn(MENU_PANEL, compact ? "right-0 top-full w-56" : "left-0 top-full w-64")}>
          {!activeProperty ? (
            <div className="flex flex-col py-1">
              <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Filter by
              </div>
              {properties.map((prop) => (
                <button
                  type="button"
                  key={prop.id}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  onClick={() => setActiveProperty(prop.id)}
                >
                  <span>{prop.label}</span>
                  <div className="flex items-center gap-1.5">
                    {compact && selected[prop.id]?.length > 0 && (
                      <span className="text-xs font-semibold text-primary">{selected[prop.id].length}</span>
                    )}
                    <ChevronRight size={14} className="opacity-30" />
                  </div>
                </button>
              ))}
              {(!clearOnlyWhenActive || hasFilters) && (
                <>
                  <div className="my-1 h-px bg-border" />
                  <button
                    type="button"
                    className="w-full px-4 py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    onClick={() => {
                      onClearAll();
                      setOpen(false);
                    }}
                  >
                    {clearLabel}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className={cn("flex flex-col overflow-y-auto py-1", compact ? "max-h-72" : "max-h-[400px]")}>
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  aria-label="Back"
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => setActiveProperty(null)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {properties.find((p) => p.id === activeProperty)?.label}
                </span>
              </div>
              <div className="mb-1 h-px bg-border" />
              {optionsFor(activeProperty).map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    className={CHECKBOX}
                    checked={selected[activeProperty]?.includes(opt.value) ?? false}
                    onChange={() => onToggle(activeProperty, opt.value)}
                  />
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
