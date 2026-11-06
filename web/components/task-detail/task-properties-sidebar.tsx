"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDashed,
  CircleDot,
  Clock,
  Folder,
  Minus,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Tag,
  User,
} from "lucide-react";
import { DateField } from "./date-field";
import { PropertySelect } from "./property-select";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import type { Assignee, Project, Sprint, Task } from "@/lib/types";
import { TASK_TYPES, type TaskType } from "@/lib/utils/branch-name";

const SECTION_TITLE = "flex items-center justify-between text-sm font-medium";
const ROW = "col-span-2 grid min-h-9 grid-cols-subgrid items-center";

interface PropertyRowProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  children: React.ReactNode;
}

function PropertyRow({ icon: Icon, label, children }: PropertyRowProps) {
  return (
    <div className={ROW}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon size={16} />
        <span>{label}</span>
      </div>
      <div className="flex min-w-0 items-center justify-start">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={ROW}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <span className="px-2 text-sm text-muted-foreground">{value}</span>
    </div>
  );
}

interface TaskPropertiesSidebarProps {
  task: Task;
  projects: Project[];
  assignees: Assignee[];
  sprints: Sprint[];
  onUpdate: (updates: Partial<Task>) => void;
}

export function TaskPropertiesSidebar({ task, projects, assignees, sprints, onUpdate }: TaskPropertiesSidebarProps) {
  const { t } = useI18n();

  const statusOptions = useMemo(
    () => [
      { value: "pending", label: t("taskForm__status_pending"), icon: CircleDashed },
      { value: "todo", label: t("taskForm__status_todo"), icon: Circle },
      { value: "in-progress", label: t("taskForm__status_in_progress"), icon: CircleDot },
      { value: "in-test", label: t("taskForm__status_in_test"), icon: CircleDot },
      { value: "done", label: t("taskForm__status_done"), icon: CheckCircle2 },
    ],
    [t],
  );

  const priorityOptions = [
    { value: "none", label: "No priority", icon: Minus },
    { value: "urgent", label: "Urgent", icon: AlertTriangle },
    { value: "high", label: "High", icon: SignalHigh },
    { value: "medium", label: "Medium", icon: SignalMedium },
    { value: "low", label: "Low", icon: SignalLow },
  ];

  const typeOptions = useMemo(
    () => TASK_TYPES.map((type) => ({ value: type, label: t(`taskForm__task_type_${type}`) })),
    [t],
  );
  const assigneeOptions = useMemo(
    () => [{ value: "all", label: "Unassigned" }, ...assignees.map((a) => ({ value: a.id || "", label: a.name }))],
    [assignees],
  );
  const projectOptions = useMemo(
    () => [{ value: "", label: "No Project" }, ...projects.map((p) => ({ value: p.name, label: p.name }))],
    [projects],
  );
  const sprintOptions = useMemo(
    () => [{ value: "all", label: "No Sprint" }, ...sprints.map((s) => ({ value: s.id || "", label: s.name }))],
    [sprints],
  );

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className={SECTION_TITLE}>
          <span>{t("taskDetail__properties")}</span>
          <ChevronDown size={16} className="text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="grid grid-cols-[112px_1fr] gap-y-1">
          <PropertyRow icon={Clock} label={t("taskForm__status_label")}>
            <PropertySelect
              id="task-status"
              value={task.status}
              options={statusOptions}
              onSelect={(value: string | number | null) => onUpdate({ status: value as Task["status"] })}
            />
          </PropertyRow>

          <PropertyRow icon={Tag} label={t("taskForm__task_type_label")}>
            <PropertySelect
              id="task-type"
              value={task.task_type || "feature"}
              options={typeOptions}
              onSelect={(value: string | number | null) => onUpdate({ task_type: value as TaskType })}
            />
          </PropertyRow>

          <PropertyRow icon={AlertTriangle} label="Priority">
            <PropertySelect
              id="task-priority"
              value={task.priority || "none"}
              options={priorityOptions}
              onSelect={(value) => onUpdate({ priority: value as Task["priority"] })}
            />
          </PropertyRow>

          <PropertyRow icon={User} label={t("taskForm__assignee_label")}>
            <PropertySelect
              id="task-assignee"
              value={task.assignee_id || task.assignee_ids?.[0] || "all"}
              options={assigneeOptions}
              onSelect={(value: string | number | null) =>
                onUpdate({ assignee_ids: value === "all" || value == null ? [] : [value] })
              }
            />
          </PropertyRow>

          <PropertyRow icon={Folder} label={t("taskForm__project_label")}>
            <PropertySelect
              id="task-project"
              value={task.project || ""}
              options={projectOptions}
              onSelect={(value: string | number | null) => onUpdate({ project: String(value ?? "") })}
            />
          </PropertyRow>

          <PropertyRow icon={Tag} label={t("taskForm__sprint_label")}>
            <PropertySelect
              id="task-sprint"
              value={task.sprint_id || "all"}
              options={sprintOptions}
              onSelect={(value: string | number | null) => onUpdate({ sprint_id: value === "all" ? null : value })}
            />
          </PropertyRow>

          <PropertyRow icon={Calendar} label={t("taskForm__due_date_label")}>
            <DateField
              id="task-due-date"
              value={task.due_date || task.end_date || ""}
              placeholder={t("taskForm__due_date_placeholder")}
              onSelect={(value) => onUpdate({ due_date: value })}
            />
          </PropertyRow>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <div className={SECTION_TITLE}>
          <span>{t("taskDetail__details")}</span>
          <ChevronDown size={16} className="text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="grid grid-cols-[112px_1fr] gap-y-1">
          <DetailRow
            label={t("taskDetail__created_at")}
            value={task.created_at ? new Date(task.created_at).toLocaleDateString() : "-"}
          />
          {task.updated_at && (
            <DetailRow label={t("taskDetail__updated_at")} value={new Date(task.updated_at).toLocaleDateString()} />
          )}
        </div>
      </div>
    </>
  );
}
