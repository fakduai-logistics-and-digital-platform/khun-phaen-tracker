"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageSquare, Search, Sparkles, SquarePen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const chat = useAiTaskChat({ workspaceId, myAssigneeId, onTaskCreated });
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = chat.loading || chat.generating;
  const searching = chat.mode === "search";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, [chat.messages, chat.loading, chat.generating, chat.error, open]);

  return (
    <>
      <Button
        type="button"
        size="icon"
        className="fixed right-5 bottom-5 z-50 size-11 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label={t("aiChat__open")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Sparkles
          className={cn("size-5 transition-transform duration-300", open && "scale-90 rotate-90")}
          fill={open ? "currentColor" : "none"}
        />
      </Button>

      {open && (
        <div className="fixed right-5 bottom-20 z-50 flex w-[min(360px,calc(100vw-2.5rem))] origin-bottom-right flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg duration-200 animate-in fade-in zoom-in-95 slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-4 text-muted-foreground" />
              <div className="leading-tight">
                <div className="text-sm font-medium">{t("aiChat__title")}</div>
                <div className="text-xs text-muted-foreground">{t("aiChat__subtitle")}</div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={t("aiChat__close")}
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </div>

          <div ref={scrollRef} className="flex max-h-72 min-h-48 flex-col gap-3 overflow-y-auto p-4">
            {chat.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-1 py-4 text-center">
                <MessageSquare className="mb-1 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">{t("aiChat__empty_title")}</p>
                <p className="max-w-56 text-xs text-muted-foreground">{t("aiChat__empty_hint")}</p>
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
              <div className="flex gap-1 py-2" aria-hidden="true">
                <div className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
                <div className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0.2s]" />
                <div className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0.4s]" />
              </div>
            )}

            {chat.error && (
              <div role="alert" className="rounded-md border border-destructive/50 p-2.5 text-xs text-destructive">
                {chat.error}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t p-3">
            <Tabs value={chat.mode} onValueChange={(value) => chat.setMode(value as typeof chat.mode)}>
              <TabsList className="grid h-8 w-full grid-cols-2">
                <TabsTrigger value="search" className="text-xs">
                  <Search />
                  {t("aiChat__mode_search")}
                </TabsTrigger>
                <TabsTrigger value="generate" className="text-xs">
                  <SquarePen />
                  {t("aiChat__mode_generate")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void (searching ? chat.send() : chat.generate());
              }}
            >
              <Input
                aria-label={searching ? t("aiChat__mode_search") : t("aiChat__mode_generate")}
                className="h-8"
                value={chat.input}
                onChange={(e) => chat.setInput(e.target.value)}
                onKeyDown={chat.handleKeyDown}
                placeholder={searching ? t("aiChat__placeholder_search") : t("aiChat__placeholder_generate")}
                disabled={busy}
              />
              <Button
                type="submit"
                size="icon"
                className="size-8 shrink-0"
                aria-label={t("aiChat__send")}
                disabled={busy || !chat.input.trim()}
              >
                <ArrowUp />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
