"use client";

import { Globe, KeyRound, Palette, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { SettingsHero } from "@/components/settings/settings-hero";
import { useI18n } from "@/lib/i18n";

type SummaryCard = {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: string;
};

const SUMMARY_CARDS: SummaryCard[] = [
  {
    label: "settings__card_role_label",
    value: "settings__card_role_value",
    helper: "settings__card_role_helper",
    icon: ShieldCheck,
    tone: "from-emerald-500/15 via-emerald-500/5 to-transparent text-emerald-600 dark:text-emerald-300",
  },
  {
    label: "settings__card_locale_label",
    value: "settings__card_locale_value",
    helper: "settings__card_locale_helper",
    icon: Globe,
    tone: "from-sky-500/15 via-sky-500/5 to-transparent text-sky-600 dark:text-sky-300",
  },
  {
    label: "settings__card_theme_label",
    value: "settings__card_theme_value",
    helper: "settings__card_theme_helper",
    icon: Palette,
    tone: "from-fuchsia-500/15 via-fuchsia-500/5 to-transparent text-fuchsia-600 dark:text-fuchsia-300",
  },
  {
    label: "settings__card_security_label",
    value: "settings__card_security_value",
    helper: "settings__card_security_helper",
    icon: KeyRound,
    tone: "from-amber-500/15 via-amber-500/5 to-transparent text-amber-600 dark:text-amber-300",
  },
];

export function SettingsGeneral() {
  const { t, locale } = useI18n();
  const { theme } = useTheme();

  function displayValue(card: SummaryCard) {
    if (card.label === "settings__card_locale_label") return (locale || "en").toUpperCase();
    if (card.label === "settings__card_theme_label") return theme ?? "system";
    return t(card.value);
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
      <SettingsHero
        icon={Settings}
        title={t("settings__general_title")}
        badge={t("settings__admin_only")}
        subtitle={t("settings__general_subtitle")}
      >
        <div className="grid w-full max-w-md grid-cols-2 gap-3">
          {SUMMARY_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl border bg-background/70 p-4 shadow-sm backdrop-blur">
                <div className={`inline-flex rounded-lg bg-gradient-to-br p-2.5 ${card.tone}`}>
                  <Icon size={16} />
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {t(card.label)}
                </p>
                <p className="mt-1 text-base font-bold">{displayValue(card)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t(card.helper)}</p>
              </div>
            );
          })}
        </div>
      </SettingsHero>
    </div>
  );
}
