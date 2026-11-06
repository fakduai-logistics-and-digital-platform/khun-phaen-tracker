"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

type Doc = "privacy" | "terms" | null;

export function LegalFooter() {
  const { t } = useI18n();
  const [open, setOpen] = useState<Doc>(null);

  return (
    <>
      <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <button type="button" className="transition-colors hover:text-foreground" onClick={() => setOpen("privacy")}>
          {t("login__link_privacy")}
        </button>
        <button type="button" className="transition-colors hover:text-foreground" onClick={() => setOpen("terms")}>
          {t("login__link_terms")}
        </button>
        <a
          href="https://fakduai.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://fakduai.com/favicon.ico"
            alt="Fakduai Logo"
            className="size-4 rounded-sm bg-muted object-contain p-0.5"
          />
          {t("login__powered_by")} Fakduai
        </a>
      </footer>

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {open === "terms" ? t("login__terms_title") : t("login__privacy_title")}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {open === "terms" ? t("login__terms_content") : t("login__privacy_content")}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
