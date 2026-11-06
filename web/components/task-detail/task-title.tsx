"use client";

import { useEffect, useRef, useState } from "react";
import { Folder } from "lucide-react";
import { TitleEditor } from "@/components/editor/title-editor";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";

const TITLE_CLASS = "text-3xl leading-tight font-medium text-foreground";

interface TaskTitleProps {
  task: Task;
  shortName: string;
  onSave: (title: string) => Promise<void>;
}

export function TaskTitle({ task, shortName, onSave }: TaskTitleProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const editorRef = useRef<{ focus: () => void } | null>(null);

  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  useEffect(() => {
    if (!editing) return;
    const id = setTimeout(() => editorRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [editing]);

  async function save() {
    const next = draft.trim();
    if (!next || draft === task.title) {
      setEditing(false);
      setDraft(task.title);
      return;
    }
    await onSave(next);
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      {editing ? (
        <TitleEditor
          ref={editorRef}
          value={draft}
          onValueChange={setDraft}
          onBlur={() => void save()}
          className={TITLE_CLASS}
        />
      ) : (
        <>
          <div className="mb-1 flex items-center gap-2">
            {task.priority && task.priority !== "none" && <PriorityBadge priority={task.priority} />}
            {task.task_number ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {shortName || "TASK"}-{task.task_number}
              </span>
            ) : null}
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setEditing(true)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(true)}
            className={`${TITLE_CLASS} -ml-2 cursor-text rounded-lg px-2 py-1 transition-colors outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50`}
          >
            {task.title}
          </div>
        </>
      )}

      {task.project && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">{t("taskDetail__sub_issue_of")}</span>
          <Folder size={14} />
          <span className="transition-colors hover:text-primary">{task.project}</span>
        </div>
      )}
    </div>
  );
}
