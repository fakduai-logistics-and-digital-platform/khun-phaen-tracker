"use client";

import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./use-ai-task-chat";

const SECTION_LABEL = "text-xs font-medium";

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
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
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
              className="group relative w-full overflow-hidden rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
              aria-label={result.task.title}
              onClick={() => onOpenResult(result.task)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate">
                  {result.task.task_number && (
                    <span className="text-xs text-muted-foreground">#{result.task.task_number}</span>
                  )}
                  <span className="truncate text-sm font-semibold">{result.task.title}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Badge variant="secondary">{result.task.status}</Badge>
                  {result.task.priority && result.task.priority !== "none" && (
                    <Badge variant="outline">{result.task.priority}</Badge>
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
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <h4 className="text-xs leading-tight font-medium">{generated.title}</h4>
              <div className="flex shrink-0 gap-1">
                <Badge variant="secondary">{generated.category}</Badge>
                <Badge variant="outline">{generated.priority}</Badge>
              </div>
            </div>
            {generated.project && (
              <div className="mb-2 text-xs text-muted-foreground">
                <span className="font-semibold">Project:</span> {generated.project}
              </div>
            )}
            {generated.notes && (
              <div className="mb-2.5 rounded-md bg-muted p-2.5 text-xs leading-relaxed">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Description</div>
                <div className="whitespace-pre-wrap">{generated.notes}</div>
              </div>
            )}
            {Array.isArray(generated.checklist) && generated.checklist.length > 0 && (
              <div className="mb-2.5 rounded-md bg-muted p-2.5">
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
                <Button type="button" size="sm" className="flex-1" onClick={() => onCreateTask(generated, true)}>
                  <Check />
                  {t("aiChat__create_assign")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onCreateTask(generated, false)}
                >
                  {t("aiChat__create_only")}
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label={t("tabSettings__btn_cancel")}
                  onClick={onCancelCreation}
                >
                  <X />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {message.createdTaskUrl && (
        <div className="mt-3 w-full">
          <Divider label="Task Created" />
          <a
            href={message.createdTaskUrl}
            className="flex items-center gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
            onClick={onOpenCreated}
          >
            <Check className="size-4 text-success" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{message.createdTask?.title || "Task Created"}</div>
              {message.createdTask?.task_number && (
                <div className="text-xs text-muted-foreground">#{message.createdTask.task_number}</div>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{t("aiChat__view_task")}</span>
          </a>
        </div>
      )}
    </div>
  );
}
