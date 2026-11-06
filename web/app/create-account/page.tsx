"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { InviteForm } from "@/components/account/invite-form";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";

export default function CreateAccountPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    document.title = t("meta__create_account_title");
  }, [t]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) router.replace("/dashboard");
  }, [loading, user, router]);

  return (
    <AccountShell
      brandName={t("create__brand_name")}
      heroTitle1={t("create__hero_title_1")}
      heroTitle2={t("create__hero_title_2")}
      heroDescription={t("create__hero_desc")}
      valueProps={[t("create__value_prop_1"), t("create__value_prop_2"), t("create__value_prop_3")]}
      footer={
        <>
          <a href="#!" className="transition-colors hover:text-white">
            {t("create__link_privacy")}
          </a>
          <a href="#!" className="transition-colors hover:text-white">
            {t("create__link_terms")}
          </a>
        </>
      }
    >
      <InviteForm />
    </AccountShell>
  );
}
