"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertySelect } from "@/components/task-detail/property-select";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fieldOptions } from "./tc-options";

type TcSearchBoxProps = {
  value: string;
  onValueChange: (value: string) => void;
  field: string;
  onFieldChange: (field: string) => void;
  fieldSelectId: string;
  className?: string;
  fieldWidthClass?: string;
};

export function TcSearchBox({
  value,
  onValueChange,
  field,
  onFieldChange,
  fieldSelectId,
  className,
  fieldWidthClass = "w-44",
}: TcSearchBoxProps) {
  const { t } = useI18n();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="px-9"
          placeholder={t("tc__ph_search")}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
            aria-label="Clear search"
            onClick={() => onValueChange("")}
          >
            <X />
          </Button>
        )}
      </div>
      <PropertySelect
        id={fieldSelectId}
        value={field}
        options={fieldOptions}
        className={cn("h-9", fieldWidthClass)}
        onSelect={(v) => onFieldChange(String(v))}
      />
    </div>
  );
}
