"use client";

import { useEffect } from "react";
import { SettingsGeneral } from "@/components/settings/settings-general";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage() {
  const { t } = useI18n();

  useEffect(() => {
    document.title = t("meta__settings_title");
  }, [t]);

  return <SettingsGeneral />;
}
