"use client";

import { ArrowDownUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_SORTS, SORT_FIELDS, type SortRule } from "./table-query";
import type { SortColumn } from "./table-view-config";

export const FIELD_LABEL_KEY: Record<string, string> = {
  title: "tableView__column_title",
  status: "tableView__column_status",
  priority: "tableView__column_priority",
  project: "tableView__column_project",
  category: "tableView__column_category",
  assignee: "tableView__column_assignee",
  sprint: "tableView__column_sprint",
  date: "tableView__column_due_date",
  created_at: "tableQuery__field_created",
};

type Props = { sorts: SortRule[]; onChange: (sorts: SortRule[]) => void };

export function TableViewSortMenu({ sorts, onChange }: Props) {
  const { t } = useI18n();
  const unused = SORT_FIELDS.filter((field) => !sorts.some((rule) => rule.id === field));

  function update(index: number, patch: Partial<SortRule>) {
    onChange(sorts.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8">
          <ArrowDownUp />
          {t("tableQuery__sort")}
          {sorts.length > 0 && (
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {sorts.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-[22rem] flex-col gap-3">
        <p className="text-sm font-medium">{t("tableQuery__sort_by")}</p>
        <ul className="flex flex-col gap-2">
          {sorts.map((rule, index) => (
            <li key={rule.id} className="flex items-center gap-2">
              <Select value={rule.id} onValueChange={(value) => update(index, { id: value as SortColumn })}>
                <SelectTrigger className="h-8 flex-1" aria-label={t("tableQuery__sort_by")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_FIELDS.filter((field) => field === rule.id || unused.includes(field)).map((field) => (
                    <SelectItem key={field} value={field}>
                      {t(FIELD_LABEL_KEY[field])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={rule.desc ? "desc" : "asc"}
                onValueChange={(value) => update(index, { desc: value === "desc" })}
              >
                <SelectTrigger className="h-8 w-24" aria-label={t("tableQuery__direction")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">{t("tableQuery__asc")}</SelectItem>
                  <SelectItem value="desc">{t("tableQuery__desc")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0"
                aria-label={t("tableQuery__remove_sort")}
                onClick={() => onChange(sorts.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={unused.length === 0}
            onClick={() => onChange([...sorts, { id: unused[0], desc: false }])}
          >
            {t("tableQuery__add_sort")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(DEFAULT_SORTS)}>
            {t("tableQuery__reset_sort")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
