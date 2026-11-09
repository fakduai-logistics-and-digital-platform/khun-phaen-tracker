"use client";

import { useMemo } from "react";
import { Check, CircleDashed, ListFilter, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import type { Sprint, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FILTER_FIELDS, type FilterField, type FilterOperator, type FilterRule } from "./table-query";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./table-view-config";
import { FIELD_LABEL_KEY } from "./table-view-sort-menu";

type Option = { value: string; label: string; icon?: LucideIcon };

const OPERATORS: Record<"options" | "text", { value: FilterOperator; key: string }[]> = {
  options: [
    { value: "any", key: "tableQuery__op_any" },
    { value: "none", key: "tableQuery__op_none" },
  ],
  text: [
    { value: "contains", key: "tableQuery__op_contains" },
    { value: "not_contains", key: "tableQuery__op_not_contains" },
  ],
};

const isText = (field: FilterField) => field === "title";

function useFilterOptions(tasks: Task[], sprints: Sprint[]): Record<FilterField, Option[]> {
  const { t } = useI18n();
  return useMemo(() => {
    const unique = (pick: (task: Task) => string | undefined) =>
      Array.from(new Set(tasks.map(pick).filter((value): value is string => !!value)))
        .sort()
        .map((value) => ({ value, label: value }));
    const assignees = new Map<string, string>();
    tasks.forEach((task) => task.assignees?.forEach((a) => assignees.set(String(a.id), a.name)));
    return {
      title: [],
      status: [
        { value: "todo", label: t("page__filter_status_todo"), icon: CircleDashed },
        ...STATUS_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey), icon: o.icon })),
      ],
      priority: PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label, icon: o.icon })),
      category: unique((task) => task.category),
      project: unique((task) => task.project),
      assignee: Array.from(assignees, ([value, label]) => ({ value, label })),
      sprint: sprints.map((sprint) => ({ value: String(sprint.id), label: sprint.name })),
    };
  }, [tasks, sprints, t]);
}

function ValueEditor({
  rule,
  options,
  onChange,
}: {
  rule: FilterRule;
  options: Option[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useI18n();
  if (isText(rule.id)) {
    return (
      <Input
        className="h-8"
        value={rule.values[0] ?? ""}
        onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
        placeholder={t("tableQuery__text_placeholder")}
        aria-label={t(FIELD_LABEL_KEY[rule.id])}
      />
    );
  }
  return (
    <Command>
      <CommandInput placeholder={t(FIELD_LABEL_KEY[rule.id])} />
      <CommandList>
        <CommandEmpty>{t("users__no_results")}</CommandEmpty>
        <CommandGroup>
          {options.map((option) => {
            const selected = rule.values.includes(option.value);
            return (
              <CommandItem
                key={option.value}
                onSelect={() =>
                  onChange(selected ? rule.values.filter((v) => v !== option.value) : [...rule.values, option.value])
                }
              >
                {option.icon && <option.icon className="text-muted-foreground" />}
                <span className="truncate">{option.label}</span>
                {selected && <Check className="ms-auto" />}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function FilterChip({
  rule,
  options,
  open,
  onOpenChange,
  onChange,
  onRemove,
}: {
  rule: FilterRule;
  options: Option[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (rule: FilterRule) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const kind = isText(rule.id) ? "text" : "options";
  const operator = OPERATORS[kind].find((op) => op.value === rule.operator) ?? OPERATORS[kind][0];
  const chosen = options.filter((option) => rule.values.includes(option.value));

  return (
    <div className="flex h-8 items-center divide-x overflow-hidden rounded-md border bg-background text-sm duration-200 animate-in fade-in zoom-in-95">
      <span className="px-2.5 font-medium">{t(FIELD_LABEL_KEY[rule.id])}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="h-full px-2.5 text-muted-foreground hover:bg-accent">
            {t(operator.key)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={operator.value}
            onValueChange={(value) => onChange({ ...rule, operator: value as FilterOperator })}
          >
            {OPERATORS[kind].map((op) => (
              <DropdownMenuRadioItem key={op.value} value={op.value}>
                {t(op.key)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button type="button" className="flex h-full max-w-56 items-center gap-1.5 px-2.5 hover:bg-accent">
            {kind === "text" ? (
              <span className="truncate">{rule.values[0] || t("tableQuery__select_value")}</span>
            ) : chosen.length === 0 ? (
              <span className="text-muted-foreground">{t("tableQuery__select_value")}</span>
            ) : chosen.length <= 2 ? (
              chosen.map((option) => (
                <span key={option.value} className="flex items-center gap-1">
                  {option.icon && <option.icon className="size-3.5 text-muted-foreground" />}
                  {option.label}
                </span>
              ))
            ) : (
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {t("tableQuery__selected_count", { count: chosen.length })}
              </Badge>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          <div className={cn(kind === "text" && "p-2")}>
            <ValueEditor rule={rule} options={options} onChange={(values) => onChange({ ...rule, values })} />
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        className="flex h-full items-center px-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onRemove}
        aria-label={t("tableQuery__remove_filter")}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

type Props = {
  tasks: Task[];
  sprints: Sprint[];
  filters: FilterRule[];
  openField: FilterField | null;
  onOpenField: (field: FilterField | null) => void;
  onChange: (filters: FilterRule[]) => void;
};

/** Filter chips plus the "add filter" menu. Values are applied client-side over every loaded task. */
export function TableViewFilterMenu({ tasks, sprints, filters, openField, onOpenField, onChange }: Props) {
  const { t } = useI18n();
  const options = useFilterOptions(tasks, sprints);

  function addFilter(field: FilterField) {
    if (!filters.some((rule) => rule.id === field)) {
      onChange([...filters, { id: field, operator: isText(field) ? "contains" : "any", values: [] }]);
    }
    onOpenField(field);
  }

  return (
    <>
      {filters.map((rule) => (
        <FilterChip
          key={rule.id}
          rule={rule}
          options={options[rule.id]}
          open={openField === rule.id}
          onOpenChange={(open) => onOpenField(open ? rule.id : null)}
          onChange={(next) => onChange(filters.map((r) => (r.id === rule.id ? next : r)))}
          onRemove={() => onChange(filters.filter((r) => r.id !== rule.id))}
        />
      ))}
      {filters.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={t("tableQuery__clear_filters")}
          onClick={() => onChange([])}
        >
          <X />
        </Button>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={filters.length > 0 ? "icon" : "sm"}
            className={cn("h-8", filters.length > 0 && "size-8")}
            aria-label={t("tableQuery__filter")}
          >
            <ListFilter />
            {filters.length === 0 && t("tableQuery__filter")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          <Command>
            <CommandInput placeholder={t("tableQuery__search_fields")} />
            <CommandList>
              <CommandEmpty>{t("users__no_results")}</CommandEmpty>
              <CommandGroup>
                {FILTER_FIELDS.map((field) => (
                  <CommandItem key={field} onSelect={() => addFilter(field)}>
                    {t(FIELD_LABEL_KEY[field])}
                    {filters.some((rule) => rule.id === field) && <Check className="ms-auto" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
