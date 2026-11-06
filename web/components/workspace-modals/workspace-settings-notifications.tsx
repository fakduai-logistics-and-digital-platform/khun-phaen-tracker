"use client";

import {
  Bell,
  CheckCircle2,
  CircleCheckBig,
  ClipboardList,
  FlaskConical,
  Globe,
  Loader,
  RefreshCcw,
  Rocket,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
const STATUS_ICONS = {
  todo: ClipboardList,
  "in-progress": Loader,
  "in-test": FlaskConical,
  done: CircleCheckBig,
} as const;

const SECTION_LABEL = "flex items-center gap-2 text-xs font-semibold text-muted-foreground";

function Switch({
  checked,
  onChange,
  activeClass,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  activeClass: string;
  label: string;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <div
        className={cn(
          "h-6 w-11 rounded-full bg-muted-foreground/30 transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-colors after:content-[''] peer-checked:after:translate-x-full",
          activeClass,
        )}
      />
    </label>
  );
}

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
    <section className="mt-6 space-y-4">
      <div className={SECTION_LABEL}>
        <span className="h-px w-8 bg-border" />
        {t("workspaceSettings__channels_title")}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-start gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-[#5865F2]/30 hover:shadow-sm">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#5865F2]/10">
            <Globe size={20} className="text-[#5865F2]" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="discord-url" className="font-medium">
              {t("workspaceSettings__discord_webhook_label")}
            </Label>
            <Input
              id="discord-url"
              value={value.webhookUrl}
              onChange={(e) => onChange({ webhookUrl: e.target.value })}
              placeholder={t("workspaceSettings__discord_webhook_placeholder")}
              className="rounded-lg bg-muted/50"
            />
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-[#06C755]/30 hover:shadow-sm">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#06C755]/10">
            <Bell size={20} className="text-[#06C755]" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="line-token" className="font-medium">
              {t("workspaceSettings__line_notify_token_label")}
            </Label>
            <Input
              id="line-token"
              type="password"
              value={value.lineNotifyToken}
              onChange={(e) => onChange({ lineNotifyToken: e.target.value })}
              placeholder={t("workspaceSettings__line_notify_token_placeholder")}
              className="rounded-lg bg-muted/50"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-amber-200/80 bg-gradient-to-br from-amber-50/60 to-transparent dark:border-amber-500/20 dark:from-amber-500/5">
        <div className="flex items-center justify-between border-b border-amber-100 px-5 py-4 dark:border-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/15">
              <RefreshCcw size={17} className="text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("workspaceSettings__auto_title")}</p>
              <p className="text-xs font-medium text-amber-600/60 dark:text-amber-400/50">
                {t("workspaceSettings__auto_subtitle")}
              </p>
            </div>
          </div>
          <Switch
            checked={value.autoEnabled}
            onChange={(autoEnabled) => onChange({ autoEnabled })}
            activeClass="peer-checked:bg-amber-500"
            label={t("workspaceSettings__auto_title")}
          />
        </div>

        {value.autoEnabled && (
          <div className="grid animate-in grid-cols-1 gap-5 p-5 fade-in slide-in-from-top-2 md:grid-cols-2">
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground">{t("workspaceSettings__auto_days_label")}</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEK_ORDER.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={value.autoDays.includes(d)}
                    onClick={() => toggleDay(d)}
                    className={cn(
                      "min-w-[38px] rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      value.autoDays.includes(d)
                        ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                        : "border bg-card text-muted-foreground hover:border-amber-300/60",
                    )}
                  >
                    {t(`calendarView__day_${DAY_KEYS[d]}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="auto-time" className="text-xs font-semibold text-muted-foreground">
                {t("workspaceSettings__auto_time_label")}
              </Label>
              <input
                id="auto-time"
                type="time"
                value={value.autoTime}
                onChange={(e) => onChange({ autoTime: e.target.value })}
                className="w-full rounded-lg border bg-card px-4 py-3 text-2xl font-semibold outline-none transition-colors focus-visible:border-amber-400/50 focus-visible:ring-2 focus-visible:ring-amber-400/20"
              />
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-3 border-b border-primary/10 px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15">
            <CheckCircle2 size={17} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">{t("workspaceSettings__alerts_title")}</p>
            <p className="text-xs font-medium text-primary/50">{t("workspaceSettings__alerts_subtitle")}</p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-full bg-success text-success">
                <Rocket size={14} />
              </div>
              <span className="text-sm font-medium">{t("workspaceSettings__alerts_create_label")}</span>
            </div>
            <Switch
              checked={value.notifyOnCreate}
              onChange={(notifyOnCreate) => onChange({ notifyOnCreate })}
              activeClass="peer-checked:bg-primary"
              label={t("workspaceSettings__alerts_create_label")}
            />
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground">{t("workspaceSettings__alerts_status_label")}</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((status) => {
                const Icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS];
                const active = value.notifyOnStatusChange.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleStatus(status)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground "
                        : "bg-card text-muted-foreground hover:border-foreground/20",
                    )}
                  >
                    <Icon size={13} />
                    {t(`page__filter_status_${status.replace("-", "_")}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
