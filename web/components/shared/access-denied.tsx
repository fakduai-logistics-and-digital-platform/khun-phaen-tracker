"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type AccessDeniedProps = {
  message?: string;
};

export function AccessDenied({ message }: AccessDeniedProps) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm md:p-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <Lock size={28} strokeWidth={2} />
        </div>
        <h2 className="mb-3 text-2xl font-bold text-foreground">{t("page__no_access")}</h2>
        <p className="mb-8 leading-relaxed text-muted-foreground">{message ?? t("page__no_access_desc")}</p>
        <Button
          type="button"
          size="lg"
          className="w-full rounded-xl font-semibold"
          onClick={() => router.push("/dashboard")}
        >
          {t("page__back_to_dashboard")}
        </Button>
      </div>
    </div>
  );
}
