"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import type { HelpVideo } from "./help-videos";

export function TutorialVideoDialog({
  video,
  open,
  onOpenChange,
}: {
  video: HelpVideo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t(video.titleKey)}</DialogTitle>
          <DialogDescription>{t(video.descriptionKey)}</DialogDescription>
        </DialogHeader>
        <div className="aspect-video overflow-hidden rounded-md border bg-muted">
          {open && (
            <iframe
              className="size-full"
              src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0`}
              title={t(video.titleKey)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
