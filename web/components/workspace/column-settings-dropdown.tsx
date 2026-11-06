"use client";

import { RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { columnSettings } from "@/lib/stores/columnSettings";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { tOr } from "./t-or";

export function ColumnSettingsDropdown() {
  const { t } = useI18n();
  const settings = useStore(columnSettings);

  return (
    <div className="w-64 origin-top-left overflow-hidden rounded-lg border bg-popover py-2 text-popover-foreground animate-in fade-in zoom-in-95 duration-150">
      <div className="mb-2 flex items-center justify-between border-b px-4 pt-1 pb-2">
        <h3 className="text-xs font-medium text-muted-foreground">
          {tOr(t, "columnSettings__title", "Card properties")}
        </h3>
      </div>

      <div className="max-h-80 overflow-y-auto px-1">
        {settings.map((setting) => (
          <button
            key={setting.id}
            type="button"
            role="switch"
            aria-checked={setting.enabled}
            onClick={() => columnSettings.toggle(setting.id)}
            className="group flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent"
          >
            <span className="font-medium">{tOr(t, `columnSettings__label_${setting.id}`, setting.label)}</span>
            <span
              aria-hidden="true"
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
                setting.enabled ? "bg-primary" : "bg-input",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-4 rounded-full bg-white shadow ring-0 transition duration-200",
                  setting.enabled ? "translate-x-4" : "translate-x-0",
                )}
              />
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2 border-t px-2 pt-2">
        <button
          type="button"
          onClick={() => columnSettings.reset()}
          className="flex w-full items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCcw size={14} />
          {tOr(t, "columnSettings__reset", "Reset to defaults")}
        </button>
      </div>
    </div>
  );
}
