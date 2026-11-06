"use client";

import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Layout,
  MoreHorizontal,
  PanelRight,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AI_MODES, type AiMode } from "./ai-prompt";

interface TaskDetailHeaderProps {
  task: Task | null;
  workspaceName: string;
  isPinned: boolean;
  sidebarOpen: boolean;
  onBack: () => void;
  onMarkDone: () => void;
  onOpenBranch: () => void;
  onAskAi: (mode: AiMode) => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onToggleSidebar: () => void;
}

export function TaskDetailHeader({
  task,
  workspaceName,
  isPinned,
  sidebarOpen,
  onBack,
  onMarkDone,
  onOpenBranch,
  onAskAi,
  onTogglePin,
  onDelete,
  onToggleSidebar,
}: TaskDetailHeaderProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          title={t("sidebar__back")}
          aria-label={t("sidebar__back")}
          className="shrink-0"
        >
          <ArrowLeft size={18} />
        </Button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <button type="button" onClick={onBack} className="flex items-center gap-1 truncate hover:text-foreground">
            <Layout size={14} className="shrink-0" />
            <span className="truncate">{workspaceName || "Workspace"}</span>
          </button>
          <ChevronRight size={14} className="shrink-0" />
          {task && <span className="truncate font-medium text-foreground">{task.title}</span>}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {task?.status !== "done" && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onMarkDone}
            disabled={!task}
            title="Mark as done"
            aria-label="Mark as done"
            className="text-muted-foreground hover:bg-success/10 hover:text-success"
          >
            <CheckCircle2 size={18} />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpenBranch}
          title={t("taskForm__branch")}
          aria-label={t("taskForm__branch")}
          className="text-muted-foreground"
        >
          <GitBranch size={18} />
        </Button>
        {task && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="ถาม ChatGPT"
                aria-label="ถาม ChatGPT"
                className="text-muted-foreground data-[state=open]:bg-success/10 data-[state=open]:text-success"
              >
                <Bot size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                ถาม AI เกี่ยวกับ...
              </DropdownMenuLabel>
              {AI_MODES.map((mode) => (
                <DropdownMenuItem key={mode.id} onSelect={() => onAskAi(mode)} className="items-start gap-3">
                  <mode.icon className="mt-0.5 shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-xs">{mode.label}</span>
                    <span className="mt-0.5 text-xs text-muted-foreground">{mode.desc}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onTogglePin}
          title={isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
          aria-label={isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
          aria-pressed={isPinned}
          className={cn(isPinned ? "bg-primary/10 text-primary" : "text-muted-foreground")}
        >
          {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="More"
              className="text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
            >
              <MoreHorizontal size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 size={14} />
              <span>{t("taskDetail__delete_task")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onToggleSidebar}
          aria-label="Toggle details panel"
          aria-pressed={sidebarOpen}
          className={cn(sidebarOpen ? "bg-accent text-primary" : "text-muted-foreground")}
        >
          <PanelRight size={18} />
        </Button>
      </div>
    </>
  );
}
