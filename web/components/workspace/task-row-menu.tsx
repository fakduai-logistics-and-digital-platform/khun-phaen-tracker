"use client";

import { ClipboardCopy, Copy, Edit2, Eye, Hash, Link2, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { withBase } from "@/lib/base-path";
import { useI18n } from "@/lib/i18n";
import { taskPath } from "@/lib/routes";
import type { Task } from "@/lib/types";
import { tOr } from "./t-or";

export type TaskRowMenuHandlers = {
  task: Task;
  shortName: string | null;
  onPreview: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDuplicate: (task: Task) => void;
  onDelete: () => void;
};

type Primitives = {
  Content: typeof DropdownMenuContent | typeof ContextMenuContent;
  Item: typeof DropdownMenuItem | typeof ContextMenuItem;
  Separator: typeof DropdownMenuSeparator | typeof ContextMenuSeparator;
  Sub: typeof DropdownMenuSub | typeof ContextMenuSub;
  SubTrigger: typeof DropdownMenuSubTrigger | typeof ContextMenuSubTrigger;
  SubContent: typeof DropdownMenuSubContent | typeof ContextMenuSubContent;
};

const DROPDOWN: Primitives = {
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

const CONTEXT: Primitives = {
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};

/** Human-readable key such as `VDM-97`, falling back to the raw id for tasks without a number. */
export function taskKey(task: Task, shortName: string | null) {
  return task.task_number
    ? `${task.workspace_short_name || shortName || "TASK"}-${task.task_number}`
    : String(task.id ?? "");
}

function TaskRowMenuItems({
  ui,
  task,
  shortName,
  onPreview,
  onEdit,
  onDuplicate,
  onDelete,
}: TaskRowMenuHandlers & { ui: Primitives }) {
  const { t } = useI18n();
  const { Item, Separator, Sub, SubTrigger, SubContent } = ui as {
    Item: typeof DropdownMenuItem;
    Separator: typeof DropdownMenuSeparator;
    Sub: typeof DropdownMenuSub;
    SubTrigger: typeof DropdownMenuSubTrigger;
    SubContent: typeof DropdownMenuSubContent;
  };

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("taskMenu__copied"));
    } catch {
      toast.error(t("taskMenu__copy_failed"));
    }
  }

  const key = taskKey(task, shortName);
  const link = () => `${window.location.origin}${withBase(taskPath(task.workspace_id ?? "", task.id ?? ""))}`;

  return (
    <>
      <Item onSelect={() => onPreview(task)}>
        <Eye />
        {tOr(t, "tableView__quick_preview", "Quick preview")}
      </Item>
      <Item onSelect={() => onEdit(task)}>
        <Edit2 />
        {t("taskList__edit")}
      </Item>
      <Item onSelect={() => onDuplicate(task)}>
        <Copy />
        {t("taskMenu__duplicate")}
      </Item>
      <Sub>
        <SubTrigger>
          <ClipboardCopy />
          {t("taskMenu__copy_as")}
        </SubTrigger>
        <SubContent>
          <Item onSelect={() => void copy(key)}>
            <Hash />
            {t("taskMenu__copy_id")}
          </Item>
          <Item onSelect={() => void copy(task.title)}>
            <Type />
            {t("taskMenu__copy_name")}
          </Item>
          <Item onSelect={() => void copy(`${key} ${task.title}`)}>
            <ClipboardCopy />
            {t("taskMenu__copy_id_name")}
          </Item>
          <Item onSelect={() => void copy(link())}>
            <Link2 />
            {t("taskMenu__copy_link")}
          </Item>
        </SubContent>
      </Sub>
      <Separator />
      <Item variant="destructive" onSelect={onDelete}>
        <Trash2 />
        {t("taskList__delete")}
      </Item>
    </>
  );
}

export function TaskDropdownContent(props: TaskRowMenuHandlers) {
  return (
    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
      <TaskRowMenuItems ui={DROPDOWN} {...props} />
    </DropdownMenuContent>
  );
}

export function TaskContextContent(props: TaskRowMenuHandlers) {
  return (
    <ContextMenuContent className="w-52" onClick={(e) => e.stopPropagation()}>
      <TaskRowMenuItems ui={CONTEXT} {...props} />
    </ContextMenuContent>
  );
}
