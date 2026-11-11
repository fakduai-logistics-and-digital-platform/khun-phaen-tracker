"use client";

import { workspacePath } from "@/lib/routes";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { ChecklistManager } from "@/components/workspace-modals/checklist-manager";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import type { Assignee, Task, TaskComment } from "@/lib/types";
import { CommentComposer } from "./comment-composer";
import { CommentList } from "./comment-list";
import { ActivityDetailsToggle, TaskActivityList } from "./task-activity";
import { useTaskActivity } from "./use-task-activity";
import { RelatedTestCase, TaskLinks } from "./task-links";
import { TaskDescription } from "./task-description";
import { TaskTitle } from "./task-title";

interface TaskMainContentProps {
  task: Task;
  workspaceId: string;
  shortName: string;
  assignees: Assignee[];
  comments: TaskComment[];
  commentsLoading: boolean;
  onUpdate: (updates: Partial<Task>) => Promise<void>;
  onSubmitComment: (content: string, files: File[]) => Promise<boolean>;
  onDeleteComment: (commentId: string) => void;
}

export function TaskMainContent({
  task,
  workspaceId,
  shortName,
  assignees,
  comments,
  commentsLoading,
  onUpdate,
  onSubmitComment,
  onDeleteComment,
}: TaskMainContentProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const activity = useTaskActivity(task.id, task.updated_at);
  const [showDetails, setShowDetails] = useState(true);
  const userInitial = (
    user?.profile?.first_name?.[0] ||
    user?.email?.[0] ||
    "?"
  ).toUpperCase();
  const testCaseHref = task.testcase_id
    ? `${workspacePath(workspaceId, "test-cases")}&testcase_id=${task.testcase_id}`
    : "";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-4 py-8 sm:px-8">
      <TaskTitle
        task={task}
        shortName={shortName}
        onSave={(title) => onUpdate({ title })}
      />

      <TaskDescription
        notes={task.notes || ""}
        onSave={(notes) => onUpdate({ notes })}
      />

      <div className="space-y-4">
        <ChecklistManager
          checklist={task.checklist || []}
          onUpdate={({ checklist }) => void onUpdate({ checklist })}
        />
      </div>

      <TaskLinks
        links={task.links || []}
        onChange={(links) => void onUpdate({ links })}
      />

      {task.testcase_id && (
        <RelatedTestCase href={testCaseHref} testcaseId={task.testcase_id} />
      )}

      <hr className="border-border" />

      <section
        className="space-y-6 pb-20"
        aria-labelledby="task-activity-title"
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            id="task-activity-title"
            className="flex items-center gap-2 font-semibold"
          >
            <MessageCircle size={18} />
            <span>{t("taskDetail__activity")}</span>
          </h2>
          <ActivityDetailsToggle
            shown={showDetails}
            onToggle={() => setShowDetails((v) => !v)}
          />
        </div>
        <div className="space-y-3">
          <CommentList
            comments={comments}
            loading={commentsLoading}
            assignees={assignees}
            onDelete={onDeleteComment}
          />
        </div>
        <CommentComposer
          userInitial={userInitial}
          assignees={assignees}
          onSubmit={onSubmitComment}
        />
        {showDetails && <TaskActivityList entries={activity} />}
      </section>
    </div>
  );
}
