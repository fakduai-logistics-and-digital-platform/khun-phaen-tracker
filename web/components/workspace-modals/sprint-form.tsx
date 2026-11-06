"use client";

import { Calendar, Edit2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { formatDuration, getDateAfterDays } from "./sprint-utils";

export type SprintFormValues = { name: string; start: string; end: string };

export function SprintForm({
  values,
  editing,
  onChange,
  onSave,
  onCancel,
}: {
  values: SprintFormValues;
  editing: boolean;
  onChange: (values: SprintFormValues) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const { name, start, end } = values;

  return (
    <form
      className="mb-6 space-y-4 rounded-lg bg-muted p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="sprint-name-input">{t("sprintManager__label_name")}</Label>
        <Input
          id="sprint-name-input"
          value={name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          placeholder={t("sprintManager__placeholder_name")}
          className="bg-background"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="sprint-start-input">{t("sprintManager__label_start")}</Label>
          <Input
            id="sprint-start-input"
            type="date"
            value={start}
            onChange={(e) => {
              const nextStart = e.target.value;
              const nextEnd = !editing && nextStart !== start && nextStart ? getDateAfterDays(nextStart, 14) : end;
              onChange({ ...values, start: nextStart, end: nextEnd });
            }}
            className="bg-background"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sprint-end-input">{t("sprintManager__label_end")}</Label>
          <Input
            id="sprint-end-input"
            type="date"
            value={end}
            onChange={(e) => onChange({ ...values, end: e.target.value })}
            className="bg-background"
          />
        </div>

        {start && end && (
          <div className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-900/20">
            <Calendar size={16} className="text-blue-500" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {t("sprintManager__duration_label")} {formatDuration(t, start, end)}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={!name.trim() || !start || !end} className="flex-1">
          {editing ? <Edit2 size={16} /> : <Plus size={16} />}
          {editing ? t("common.save") : t("sprintManager__btn_create")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
