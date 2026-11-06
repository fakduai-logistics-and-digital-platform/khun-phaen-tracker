"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save, Settings } from "lucide-react";
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

const SECTION_LABEL = "flex items-center gap-2 text-xs font-semibold text-muted-foreground";

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
        <DialogHeader className="flex-row items-center gap-4 border-b bg-gradient-to-br from-muted via-muted to-primary/15 px-6 py-5 pr-14 text-left sm:px-8 sm:py-6">
          <div className="rounded-lg bg-background/70 p-3 text-primary ring-1 ring-border backdrop-blur">
            <Settings size={24} />
          </div>
          <div>
            <DialogTitle className="text-2xl font-semibold">{t("workspaceSettings__title")}</DialogTitle>
            <DialogDescription className="mt-1 text-sm font-medium">
              {t("workspaceSettings__subtitle")}
            </DialogDescription>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
            <RefreshCcw size={40} className="animate-spin text-primary opacity-50" />
            <p className="font-medium text-muted-foreground">{t("page__checking_access")}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto bg-muted/30 p-5 sm:p-8">
              <section className="rounded-lg border bg-card p-6 shadow-sm">
                <div className={SECTION_LABEL}>
                  <span className="h-px w-8 bg-border" />
                  {t("workspaceSettings__appearance_title")}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div className="space-y-4">
                    <Label htmlFor="ws-name" className="text-sm font-medium">
                      {t("workspaceSettings__name_label")}
                    </Label>
                    <Input
                      id="ws-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("workspaceSettings__name_placeholder")}
                      className="h-11 rounded-lg bg-muted/60 font-medium"
                    />
                  </div>

                  <div className="space-y-4">
                    <Label htmlFor="ws-short-name" className="text-sm font-medium">
                      ชื่อย่อ (สูงสุด 4 ตัว)
                    </Label>
                    <Input
                      id="ws-short-name"
                      value={shortName}
                      maxLength={4}
                      onChange={(e) => setShortName(normalizeShortName(e.target.value))}
                      placeholder={normalizeShortName(name.trim()) || "WORK"}
                      className="h-11 rounded-lg bg-muted/60 font-semibold"
                    />
                  </div>

                  <fieldset className="space-y-4">
                    <legend className="text-sm font-medium">{t("workspaceSettings__color_label")}</legend>
                    <div className="mt-4 flex flex-wrap gap-2.5">
                      {SETTINGS_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setColor(c.value)}
                          title={c.name}
                          aria-label={c.name}
                          aria-pressed={color === c.value}
                          className={cn(
                            "size-9 rounded-full border-2 transition-colors ",
                            color === c.value
                              ? "scale-110 border-primary ring-4 ring-primary/15"
                              : "border-background shadow-sm dark:border-transparent",
                          )}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                    </div>
                  </fieldset>
                </div>

                <fieldset className="space-y-3 py-4 md:col-span-2">
                  <legend className="text-sm font-medium">{t("workspaceSettings__icon_label")}</legend>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ICON_CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        aria-pressed={selectedCategory === cat.key}
                        onClick={() => setSelectedCategory(cat.key)}
                        className={cn(
                          "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                          selectedCategory === cat.key
                            ? "bg-primary text-primary-foreground shadow-sm "
                            : "border bg-card text-muted-foreground hover:border-foreground/20",
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-[200px] overflow-y-auto rounded-lg border bg-muted/30 p-2">
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
                            "flex items-center justify-center rounded-lg p-2.5 transition-colors",
                            icon === key
                              ? "bg-primary/10 text-primary ring-2 ring-primary/40"
                              : "text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm",
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

            <div className="flex items-center justify-end gap-3 border-t bg-background/90 px-6 py-5 backdrop-blur sm:px-8 sm:py-6">
              <Button type="button" variant="ghost" className="px-6 font-medium" onClick={onClose}>
                {t("dashboard__modal_btn_cancel")}
              </Button>
              <Button
                type="button"
                className="rounded-lg px-8 font-medium"
                onClick={() => void handleSave()}
                disabled={isSaving || !name.trim()}
              >
                {isSaving ? (
                  <>
                    <RefreshCcw size={18} className="animate-spin" />
                    {t("taskForm__comments_saving")}
                  </>
                ) : (
                  <>
                    <Save size={18} />
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
