"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { LanguagePicker } from "@/components/language-picker";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PaletteSwitch } from "@/components/palette-switch";
import { Search as HeaderSearch } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { HELP_VIDEOS, type HelpVideo } from "@/components/help/help-videos";
import { TutorialVideoDialog } from "@/components/help/tutorial-video-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export default function HelpPage() {
  const { t } = useI18n();
  const [active, setActive] = useState<HelpVideo | null>(null);

  useEffect(() => {
    document.title = t("meta__help_title");
  }, [t]);

  return (
    <AuthenticatedLayout>
      <Header>
        <HeaderSearch />
        <div className="ms-auto flex items-center gap-2">
          <LanguagePicker />
          <PaletteSwitch />
          <ThemeSwitch />
        </div>
      </Header>
      <Main id="content">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{t("help__title")}</h1>
          <p className="text-sm text-muted-foreground">{t("help__subtitle")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {HELP_VIDEOS.map((video) => (
            <Card key={video.id} className="overflow-hidden py-0">
              <button
                type="button"
                className="group relative block aspect-video w-full bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={t(video.titleKey)}
                onClick={() => setActive(video)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
                  <span className="flex size-12 items-center justify-center rounded-full bg-background text-foreground shadow-md">
                    <Play className="size-5 translate-x-px" fill="currentColor" />
                  </span>
                </span>
              </button>
              <CardContent className="space-y-1 pb-4">
                <h2 className="text-sm font-medium">{t(video.titleKey)}</h2>
                <p className="text-sm text-muted-foreground">{t(video.descriptionKey)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Main>
      {active && (
        <TutorialVideoDialog video={active} open onOpenChange={(open) => !open && setActive(null)} />
      )}
    </AuthenticatedLayout>
  );
}
