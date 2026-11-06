"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ToolModalProps = {
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  headerActions?: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  children: ReactNode;
};

/** The one shell every developer-tool modal uses: shadcn Dialog with a fixed size, header, scrolling body and optional footer. */
export function ToolModal({
  onClose,
  title,
  subtitle,
  icon: Icon,
  headerActions,
  footer,
  bodyClassName,
  onEscapeKeyDown,
  children,
}: ToolModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent onEscapeKeyDown={onEscapeKeyDown} className="flex h-[80vh] w-full flex-col gap-4 sm:max-w-5xl">
        <DialogHeader className="pe-8">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2">
              {Icon && <Icon className="size-5 text-muted-foreground" />}
              {title}
            </DialogTitle>
            {headerActions && <div className="flex shrink-0 items-center gap-2">{headerActions}</div>}
          </div>
          <DialogDescription className={subtitle ? undefined : "sr-only"}>{subtitle ?? title}</DialogDescription>
        </DialogHeader>
        <div className={cn("-mx-6 flex min-h-0 flex-1 flex-col overflow-y-auto px-6", bodyClassName)}>{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
