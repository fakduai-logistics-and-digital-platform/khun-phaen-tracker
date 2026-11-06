"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageSquare, Sparkles, X } from "lucide-react";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AiTaskChatMessage } from "./ai-task-chat-message";
import { useAiTaskChat } from "./use-ai-task-chat";

export interface AiTaskChatProps {
  workspaceId: string | undefined;
  myAssigneeId: string | number | undefined;
  onOpenTask: (task: Task) => void;
  onTaskCreated: () => void | Promise<void>;
}

export function AiTaskChat({ workspaceId, myAssigneeId, onOpenTask, onTaskCreated }: AiTaskChatProps) {
  const [open, setOpen] = useState(false);
  const chat = useAiTaskChat({ workspaceId, myAssigneeId, onTaskCreated });
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = chat.loading || chat.generating;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, [chat.messages, chat.loading, chat.generating, chat.error, open]);

  return (
    <>
      <button
        type="button"
        className="fixed right-6 bottom-6 z-50 flex size-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-indigo-500/40 transition-colors hover:bg-indigo-500"
        aria-label="เปิด AI task chat"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Sparkles size={24} fill={open ? "currentColor" : "none"} />
      </button>

      {open && (
        <div className="fixed right-6 bottom-24 z-50 flex w-[min(420px,calc(100vw-3rem))] flex-col overflow-hidden rounded-lg border bg-card transition-colors animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between border-b bg-muted/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="text-sm font-medium">AI Task Assistant</div>
                <div className="text-xs font-medium text-muted-foreground">Semantic Search Engine</div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex max-h-[480px] min-h-[300px] flex-col gap-4 overflow-y-auto p-5">
            {chat.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <MessageSquare size={24} />
                </div>
                <p className="mb-1 text-sm font-medium">ถามอะไรผมดี?</p>
                <p className="max-w-[200px] text-xs text-muted-foreground">
                  ลองถามเกี่ยวกับงาน เช่น &quot;งานที่ด่วนที่สุด&quot; หรือ &quot;งานของคุณเอก&quot;
                </p>
              </div>
            )}

            {chat.messages.map((message, index) => (
              <AiTaskChatMessage
                key={index}
                message={message}
                onOpenResult={(task) => {
                  onOpenTask(task);
                  setOpen(false);
                }}
                onCreateTask={(generated, assign) => void chat.createTask(generated, assign)}
                onCancelCreation={chat.cancelCreation}
                onOpenCreated={() => setOpen(false)}
              />
            ))}

            {busy && (
              <div className="flex items-start gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                  <Sparkles size={14} className="text-muted-foreground" />
                </div>
                <div className="flex gap-1 py-3">
                  <div className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
                  <div className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0.2s]" />
                  <div className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            {chat.error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive bg-destructive/50 p-3 text-xs font-medium text-destructive"
              >
                ⚠️ {chat.error}
              </div>
            )}
          </div>

          <div className="border-t bg-card p-4">
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                  chat.mode === "search"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
                onClick={() => chat.setMode("search")}
              >
                🔍 ค้นหา Task
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                  chat.mode === "generate"
                    ? "bg-success text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
                onClick={() => chat.setMode("generate")}
              >
                ✨ สร้าง Task
              </button>
            </div>
            <form
              className="relative flex items-center"
              onSubmit={(e) => {
                e.preventDefault();
                void (chat.mode === "search" ? chat.send() : chat.generate());
              }}
            >
              <input
                aria-label={chat.mode === "search" ? "ค้นหา Task" : "สร้าง Task"}
                className="w-full rounded-lg border bg-muted/50 py-3 pr-12 pl-4 text-sm transition-colors focus:border-indigo-500 focus:bg-background focus:ring-4 focus:ring-indigo-500/10 focus:outline-none"
                value={chat.input}
                onChange={(e) => chat.setInput(e.target.value)}
                onKeyDown={chat.handleKeyDown}
                placeholder={
                  chat.mode === "search"
                    ? 'ค้นหา task เช่น "งานที่ด่วนที่สุด"'
                    : 'สร้าง task เช่น "ทำ API สำหรับ login"'
                }
                disabled={busy}
              />
              <button
                type="submit"
                aria-label="Send"
                className={cn(
                  "absolute right-1.5 flex size-9 items-center justify-center rounded-lg text-white transition-colors hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground",
                  chat.mode === "search" ? "bg-indigo-600" : "bg-success",
                )}
                disabled={busy || !chat.input.trim()}
              >
                <ArrowUp size={20} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
