"use client";

import { CheckCircle2, Circle, CircleDashed, CircleDot, Folder } from "lucide-react";
import { Label } from "@/components/ui/label";
import { AssigneeSelector } from "@/components/shared/assignee-selector";
import { CustomDatePicker } from "@/components/shared/custom-date-picker";
import { PrioritySelector } from "@/components/shared/priority-selector";
import { SearchableSelect, type SelectOption } from "@/components/shared/searchable-select";
import { useI18n } from "@/lib/i18n";
import type { Assignee, AssigneeGroup, Project, Task } from "@/lib/types";
import { TASK_TYPES, type TaskType } from "@/lib/utils/branch-name";
import type { TaskFormValues } from "./use-task-form-values";

const TYPE_ICON_CLASS: Record<TaskType, string> = {
  feature: "text-indigo-400",
  bug: "text-destructive",
  optimize: "text-yellow-400",
  refactor: "text-blue-400",
  docs: "text-success",
  chore: "text-muted-foreground",
};

export interface TaskFormPropertiesProps {
  values: TaskFormValues;
  patch: (partial: Partial<TaskFormValues>) => void;
  assignees: Assignee[];
  assigneeGroups: AssigneeGroup[];
  projects: Project[];
  isOwner: boolean;
  onAddAssignee?: (detail: { name: string; color: string }) => void;
}

export function TaskFormProperties({
  values,
  patch,
  assignees,
  assigneeGroups,
  projects,
  isOwner,
  onAddAssignee,
}: TaskFormPropertiesProps) {
  const { t } = useI18n();

  const statusOptions: SelectOption[] = [
    { value: "pending", label: t("taskForm__status_pending"), icon: CircleDashed, iconClass: "text-muted-foreground" },
    { value: "todo", label: t("taskForm__status_todo"), icon: Circle, iconClass: "text-muted-foreground" },
    { value: "in-progress", label: t("taskForm__status_in_progress"), icon: CircleDot, iconClass: "text-yellow-500" },
    { value: "in-test", label: t("taskForm__status_in_test"), icon: CircleDot, iconClass: "text-success" },
    { value: "done", label: t("taskForm__status_done"), icon: CheckCircle2, iconClass: "text-blue-500" },
  ];

  const typeOptions: SelectOption[] = TASK_TYPES.map((type) => ({
    value: type,
    label: t(`taskForm__task_type_${type}`),
    icon: CircleDot,
    iconClass: TYPE_ICON_CLASS[type],
  }));

  const projectOptions: SelectOption[] = [
    { value: "", label: t("taskForm__no_project"), icon: Folder },
    ...projects.map((project) => ({ value: project.name, label: project.name, icon: Folder })),
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field id="status" label={t("taskForm__status_label")}>
        <SearchableSelect
          id="status"
          value={values.status}
          onValueChange={(value) => patch({ status: value as Task["status"] })}
          options={statusOptions}
          showSearch={false}
        />
      </Field>

      <Field id="priority" label={t("taskForm__priority_label")}>
        <PrioritySelector minimal={false} value={values.priority} onValueChange={(priority) => patch({ priority })} />
      </Field>

      <Field id="task_type" label={t("taskForm__task_type_label")}>
        <SearchableSelect
          id="task_type"
          value={values.task_type ?? null}
          onValueChange={(value) => patch({ task_type: (value as TaskType | null) ?? undefined })}
          options={typeOptions}
          showSearch={false}
        />
      </Field>

      <AssigneeSelector
        assignees={assignees}
        assigneeGroups={assigneeGroups}
        assignee_ids={values.assignee_ids}
        onAssignee_idsChange={(assignee_ids) => patch({ assignee_ids })}
        readonly={!isOwner}
        onAddAssignee={onAddAssignee}
      />

      <Field id="end_date" label={t("taskForm__due_date_label")}>
        <CustomDatePicker
          value={values.end_date}
          onValueChange={(end_date) => patch({ end_date })}
          placeholder={t("taskForm__due_date_placeholder")}
          dropdownPosition="top"
        />
      </Field>

      <Field id="project" label={t("taskForm__project_label")}>
        <SearchableSelect
          id="project"
          value={values.project}
          onValueChange={(value) => patch({ project: String(value ?? "") })}
          options={projectOptions}
          placeholder={t("taskForm__project_placeholder")}
        />
      </Field>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
