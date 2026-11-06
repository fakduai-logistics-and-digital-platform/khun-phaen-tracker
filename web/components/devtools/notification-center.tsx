"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { useStore } from "@/lib/store";
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  notificationItems,
  unreadNotificationCount,
  type AppNotification,
} from "@/lib/stores/notifications";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("th-TH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationCenter() {
  const router = useRouter();
  const { t } = useI18n();
  const { isMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const items = useStore(notificationItems);
  const unread = useStore(unreadNotificationCount);

  function openNotification(item: AppNotification) {
    markNotificationRead(item.id);
    setOpen(false);
    router.push(item.href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          title={t("notifications__title")}
          aria-label={t("notifications__title")}
        >
          <Bell />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 tabular-nums">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side={isMobile ? "top" : "right"} align="end" className="w-[min(360px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium">{t("notifications__title")}</p>
            <p className="text-xs text-muted-foreground">{t("notifications__unread", { count: unread })}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={markAllNotificationsRead} disabled={items.length === 0}>
            <CheckCheck />
            {t("notifications__read_all")}
          </Button>
        </div>
        <Separator />
        <ScrollArea className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("notifications__empty")}</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-start gap-2 px-4 py-3 hover:bg-accent/60">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 gap-3 text-start"
                  aria-label={`${item.sourceTitle}: ${item.message}`}
                  onClick={() => openNotification(item)}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      item.readAt ? "bg-muted-foreground/40" : "bg-primary",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.sourceTitle}</span>
                    <span className="block text-sm text-muted-foreground">{item.message}</span>
                    <span className="block text-xs text-muted-foreground">{formatTime(item.createdAt)}</span>
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("notifications__delete")}
                  onClick={() => void deleteNotification(item.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
