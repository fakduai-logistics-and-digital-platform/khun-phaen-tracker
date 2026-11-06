"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { TcLightbox } from "./use-tc-lightbox";

export function TcLightboxView({ lightbox }: { lightbox: TcLightbox }) {
  const { t } = useI18n();
  const { open, current } = lightbox;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") lightbox.close();
      if (e.key === "ArrowLeft") lightbox.navigate(-1);
      if (e.key === "ArrowRight") lightbox.navigate(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, lightbox]);

  if (!open || !current) return null;

  const tools = [
    { icon: ZoomOut, label: t("tc__title_zoom_out"), run: lightbox.zoomOut },
    { icon: ZoomIn, label: t("tc__title_zoom_in"), run: lightbox.zoomIn },
    { icon: RotateCw, label: t("tc__title_rotate"), run: lightbox.rotateRight },
    { icon: Download, label: t("tc__title_download"), run: lightbox.download },
    { icon: ExternalLink, label: t("tc__title_open_new_tab"), run: lightbox.openInNewTab },
    { icon: X, label: t("tc__close"), run: lightbox.close },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[30000] flex items-center justify-center bg-black/80"
    >
      <button
        type="button"
        className="absolute inset-0 -z-10 cursor-default"
        aria-label={t("tc__close")}
        tabIndex={-1}
        onClick={lightbox.close}
      />
      <div className="absolute right-4 top-4 flex items-center gap-1 rounded-lg bg-black/50 p-1">
        {tools.map(({ icon: Icon, label, run }) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white"
            aria-label={label}
            title={label}
            onClick={run}
          >
            <Icon size={18} />
          </Button>
        ))}
      </div>

      {lightbox.count > 1 && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 size-11 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
            aria-label={t("tc__title_previous")}
            onClick={() => lightbox.navigate(-1)}
          >
            <ChevronLeft size={24} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 size-11 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
            aria-label={t("tc__title_next")}
            onClick={() => lightbox.navigate(1)}
          >
            <ChevronRight size={24} />
          </Button>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/no-noninteractive-element-interactions */}
      <img
        src={current.src}
        alt={current.alt}
        draggable={false}
        className="max-h-[85vh] max-w-[90vw] select-none object-contain"
        style={{
          transform: `scale(${lightbox.zoom}) translate(${lightbox.offset.x / lightbox.zoom}px, ${lightbox.offset.y / lightbox.zoom}px) rotate(${lightbox.rotation}deg)`,
          cursor: lightbox.dragging ? "grabbing" : "grab",
        }}
        onMouseDown={lightbox.startDrag}
        onMouseMove={lightbox.moveDrag}
        onMouseUp={lightbox.endDrag}
        onMouseLeave={lightbox.endDrag}
      />
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1 text-sm text-white/80">
        {current.alt}
      </p>
    </div>
  );
}
