"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import type { Assignee } from "@/lib/types";
import { cn } from "@/lib/utils";

type AssigneeMultiSelectProps = {
  id?: string;
  assignees: Assignee[];
  value: (string | number)[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
};

function Dot({ assignee }: { assignee: Assignee }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-background"
      style={{ backgroundColor: assignee.color || "#6366f1" }}
    >
      {assignee.name?.[0]?.toUpperCase() || "?"}
    </span>
  );
}

/** Pick any number of assignees from a searchable list; the list stays open so several can be ticked in a row. */
export function AssigneeMultiSelect({ id, assignees, value, onChange, disabled, className }: AssigneeMultiSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const selectedIds = useMemo(() => value.map(String), [value]);
  const selected = assignees.filter((a) => a.id != null && selectedIds.includes(String(a.id)));
  const label =
    selected.length === 0
      ? t("taskForm__unassigned")
      : selected.length <= 2
        ? selected.map((a) => a.name).join(", ")
        : `${selected[0].name} +${selected.length - 1}`;

  function toggle(assigneeId: string) {
    onChange(
      selectedIds.includes(assigneeId) ? selectedIds.filter((x) => x !== assigneeId) : [...selectedIds, assigneeId],
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("w-full max-w-64 justify-between font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected.length > 0 && (
              <span className="flex shrink-0 -space-x-1.5">
                {selected.slice(0, 3).map((a) => (
                  <Dot key={a.id} assignee={a} />
                ))}
              </span>
            )}
            <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>{label}</span>
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={t("assigneePicker__search")} />
          <CommandList>
            <CommandEmpty>{t("assigneePicker__empty")}</CommandEmpty>
            <CommandGroup>
              {assignees
                .filter((a) => a.id != null)
                .map((a) => {
                  const checked = selectedIds.includes(String(a.id));
                  return (
                    <CommandItem key={a.id} value={`${a.name} ${a.id}`} onSelect={() => toggle(String(a.id))}>
                      <Dot assignee={a} />
                      <span className="truncate">{a.name}</span>
                      <Check className={cn("ml-auto", checked ? "opacity-100" : "opacity-0")} />
                    </CommandItem>
                  );
                })}
            </CommandGroup>
            {selected.length > 0 && (
              <CommandGroup>
                <CommandItem value="__clear__" onSelect={() => onChange([])} className="text-muted-foreground">
                  {t("assigneePicker__clear")}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
