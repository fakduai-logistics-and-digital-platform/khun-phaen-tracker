"use client";

import { useEffect } from "react";
import { AccountShell } from "@/components/account/account-shell";
import { SetupPasswordForm } from "@/components/account/setup-password-form";
import { useI18n } from "@/lib/i18n";

export default function SetupPasswordPage() {
  const { t } = useI18n();

  useEffect(() => {
    document.title = t("meta__setup_password_title");
  }, [t]);

  return (
    <AccountShell
      brandName={t("setup__brand_name")}
      heroTitle1={t("setup__hero_title_1")}
      heroTitle2={t("setup__hero_title_2")}
      heroDescription={t("setup__hero_desc")}
      valueProps={[t("setup__value_prop_1"), t("setup__value_prop_2")]}
      footer={<span>{t("setup__footer_text")}</span>}
    >
      <SetupPasswordForm />
    </AccountShell>
  );
}
