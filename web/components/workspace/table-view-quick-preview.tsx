"use client";

import { useMemo, useState } from "react";
import { Calendar, Clock, Eye, Folder, SignalHigh, User } from "lucide-react";
import { AssigneeMultiSelect } from "@/components/shared/assignee-multi-select";
import { DateField } from "@/components/task-detail/date-field";
import { PropertySelect } from "@/components/task-detail/property-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { currentWorkspaceShortName } from "@/lib/stores/workspace";
import type { Assignee, Project, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { tOr } from "./t-or";
import { dueDateOf, getStatusLabel, PRIORITY_OPTIONS, STATUS_OPTIONS } from "./table-view-config";

type Id = string | number;

interface TableViewQuickPreviewProps {
  task: Task | null;
  assignees: Assignee[];
  projects: Project[];
  onUpdate: (id: Id, updates: Partial<Task>) => void;
  onClose: () => void;
  onOpenFull: (task: Task) => void;
}

function PreviewRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-h-9 grid-cols-[112px_1fr] items-center gap-2", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon size={16} />
        <span>{label}</span>
      </div>
      <div className="flex min-w-0 items-center">{children}</div>
    </div>
  );
}

function PreviewBody({
  task,
  assignees,
  projects,
  onUpdate,
  onClose,
  onOpenFull,
}: Omit<TableViewQuickPreviewProps, "task"> & { task: Task }) {
  const { t } = useI18n();
  const shortName = useStore(currentWorkspaceShortName);
  const id = task.id as Id;
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");

  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((o) => ({
        value: o.value,
        label: getStatusLabel(o.value, t),
        icon: o.icon,
      })),
    [t],
  );
  const priorityOptions = useMemo(
    () => PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label, icon: o.icon })),
    [],
  );
  const projectOptions = useMemo(
    () => [
      { value: "", label: t("taskForm__unassigned_project") },
      ...projects.map((p) => ({ value: p.name, label: p.name })),
    ],
    [projects, t],
  );

  function saveTitle() {
    const next = title.trim();
    if (!next) return setTitle(task.title);
    if (next !== task.title) onUpdate(id, { title: next });
  }

  function saveNotes() {
    if (notes !== (task.notes ?? "")) onUpdate(id, { notes });
  }

  const assigneeIds = task.assignee_ids?.length ? task.assignee_ids : task.assignee_id ? [task.assignee_id] : [];

  return (
    <>
      <DialogHeader className="border-b px-6 py-4">
        <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
          <Eye size={16} className="text-muted-foreground" />
          {tOr(t, "tableView__quick_preview", "Quick preview")}
        </DialogTitle>
        <DialogDescription className="sr-only">{task.title}</DialogDescription>
      </DialogHeader>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
        <div className="space-y-1">
          {task.task_number ? (
            <span className="text-xs font-medium text-muted-foreground">
              {task.workspace_short_name || shortName || "TASK"}-{task.task_number}
            </span>
          ) : null}
          <Input
            aria-label={t("tableView__column_title")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="h-auto border-transparent px-2 py-1 text-lg font-medium shadow-none hover:bg-accent/50 md:text-lg"
          />
        </div>

        <div className="space-y-1">
          <PreviewRow icon={SignalHigh} label={t("tableView__column_priority")}>
            <PropertySelect
              id="preview-priority"
              value={task.priority || "none"}
              options={priorityOptions}
              onSelect={(value) => onUpdate(id, { priority: value as Task["priority"] })}
            />
          </PreviewRow>

          <PreviewRow icon={Clock} label={t("tableView__column_status")}>
            <PropertySelect
              id="preview-status"
              value={task.status}
              options={statusOptions}
              onSelect={(value) => onUpdate(id, { status: value as Task["status"] })}
            />
          </PreviewRow>

          <PreviewRow icon={User} label={t("tableView__column_assignee")}>
            <AssigneeMultiSelect
              id="preview-assignee"
              assignees={assignees}
              value={assigneeIds}
              onChange={(ids) => onUpdate(id, { assignee_ids: ids })}
            />
          </PreviewRow>

          <PreviewRow icon={Calendar} label={t("tableView__column_due_date")}>
            <DateField
              id="preview-due-date"
              value={dueDateOf(task)}
              placeholder={t("taskForm__due_date_placeholder")}
              onSelect={(value) => onUpdate(id, { due_date: value })}
            />
          </PreviewRow>

          <PreviewRow icon={Folder} label={t("tableView__column_project")}>
            <PropertySelect
              id="preview-project"
              value={task.project || ""}
              options={projectOptions}
              onSelect={(value) => onUpdate(id, { project: String(value ?? "") })}
            />
          </PreviewRow>
        </div>

        <div className="space-y-2">
          <label htmlFor="preview-notes" className="text-sm font-medium">
            {tOr(t, "tableView__notes_label", "Notes")}
          </label>
          <Textarea
            id="preview-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder={tOr(t, "tableView__no_notes", "No notes")}
            className="max-h-64 min-h-32"
          />
        </div>
      </div>

      <DialogFooter className="border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onClose}>
          {tOr(t, "tableView__close", "Close")}
        </Button>
        <Button
          type="button"
          onClick={() => {
            onClose();
            onOpenFull(task);
          }}
        >
          {tOr(t, "tableView__open_full", "Open full")}
        </Button>
      </DialogFooter>
    </>
  );
}

export function TableViewQuickPreview({ task, onClose, ...rest }: TableViewQuickPreviewProps) {
  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton className="z-[10000] gap-0 overflow-hidden p-0 sm:max-w-lg">
        {task && <PreviewBody key={String(task.id)} task={task} onClose={onClose} {...rest} />}
      </DialogContent>
    </Dialog>
  );
}
