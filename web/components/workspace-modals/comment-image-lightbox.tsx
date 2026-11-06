"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Maximize2,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type LightboxImage = { src: string; alt: string };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

const TOOLBAR_BUTTON = "rounded-lg bg-black/40 p-2 text-white transition-colors hover:bg-black/60";

export function CommentImageLightbox({
  images,
  startIndex,
  onClose,
}: {
  images: LightboxImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const fallbackAlt = t("taskForm__comments_image_fallback_alt");
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), images.length - 1));
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const dragRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 });

  const current = images[index];

  const zoomIn = () => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  const zoomOut = () => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  const rotateRight = () => setRotation((r) => (r + 90) % 360);

  function resetView() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  }

  function fitToScreen() {
    setOffset({ x: 0, y: 0 });
    const img = new window.Image();
    img.onload = () => setZoom(Math.min((window.innerHeight * 0.9) / img.naturalHeight, MAX_ZOOM));
    img.src = current.src;
  }

  function navigate(delta: 1 | -1) {
    if (images.length <= 1) return;
    setIndex((i) => (i + delta + images.length) % images.length);
    resetView();
  }

  function showCopyFeedback(message: string) {
    setCopyFeedback(message);
    setTimeout(() => setCopyFeedback(""), 2000);
  }

  async function copyToClipboard() {
    try {
      const blob = await (await fetch(current.src)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showCopyFeedback(t("taskForm__comments_lightbox_copied"));
    } catch {
      showCopyFeedback(t("taskForm__comments_lightbox_copy_failed"));
    }
  }

  async function downloadImage() {
    try {
      const blob = await (await fetch(current.src)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${current.alt || fallbackAlt}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    }
  }

  function openInNewTab() {
    window.open(current.src, "_blank", "noopener,noreferrer");
  }

  function handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "+":
      case "=":
        zoomIn();
        break;
      case "-":
        zoomOut();
        break;
      case "0":
        resetView();
        break;
      case "r":
      case "R":
        rotateRight();
        break;
      case "f":
      case "F":
        fitToScreen();
        break;
      case "ArrowLeft":
        navigate(-1);
        break;
      case "ArrowRight":
        navigate(1);
        break;
      case "c":
      case "C":
        if (!event.metaKey && !event.ctrlKey) void copyToClipboard();
        break;
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (event.button !== 0) return;
    setDragging(true);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  }

  function handleMouseMove(event: MouseEvent) {
    if (!dragging) return;
    const { startX, startY, originX, originY } = dragRef.current;
    setOffset({ x: originX + (event.clientX - startX), y: originY + (event.clientY - startY) });
  }

  const attachWheelZoom = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      setZoom((z) => (event.deltaY < 0 ? Math.min(z + ZOOM_STEP, MAX_ZOOM) : Math.max(z - ZOOM_STEP, MIN_ZOOM)));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const tools: { icon: LucideIcon; titleKey: string; onClick: () => void; className?: string }[] = [
    { icon: ZoomIn, titleKey: "taskForm__comments_lightbox_zoom_in", onClick: zoomIn },
    { icon: ZoomOut, titleKey: "taskForm__comments_lightbox_zoom_out", onClick: zoomOut },
    { icon: Maximize2, titleKey: "taskForm__comments_lightbox_fit", onClick: fitToScreen },
    { icon: RotateCw, titleKey: "taskForm__comments_lightbox_rotate", onClick: rotateRight },
    { icon: RotateCcw, titleKey: "taskForm__comments_lightbox_reset", onClick: resetView },
  ];
  const actions: { icon: LucideIcon; titleKey: string; onClick: () => void }[] = [
    { icon: Download, titleKey: "taskForm__comments_lightbox_download", onClick: () => void downloadImage() },
    { icon: ExternalLink, titleKey: "taskForm__comments_lightbox_open_new_tab", onClick: openInNewTab },
  ];

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        ref={attachWheelZoom}
        showCloseButton={false}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.target === e.currentTarget && onClose()}
        className="top-0 left-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center rounded-none border-0 bg-black/80 p-0 backdrop-blur-sm sm:max-w-none"
      >
        <DialogTitle className="sr-only">{t("taskForm__comments_lightbox_aria")}</DialogTitle>
        <DialogDescription className="sr-only">{current.alt || fallbackAlt}</DialogDescription>

        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
          <span className="rounded bg-black/40 px-2 py-1 font-mono text-sm text-white/70">
            {Math.round(zoom * 100)}%
          </span>
          {rotation !== 0 && (
            <span className="rounded bg-black/40 px-2 py-1 font-mono text-sm text-white/70">{rotation}°</span>
          )}
          {images.length > 1 && (
            <span className="rounded bg-black/40 px-2 py-1 text-sm text-white/70">
              {index + 1}/{images.length}
            </span>
          )}
          <div className="h-5 w-px bg-white/20" />
          {tools.map(({ icon: Icon, titleKey, onClick }) => (
            <button
              key={titleKey}
              type="button"
              onClick={onClick}
              title={t(titleKey)}
              aria-label={t(titleKey)}
              className={TOOLBAR_BUTTON}
            >
              <Icon size={18} />
            </button>
          ))}
          <div className="h-5 w-px bg-white/20" />
          <button
            type="button"
            onClick={() => void copyToClipboard()}
            title={t("taskForm__comments_lightbox_copy")}
            aria-label={t("taskForm__comments_lightbox_copy")}
            className={cn(TOOLBAR_BUTTON, "relative")}
          >
            <Copy size={18} />
            {copyFeedback && (
              <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded bg-success px-2 py-0.5 text-xs whitespace-nowrap text-white">
                {copyFeedback}
              </span>
            )}
          </button>
          {actions.map(({ icon: Icon, titleKey, onClick }) => (
            <button
              key={titleKey}
              type="button"
              onClick={onClick}
              title={t(titleKey)}
              aria-label={t(titleKey)}
              className={TOOLBAR_BUTTON}
            >
              <Icon size={18} />
            </button>
          ))}
          <div className="h-5 w-px bg-white/20" />
          <button
            type="button"
            onClick={onClose}
            title={t("taskForm__comments_lightbox_close")}
            aria-label={t("taskForm__comments_lightbox_close")}
            className={cn(TOOLBAR_BUTTON, "hover:bg-destructive/80")}
          >
            <X size={18} />
          </button>
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => navigate(-1)}
              title={t("taskForm__comments_lightbox_prev")}
              aria-label={t("taskForm__comments_lightbox_prev")}
              className="absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white transition-colors hover:bg-black/60"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              title={t("taskForm__comments_lightbox_next")}
              aria-label={t("taskForm__comments_lightbox_next")}
              className="absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white transition-colors hover:bg-black/60"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        <img
          src={current.src}
          alt={current.alt}
          draggable={false}
          role="presentation"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
          className={cn(
            "max-h-[85vh] max-w-[90vw] object-contain select-none",
            dragging ? "cursor-grabbing" : "cursor-grab transition-transform duration-150",
          )}
          style={{
            transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px) rotate(${rotation}deg)`,
          }}
        />

        {current.alt && current.alt !== fallbackAlt && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm text-white/80">
            {current.alt}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
