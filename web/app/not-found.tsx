"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();

  useEffect(() => {
    document.title = `404 - ${t("error__default_title")}`;
  }, [t]);

  return (
    <div className="relative flex min-h-[75vh] flex-col items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
        <h1 className="mb-4 bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-6xl font-black tracking-tighter text-transparent sm:text-8xl">
          404
        </h1>
        <h2 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">{t("error__default_title")}</h2>
        <p className="mx-auto mb-10 max-w-md text-lg leading-relaxed text-muted-foreground">
          {t("error__404_message")}
        </p>

        <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
          <Button variant="outline" size="lg" className="w-full gap-2 sm:w-auto" onClick={() => window.history.back()}>
            <ArrowLeft size={18} />
            {t("error__btn_back")}
          </Button>
          <Button asChild size="lg" className="w-full gap-2 sm:w-auto">
            <Link href="/">
              <Home size={18} />
              {t("error__btn_home")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
