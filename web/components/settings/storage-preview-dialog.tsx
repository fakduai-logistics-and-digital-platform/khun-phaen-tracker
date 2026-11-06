"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { buildFileUrl, isImageFile, isVideoFile, resolveVideoSource } from "@/components/settings/storage-utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

type StoragePreviewDialogProps = {
  previewKey: string;
  siblingKeys: string[];
  onClose: () => void;
};

function VideoPreview({ fileKey, siblingKeys }: { fileKey: string; siblingKeys: string[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    const source = resolveVideoSource(fileKey, siblingKeys);

    (async () => {
      if (source.kind === "hls") {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          setSrc(source.url);
          return;
        }
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;
        if (Hls.isSupported()) {
          const player = new Hls();
          player.loadSource(source.url);
          player.attachMedia(video);
          hls = player;
          setSrc("");
          return;
        }
      }
      setSrc(source.url);
    })();

    return () => {
      cancelled = true;
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-black p-4">
      <video
        ref={videoRef}
        src={src || undefined}
        className="h-full max-h-full w-full max-w-full rounded-xl bg-black object-contain"
        controls
        playsInline
        preload="metadata"
      >
        <track kind="captions" />
      </video>
    </div>
  );
}

export function StoragePreviewDialog({ previewKey, siblingKeys, onClose }: StoragePreviewDialogProps) {
  const { t } = useI18n();
  const open = previewKey !== "";
  const url = open ? buildFileUrl(previewKey) : "";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="flex h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <DialogDescription className="text-xs font-semibold uppercase tracking-[0.2em]">
              {t("settings__storage_preview_title")}
            </DialogDescription>
            <DialogTitle className="mt-1 truncate text-sm font-semibold">{previewKey}</DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-9 items-center justify-center rounded-md border transition-colors hover:bg-accent"
              title={t("settings__storage_preview_open_new")}
              aria-label={t("settings__storage_preview_open_new")}
            >
              <ExternalLink size={18} />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-9 items-center justify-center rounded-md border transition-colors hover:bg-accent"
              aria-label={t("settings__storage_preview_close")}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-muted">
          {open && isImageFile(previewKey) ? (
            <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={previewKey}
                className="block h-full max-h-full w-auto max-w-full rounded-xl object-contain shadow-sm"
              />
            </div>
          ) : open && isVideoFile(previewKey) ? (
            <VideoPreview fileKey={previewKey} siblingKeys={siblingKeys} />
          ) : open ? (
            <iframe src={url} title={previewKey} className="h-full w-full border-0 bg-background" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
