"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { columnSettings } from "@/lib/stores/columnSettings";
import { useStore } from "@/lib/store";
import { tOr } from "./t-or";

export function ColumnSettingsDropdown() {
  const { t } = useI18n();
  const settings = useStore(columnSettings);

  return (
    <div className="w-64 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
        {tOr(t, "columnSettings__title", "Card properties")}
      </div>
      <Separator />

      <div className="max-h-80 overflow-y-auto p-1">
        {settings.map((setting) => {
          const id = `column-${setting.id}`;
          return (
            <div key={setting.id} className="flex items-center justify-between rounded-sm px-2 py-1.5 hover:bg-accent">
              <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">
                {tOr(t, `columnSettings__label_${setting.id}`, setting.label)}
              </Label>
              <Switch id={id} checked={setting.enabled} onCheckedChange={() => columnSettings.toggle(setting.id)} />
            </div>
          );
        })}
      </div>

      <Separator />
      <div className="p-1">
        <Button variant="ghost" size="sm" className="w-full" onClick={() => columnSettings.reset()}>
          <RotateCcw />
          {tOr(t, "columnSettings__reset", "Reset to defaults")}
        </Button>
      </div>
    </div>
  );
}
