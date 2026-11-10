"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { CommentList } from "@/components/task-detail/comment-list";
import { useTaskComments } from "@/components/task-detail/use-task-comments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { Assignee, Task } from "@/lib/types";

const FIRST_COMMENTS = 4;

/**
 * The latest comments of the previewed task, floating beside the dialog (below it on narrow screens).
 * Render it inside the dialog content so clicks in it never count as clicks outside the dialog.
 */
export function TableViewQuickComments({ task, assignees }: { task: Task; assignees: Assignee[] }) {
  const { t } = useI18n();
  const { comments, loading, remove } = useTaskComments({ taskDbId: task.id, loadVersion: 0 });
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? comments : comments.slice(0, FIRST_COMMENTS);

  return (
    <aside
      aria-label={t("taskForm__comments_title")}
      className="absolute top-full left-0 mt-3 flex max-h-[70vh] w-full flex-col rounded-lg border bg-popover text-popover-foreground shadow-lg xl:top-0 xl:left-full xl:mt-0 xl:ml-4 xl:w-80"
    >
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <MessageSquare className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t("taskForm__comments_title")}</h3>
        <Badge variant="secondary">{comments.length}</Badge>
        {comments.length > FIRST_COMMENTS && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ms-auto h-7 px-2 text-xs"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll
              ? t("tableView__comments_show_less")
              : t("tableView__comments_show_all", { count: comments.length })}
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        <CommentList comments={shown} loading={loading} assignees={assignees} onDelete={(id) => void remove(id)} />
      </div>
    </aside>
  );
}
