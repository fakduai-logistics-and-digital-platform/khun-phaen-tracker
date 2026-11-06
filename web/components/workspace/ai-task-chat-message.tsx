"use client";

import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./use-ai-task-chat";

const SECTION_LABEL = "text-xs font-medium st ";

function Divider({ label, className }: { label: string; className?: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <div className="h-px flex-1 bg-border" />
      <span className={cn(SECTION_LABEL, "text-muted-foreground", className)}>{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export interface AiTaskChatMessageProps {
  message: ChatMessage;
  onOpenResult: (task: Task) => void;
  onCreateTask: (generatedTask: any, assignToMe: boolean) => void;
  onCancelCreation: () => void;
  onOpenCreated: () => void;
}

export function AiTaskChatMessage({
  message,
  onOpenResult,
  onCreateTask,
  onCancelCreation,
  onOpenCreated,
}: AiTaskChatMessageProps) {
  const { t } = useI18n();
  const isUser = message.role === "user";
  const generated = message.generatedTask;

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-2.5 text-sm shadow-sm",
          isUser
            ? "rounded-tr-none bg-indigo-600 font-medium text-white"
            : "rounded-tl-none border bg-muted text-foreground",
        )}
      >
        {message.content}
      </div>

      {message.results && message.results.length > 0 && (
        <div className="mt-3 w-full space-y-2">
          <Divider label="Relevant Tasks" />
          {message.results.map((result) => (
            <button
              key={String(result.task.id)}
              type="button"
              className="group relative w-full overflow-hidden rounded-lg border bg-card p-3 text-left transition-colors hover:border-indigo-300 hover:dark:hover:border-indigo-900"
              aria-label={result.task.title}
              onClick={() => onOpenResult(result.task)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate">
                  {result.task.task_number && (
                    <span className="text-xs font-semibold text-indigo-500">#{result.task.task_number}</span>
                  )}
                  <span className="truncate text-sm font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    {result.task.title}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5">{result.task.status}</span>
                  {result.task.priority && result.task.priority !== "none" && (
                    <span className="rounded bg-destructive px-1.5 py-0.5 text-destructive">
                      {result.task.priority}
                    </span>
                  )}
                  <span className="ml-auto text-muted-foreground/70">match {Math.round(result.score * 100)}%</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {generated && (
        <div className="mt-3 w-full">
          <Divider label="Generated Task" />
          <div className="rounded-lg border border-success bg-success/50 p-3.5">
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <h4 className="text-xs leading-tight font-medium">{generated.title}</h4>
              <div className="flex shrink-0 gap-1">
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {generated.category}
                </span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {generated.priority}
                </span>
              </div>
            </div>
            {generated.project && (
              <div className="mb-2 text-xs text-muted-foreground">
                <span className="font-semibold">Project:</span> {generated.project}
              </div>
            )}
            {generated.notes && (
              <div className="mb-2.5 rounded-lg bg-background/60 p-2.5 text-xs leading-relaxed">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Description</div>
                <div className="whitespace-pre-wrap">{generated.notes}</div>
              </div>
            )}
            {Array.isArray(generated.checklist) && generated.checklist.length > 0 && (
              <div className="mb-2.5 rounded-lg bg-background/60 p-2.5">
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Checklist</div>
                <div className="space-y-1">
                  {generated.checklist.map((item: string, index: number) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 text-muted-foreground">☐</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {message.showAssignPrompt && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
                  onClick={() => onCreateTask(generated, true)}
                >
                  ✓ สร้าง & Assign ให้ฉัน
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-accent"
                  onClick={() => onCreateTask(generated, false)}
                >
                  สร้างโดยไม่ Assign
                </button>
                <button
                  type="button"
                  aria-label={t("tabSettings__btn_cancel")}
                  className="rounded-lg border border-destructive bg-destructive px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive dark:hover:bg-destructive/20"
                  onClick={onCancelCreation}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {message.createdTaskUrl && (
        <div className="mt-3 w-full">
          <Divider label="Task Created" className="text-success" />
          <a
            href={message.createdTaskUrl}
            className="block rounded-lg border border-success bg-linear-to-br from-emerald-50 to-emerald-100/50 p-4 transition hover:dark:from-emerald-900/20 dark:to-emerald-900/10"
            onClick={onOpenCreated}
          >
            <div className="mb-2 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-success text-white">
                <span className="text-lg">✓</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-success">{message.createdTask?.title || "Task Created"}</div>
                {message.createdTask?.task_number && (
                  <div className="text-xs text-success">#{message.createdTask.task_number}</div>
                )}
              </div>
            </div>
            <div className="text-xs text-success">คลิกเพื่อดู task →</div>
          </a>
        </div>
      )}
    </div>
  );
}
