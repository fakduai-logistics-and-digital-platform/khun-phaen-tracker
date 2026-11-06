"use client";

import { AtSign, Fingerprint, ShieldCheck, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type ProfileSummaryProps = {
  displayName: string;
  email: string;
  role: string;
  nickname: string;
  position: string;
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

function InfoRow({
  icon: Icon,
  tone,
  label,
  value,
  capitalize,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
      <div className={`rounded-lg p-2 ${tone}`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={`truncate text-sm font-bold ${capitalize ? "capitalize" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

export function ProfileSummary({ displayName, email, role, nickname, position }: ProfileSummaryProps) {
  const { t } = useI18n();
  const initials = getInitials(displayName || email || "?");

  return (
    <aside className="lg:sticky lg:top-4 lg:self-start">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b bg-gradient-to-br from-brand-500/15 via-muted/40 to-transparent p-5">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-brand-500 text-3xl font-black text-white shadow-xl ring-4 ring-background/40">
              {initials}
            </div>
            <div className="text-center">
              <p className="max-w-[200px] truncate text-base font-bold tracking-tight">{displayName || "—"}</p>
              <p className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <InfoRow icon={ShieldCheck} tone="bg-primary/10 text-primary" label="Role" value={role || "—"} capitalize />
          {nickname && (
            <InfoRow
              icon={AtSign}
              tone="bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
              label={t("users__form_nickname")}
              value={nickname}
            />
          )}
          {position && (
            <InfoRow
              icon={Fingerprint}
              tone="bg-success/10 text-success"
              label={t("users__form_position")}
              value={position}
            />
          )}
        </div>
      </div>
    </aside>
  );
}
