"use client";

import { Calendar, Edit2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { formatDuration, getDateAfterDays } from "./sprint-utils";

export type SprintFormValues = { name: string; start: string; end: string; scope: string };

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
  const { name, start, end, scope } = values;

  return (
    <form
      className="mb-6 space-y-4 rounded-lg border p-4"
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
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="sprint-start-input">{t("sprintManager__label_start")}</Label>
          <DatePicker
            id="sprint-start-input"
            value={start}
            onChange={(nextStart) => {
              const nextEnd = !editing && nextStart !== start && nextStart ? getDateAfterDays(nextStart, 14) : end;
              onChange({ ...values, start: nextStart, end: nextEnd });
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sprint-end-input">{t("sprintManager__label_end")}</Label>
          <DatePicker id="sprint-end-input" value={end} onChange={(nextEnd) => onChange({ ...values, end: nextEnd })} />
        </div>

        {start && end && (
          <p className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar size={14} />
            {t("sprintManager__duration_label")} {formatDuration(t, start, end)}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="sprint-scope-input">{t("sprintManager__label_scope")}</Label>
        <Textarea
          id="sprint-scope-input"
          value={scope}
          rows={3}
          maxLength={2000}
          onChange={(e) => onChange({ ...values, scope: e.target.value })}
          placeholder={t("sprintManager__placeholder_scope")}
        />
      </div>

      <div className="flex gap-2">
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
