"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { columnSettings } from "@/lib/stores/columnSettings";

/** "View" menu that shows or hides table columns; choices persist in localStorage via `columnSettings`. */
export function TableViewColumnToggle() {
  const { t } = useI18n();
  const settings = useStore(columnSettings);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <SlidersHorizontal />
          {t("tableView__view")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("tableView__toggle_columns")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {settings.map((setting) => (
          <DropdownMenuCheckboxItem
            key={setting.id}
            checked={setting.enabled}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => columnSettings.toggle(setting.id)}
          >
            {t(
              `tableView__column_${setting.id === "date" ? "due_date" : setting.id}`,
            )}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
