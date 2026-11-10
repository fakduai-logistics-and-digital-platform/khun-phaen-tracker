"use client";

import { useMemo, useState } from "react";
import { Calendar, Clock, Eye, Folder, Maximize2, SignalHigh, User } from "lucide-react";
import { TableViewQuickComments } from "./table-view-quick-comments";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
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

type Draft = {
  title: string;
  notes: string;
  priority: NonNullable<Task["priority"]>;
  status: Task["status"];
  assignee_ids: string[];
  due_date: string;
  project: string;
};

function draftOf(task: Task): Draft {
  const ids = task.assignee_ids?.length ? task.assignee_ids : task.assignee_id ? [task.assignee_id] : [];
  return {
    title: task.title,
    notes: task.notes ?? "",
    priority: task.priority || "none",
    status: task.status,
    assignee_ids: ids.map(String),
    due_date: dueDateOf(task),
    project: task.project || "",
  };
}

/** Edits stay in a draft until Save, so every field changes on screen at once and one request stores them together. */
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
  const original = useMemo(() => draftOf(task), [task]);
  const [draft, setDraft] = useState<Draft>(original);

  const changes = useMemo(() => {
    const next: Partial<Task> = {};
    const title = draft.title.trim();
    if (title && title !== original.title) next.title = title;
    if (draft.notes !== original.notes) next.notes = draft.notes;
    if (draft.priority !== original.priority) next.priority = draft.priority;
    if (draft.status !== original.status) next.status = draft.status;
    if (draft.due_date !== original.due_date) next.due_date = draft.due_date;
    if (draft.project !== original.project) next.project = draft.project;
    if ([...draft.assignee_ids].sort().join() !== [...original.assignee_ids].sort().join()) {
      next.assignee_ids = draft.assignee_ids;
    }
    return next;
  }, [draft, original]);
  const dirty = Object.keys(changes).length > 0;

  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((o) => ({ value: o.value, label: getStatusLabel(o.value, t), icon: o.icon })),
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

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  function save() {
    if (!dirty) return;
    onUpdate(id, changes);
    onClose();
  }

  function openFull() {
    if (dirty) onUpdate(id, changes);
    onClose();
    onOpenFull(task);
  }

  return (
    <>
      <TableViewQuickComments task={task} assignees={assignees} />
      <DialogHeader className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Eye size={16} className="text-muted-foreground" />
            {tOr(t, "tableView__quick_preview", "Quick preview")}
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            title={tOr(t, "tableView__open_full", "Open full")}
            aria-label={tOr(t, "tableView__open_full", "Open full")}
            onClick={openFull}
          >
            <Maximize2 />
          </Button>
        </div>
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
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            className="h-auto border-transparent px-2 py-1 text-lg font-medium shadow-none hover:bg-accent/50 md:text-lg"
          />
        </div>

        <div className="space-y-1">
          <PreviewRow icon={SignalHigh} label={t("tableView__column_priority")}>
            <PropertySelect
              id="preview-priority"
              value={draft.priority}
              options={priorityOptions}
              onSelect={(value) => set("priority", value as Draft["priority"])}
            />
          </PreviewRow>

          <PreviewRow icon={Clock} label={t("tableView__column_status")}>
            <PropertySelect
              id="preview-status"
              value={draft.status}
              options={statusOptions}
              onSelect={(value) => set("status", value as Task["status"])}
            />
          </PreviewRow>

          <PreviewRow icon={User} label={t("tableView__column_assignee")}>
            <AssigneeMultiSelect
              id="preview-assignee"
              assignees={assignees}
              value={draft.assignee_ids}
              onChange={(ids) => set("assignee_ids", ids)}
            />
          </PreviewRow>

          <PreviewRow icon={Calendar} label={t("tableView__column_due_date")}>
            <DateField
              id="preview-due-date"
              value={draft.due_date}
              placeholder={t("taskForm__due_date_placeholder")}
              onSelect={(value) => set("due_date", value)}
            />
          </PreviewRow>

          <PreviewRow icon={Folder} label={t("tableView__column_project")}>
            <PropertySelect
              id="preview-project"
              value={draft.project}
              options={projectOptions}
              onSelect={(value) => set("project", String(value ?? ""))}
            />
          </PreviewRow>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{tOr(t, "tableView__notes_label", "Notes")}</p>
          <div className="max-h-72 overflow-y-auto rounded-md border bg-background px-3 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <RichTextEditor
              value={draft.notes}
              onChange={(value) => set("notes", value)}
              placeholder={tOr(t, "tableView__no_notes", "No notes")}
            />
          </div>
        </div>
      </div>

      <DialogFooter className="border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onClose}>
          {tOr(t, "tableView__close", "Close")}
        </Button>
        <Button type="button" disabled={!dirty} onClick={save}>
          {t("page__save")}
        </Button>
      </DialogFooter>
    </>
  );
}

export function TableViewQuickPreview({ task, onClose, ...rest }: TableViewQuickPreviewProps) {
  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="z-[10000] gap-0 overflow-visible p-0 sm:max-w-lg">
        {task && <PreviewBody key={String(task.id)} task={task} onClose={onClose} {...rest} />}
      </DialogContent>
    </Dialog>
  );
}
