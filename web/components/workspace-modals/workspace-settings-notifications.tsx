"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";

export type NotificationSettings = {
  webhookUrl: string;
  lineNotifyToken: string;
  notifyOnCreate: boolean;
  notifyOnStatusChange: string[];
  autoEnabled: boolean;
  autoDays: number[];
  autoTime: string;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const STATUSES = ["todo", "in-progress", "in-test", "done"];

export function WorkspaceSettingsNotifications({
  value,
  onChange,
}: {
  value: NotificationSettings;
  onChange: (patch: Partial<NotificationSettings>) => void;
}) {
  const { t } = useI18n();

  function toggleStatus(status: string) {
    onChange({
      notifyOnStatusChange: value.notifyOnStatusChange.includes(status)
        ? value.notifyOnStatusChange.filter((s) => s !== status)
        : [...value.notifyOnStatusChange, status],
    });
  }

  function toggleDay(day: number) {
    onChange({
      autoDays: value.autoDays.includes(day)
        ? value.autoDays.filter((d) => d !== day)
        : [...value.autoDays, day].sort(),
    });
  }

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">{t("workspaceSettings__channels_title")}</h3>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="discord-url">{t("workspaceSettings__discord_webhook_label")}</Label>
            <Input
              id="discord-url"
              value={value.webhookUrl}
              onChange={(e) => onChange({ webhookUrl: e.target.value })}
              placeholder={t("workspaceSettings__discord_webhook_placeholder")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="line-token">{t("workspaceSettings__line_notify_token_label")}</Label>
            <Input
              id="line-token"
              type="password"
              value={value.lineNotifyToken}
              onChange={(e) => onChange({ lineNotifyToken: e.target.value })}
              placeholder={t("workspaceSettings__line_notify_token_placeholder")}
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="auto-enabled">{t("workspaceSettings__auto_title")}</Label>
            <p className="text-sm text-muted-foreground">{t("workspaceSettings__auto_subtitle")}</p>
          </div>
          <Switch
            id="auto-enabled"
            checked={value.autoEnabled}
            onCheckedChange={(autoEnabled) => onChange({ autoEnabled })}
          />
        </div>

        {value.autoEnabled && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t("workspaceSettings__auto_days_label")}</Label>
              <div className="flex flex-wrap gap-2">
                {WEEK_ORDER.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={value.autoDays.includes(d) ? "default" : "outline"}
                    aria-pressed={value.autoDays.includes(d)}
                    onClick={() => toggleDay(d)}
                  >
                    {t(`calendarView__day_${DAY_KEYS[d]}`)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="auto-time">{t("workspaceSettings__auto_time_label")}</Label>
              <Input
                id="auto-time"
                type="time"
                value={value.autoTime}
                onChange={(e) => onChange({ autoTime: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">{t("workspaceSettings__alerts_title")}</h3>
          <p className="text-sm text-muted-foreground">{t("workspaceSettings__alerts_subtitle")}</p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="notify-create" className="font-normal">
            {t("workspaceSettings__alerts_create_label")}
          </Label>
          <Switch
            id="notify-create"
            checked={value.notifyOnCreate}
            onCheckedChange={(notifyOnCreate) => onChange({ notifyOnCreate })}
          />
        </div>

        <div className="grid gap-2">
          <Label>{t("workspaceSettings__alerts_status_label")}</Label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((status) => {
              const active = value.notifyOnStatusChange.includes(status);
              return (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  onClick={() => toggleStatus(status)}
                >
                  {t(`page__filter_status_${status.replace("-", "_")}`)}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
