"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import {
  currentWorkspaceColor,
  currentWorkspaceIcon,
  currentWorkspaceName,
  setWorkspaceId,
} from "@/lib/stores/workspace";
import { cn } from "@/lib/utils";
import { ICON_CATEGORIES, SETTINGS_COLORS, SETTINGS_ICONS } from "./workspace-settings-options";
import { WorkspaceSettingsNotifications, type NotificationSettings } from "./workspace-settings-notifications";

const normalizeShortName = (value: string) => value.replace(/\s+/g, "").slice(0, 4).toUpperCase();

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  webhookUrl: "",
  lineNotifyToken: "",
  notifyOnCreate: false,
  notifyOnStatusChange: [],
  autoEnabled: false,
  autoDays: [1, 2, 3, 4, 5],
  autoTime: "09:00",
};

export function WorkspaceSettings({
  workspaceId,
  initialName,
  initialColor,
  initialIcon,
  initialShortName,
  onClose,
  onWorkspaceUpdated,
}: {
  workspaceId: string;
  /** Overrides the values read from the current-workspace store (used when editing from the dashboard). */
  initialName?: string;
  initialColor?: string;
  initialIcon?: string;
  initialShortName?: string;
  onClose?: () => void;
  onWorkspaceUpdated?: () => void;
}) {
  const { t } = useI18n();
  const storeName = useStore(currentWorkspaceName);
  const storeColor = useStore(currentWorkspaceColor);
  const storeIcon = useStore(currentWorkspaceIcon);

  const [name, setName] = useState(initialName ?? storeName);
  const [shortName, setShortName] = useState(() =>
    normalizeShortName((initialShortName || initialName || storeName).trim()),
  );
  const [color, setColor] = useState(initialColor || storeColor || "#6366f1");
  const [icon, setIcon] = useState(initialIcon || storeIcon || "LayoutTemplate");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const filteredIcons = useMemo(
    () => (selectedCategory === "all" ? SETTINGS_ICONS : SETTINGS_ICONS.filter((i) => i.category === selectedCategory)),
    [selectedCategory],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.workspaces.getNotificationConfig(workspaceId);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.success || !data.config) return;
        const c = data.config;
        setNotifications({
          webhookUrl: c.discord_webhook_url || "",
          lineNotifyToken: c.line_notify_token || "",
          notifyOnCreate: c.notify_on_create || false,
          notifyOnStatusChange: c.notify_on_status_change || [],
          autoEnabled: c.enabled || false,
          autoDays: c.days || [1, 2, 3, 4, 5],
          autoTime: c.time || "09:00",
        });
      } catch (err) {
        console.error("Failed to load workspace settings:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const resolvedShortName = normalizeShortName(shortName) || normalizeShortName(name.trim());
      const updateRes = await api.workspaces.update(workspaceId, name, color, icon, resolvedShortName);
      if (updateRes.ok) {
        setWorkspaceId(workspaceId, name, undefined, color, icon, resolvedShortName);
      }

      await api.workspaces.updateNotificationConfig(workspaceId, {
        discord_webhook_url: notifications.webhookUrl,
        line_notify_token: notifications.lineNotifyToken,
        notify_on_create: notifications.notifyOnCreate,
        notify_on_status_change: notifications.notifyOnStatusChange,
        enabled: notifications.autoEnabled,
        days: notifications.autoDays,
        time: notifications.autoTime,
      });

      onWorkspaceUpdated?.();
      onClose?.();
    } catch (err) {
      console.error("Failed to save workspace settings:", err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-3xl">
        <DialogHeader className="border-b p-6 pr-14 text-left">
          <DialogTitle>{t("workspaceSettings__title")}</DialogTitle>
          <DialogDescription>{t("workspaceSettings__subtitle")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
            <RefreshCcw size={32} className="animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("page__checking_access")}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <section>
                <h3 className="text-sm font-medium">{t("workspaceSettings__appearance_title")}</h3>

                <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="ws-name">{t("workspaceSettings__name_label")}</Label>
                    <Input
                      id="ws-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("workspaceSettings__name_placeholder")}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="ws-short-name">ชื่อย่อ (สูงสุด 4 ตัว)</Label>
                    <Input
                      id="ws-short-name"
                      value={shortName}
                      maxLength={4}
                      onChange={(e) => setShortName(normalizeShortName(e.target.value))}
                      placeholder={normalizeShortName(name.trim()) || "WORK"}
                    />
                  </div>

                  <fieldset className="grid gap-2">
                    <legend className="text-sm font-medium">{t("workspaceSettings__color_label")}</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {SETTINGS_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setColor(c.value)}
                          title={c.name}
                          aria-label={c.name}
                          aria-pressed={color === c.value}
                          className={cn(
                            "size-8 rounded-full border transition-shadow",
                            color === c.value ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "",
                          )}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                    </div>
                  </fieldset>
                </div>

                <fieldset className="mt-6 grid gap-2">
                  <legend className="text-sm font-medium">{t("workspaceSettings__icon_label")}</legend>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {ICON_CATEGORIES.map((cat) => (
                      <Button
                        key={cat.key}
                        type="button"
                        size="sm"
                        variant={selectedCategory === cat.key ? "default" : "outline"}
                        aria-pressed={selectedCategory === cat.key}
                        onClick={() => setSelectedCategory(cat.key)}
                      >
                        {cat.label}
                      </Button>
                    ))}
                  </div>

                  <div className="max-h-[200px] overflow-y-auto rounded-md border p-2">
                    <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-9 md:grid-cols-10">
                      {filteredIcons.map(({ key, component: Icon }) => (
                        <button
                          key={key}
                          type="button"
                          title={key}
                          aria-label={key}
                          aria-pressed={icon === key}
                          onClick={() => setIcon(key)}
                          className={cn(
                            "flex items-center justify-center rounded-md p-2.5 transition-colors",
                            icon === key
                              ? "bg-accent text-accent-foreground ring-2 ring-ring"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          )}
                        >
                          <Icon size={20} />
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>
              </section>

              <WorkspaceSettingsNotifications
                value={notifications}
                onChange={(patch) => setNotifications((prev) => ({ ...prev, ...patch }))}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t p-4">
              <Button type="button" variant="outline" onClick={onClose}>
                {t("dashboard__modal_btn_cancel")}
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={isSaving || !name.trim()}>
                {isSaving ? (
                  <>
                    <RefreshCcw className="animate-spin" />
                    {t("taskForm__comments_saving")}
                  </>
                ) : (
                  <>
                    <Save />
                    {t("workspaceSettings__btn_save")}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
