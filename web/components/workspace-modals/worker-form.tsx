"use client";

import { useRef, useState } from "react";
import { Check, Pipette, Plus, RefreshCw } from "lucide-react";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getRandomWorkerColor, WORKER_COLOR_OPTIONS } from "./worker-colors";

export type WorkerFormValues = { name: string; color: string; userId: string };

export type SystemUser = {
  id?: string;
  user_id?: string;
  email: string;
  is_active?: boolean;
  profile?: { nickname?: string; first_name?: string };
};

export const systemUserLabel = (user: SystemUser) =>
  user.profile?.nickname || user.profile?.first_name || user.email.split("@")[0];

export function WorkerForm({
  values,
  editing,
  availableUsers,
  systemUsers,
  onChange,
  onSave,
  onCancel,
}: {
  values: WorkerFormValues;
  editing: boolean;
  availableUsers: SystemUser[];
  systemUsers: SystemUser[];
  onChange: (values: WorkerFormValues) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [shuffling, setShuffling] = useState(false);
  const shufflingRef = useRef(false);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const { name, color, userId } = values;

  async function shuffleColor() {
    if (shufflingRef.current) return;
    shufflingRef.current = true;
    setShuffling(true);

    const totalDuration = 800;
    let elapsed = 0;
    let interval = 40;
    while (elapsed < totalDuration) {
      onChange({ ...valuesRef.current, color: getRandomWorkerColor() });
      await new Promise((r) => setTimeout(r, interval));
      elapsed += interval;
      interval += (elapsed / totalDuration) * 20;
    }

    shufflingRef.current = false;
    setShuffling(false);
  }

  function handleUserLinkChange(nextUserId: string) {
    let nextName = name;
    if (nextUserId && !editing && !name) {
      const user = systemUsers.find((u) => String(u.id) === nextUserId || String(u.user_id) === nextUserId);
      if (user) nextName = systemUserLabel(user);
    }
    onChange({ ...values, userId: nextUserId, name: nextName });
  }

  const isCustomColor = !WORKER_COLOR_OPTIONS.includes(color);

  return (
    <form
      className="mb-6 animate-in space-y-5 rounded-lg border bg-muted/50 p-5 shadow-inner fade-in slide-in-from-top-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="link-user-select" className="text-xs font-medium text-muted-foreground">
          {t("workerManager__link_user_label")}
        </Label>
        <SearchableSelect
          id="link-user-select"
          value={userId}
          onValueChange={(v) => handleUserLinkChange(String(v ?? ""))}
          options={[
            { value: "", label: `-- ${t("workerManager__link_user_placeholder")} --` },
            ...availableUsers.map((user) => ({
              value: String(user.id || user.user_id || ""),
              label: `${systemUserLabel(user)} (${user.email})`,
              badge: user.is_active !== undefined,
              badgeColor: user.is_active ? "#22C55E" : "#FBBF24",
            })),
          ]}
          placeholder={t("workerManager__link_user_placeholder")}
        />
        {userId && (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success">
            <Check size={10} />
            {t("workerManager__auto_fill_hint")}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="worker-name-input">
          {editing ? t("workerManager__edit_name") : t("workerManager__name_label")}
        </Label>
        <Input
          id="worker-name-input"
          value={name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          placeholder={t("workerManager__name_placeholder")}
          className="bg-background"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label htmlFor="worker-color-picker">{t("workerManager__color_label")}</Label>
          <button
            type="button"
            onClick={() => void shuffleColor()}
            disabled={shuffling}
            className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
          >
            <RefreshCw size={10} className={cn(shuffling && "animate-spin")} />
            {t("workerManager__random_color_btn")}
          </button>
        </div>

        <div className="mb-3 grid grid-cols-8 gap-2">
          {WORKER_COLOR_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange({ ...values, color: option })}
              aria-label={`${t("workerManager__select_color")} ${option}`}
              aria-pressed={color === option}
              className={cn(
                "flex aspect-square items-center justify-center rounded-full border-2 shadow-sm transition-colors ",
                color === option ? "border-background ring-2 ring-primary" : "border-transparent",
              )}
              style={{ backgroundColor: option }}
            >
              {color === option && <div className="size-1.5 rounded-full bg-white shadow-sm" />}
            </button>
          ))}

          <div className="group relative aspect-square">
            <input
              id="worker-color-picker"
              type="color"
              value={color}
              onChange={(e) => onChange({ ...values, color: e.target.value })}
              aria-label={t("workerManager__color_picker")}
              className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
            />
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded-full border-2 transition-colors",
                isCustomColor
                  ? "border-solid border-background text-white"
                  : "border-dashed bg-background text-muted-foreground group-hover:border-primary group-hover:text-primary",
              )}
              style={isCustomColor ? { backgroundColor: color } : undefined}
            >
              {isCustomColor ? <Pipette size={12} /> : <Plus size={12} />}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={!name.trim()} className="flex-1 font-medium">
          {editing ? <Check size={16} /> : <Plus size={16} />}
          {editing ? t("workerManager__btn_save") : t("workerManager__btn_add")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("workerManager__btn_cancel")}
        </Button>
      </div>
    </form>
  );
}
