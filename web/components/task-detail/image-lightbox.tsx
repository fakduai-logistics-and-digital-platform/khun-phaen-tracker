"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface LightboxImage {
  src: string;
  alt: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  startIndex: number;
  onClose: () => void;
}

const TOOL_BUTTON = "rounded-lg bg-black/40 p-2 text-white transition-colors hover:bg-black/60";
const SEPARATOR = <div className="h-5 w-px bg-white/20" />;

export function ImageLightbox({ images, startIndex, onClose }: ImageLightboxProps) {
  const { t } = useI18n();
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), images.length - 1));
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const current = images[index];
  const src = current?.src ?? "";
  const alt = current?.alt ?? "";

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 5)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.25, 0.25)), []);
  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  }, []);
  const rotateRight = useCallback(() => setRotation((r) => (r + 90) % 360), []);

  const fitToScreen = useCallback(() => {
    setOffset({ x: 0, y: 0 });
    const img = new window.Image();
    img.onload = () => setZoom(Math.min((window.innerHeight * 0.9) / img.naturalHeight, 5));
    img.src = src;
  }, [src]);

  const navigate = useCallback(
    (step: number) => {
      if (images.length <= 1) return;
      setIndex((i) => (i + step + images.length) % images.length);
      resetView();
    },
    [images.length, resetView],
  );

  const copyToClipboard = useCallback(async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopyFeedback(t("taskForm__comments_lightbox_copied"));
    } catch {
      setCopyFeedback(t("taskForm__comments_lightbox_copy_failed"));
    }
    setTimeout(() => setCopyFeedback(""), 2000);
  }, [src, t]);

  const download = useCallback(async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${alt && alt !== "Image" ? alt : "image"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      /* Download is best effort; a failed fetch leaves the viewer unchanged. */
    }
  }, [src, alt]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      switch (event.key) {
        case "Escape":
          onClose();
          break;
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
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, zoomIn, zoomOut, resetView, rotateRight, fitToScreen, navigate, copyToClipboard]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      if (event.deltaY < 0) zoomIn();
      else zoomOut();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomIn, zoomOut]);

  function startDrag(event: React.MouseEvent) {
    if (event.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
  }

  function moveDrag(event: React.MouseEvent) {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.offsetX + (event.clientX - dragStart.current.x),
      y: dragStart.current.offsetY + (event.clientY - dragStart.current.y),
    });
  }

  if (!current) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[20020] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("taskForm__comments_lightbox_aria")}
      tabIndex={-1}
    >
      <button
        type="button"
        className="absolute inset-0 -z-10 cursor-default"
        aria-label={t("taskForm__comments_lightbox_aria")}
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
        <span className="rounded bg-black/40 px-2 py-1 font-mono text-sm text-white/70">{Math.round(zoom * 100)}%</span>
        {rotation !== 0 && (
          <span className="rounded bg-black/40 px-2 py-1 font-mono text-sm text-white/70">{rotation}°</span>
        )}
        {images.length > 1 && (
          <span className="rounded bg-black/40 px-2 py-1 text-sm text-white/70">
            {index + 1}/{images.length}
          </span>
        )}
        {SEPARATOR}
        <button
          type="button"
          onClick={zoomIn}
          className={TOOL_BUTTON}
          title={t("taskForm__comments_lightbox_zoom_in")}
          aria-label={t("taskForm__comments_lightbox_zoom_in")}
        >
          <ZoomIn size={18} />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          className={TOOL_BUTTON}
          title={t("taskForm__comments_lightbox_zoom_out")}
          aria-label={t("taskForm__comments_lightbox_zoom_out")}
        >
          <ZoomOut size={18} />
        </button>
        <button
          type="button"
          onClick={fitToScreen}
          className={TOOL_BUTTON}
          title={t("taskForm__comments_lightbox_fit")}
          aria-label={t("taskForm__comments_lightbox_fit")}
        >
          <Maximize2 size={18} />
        </button>
        <button
          type="button"
          onClick={rotateRight}
          className={TOOL_BUTTON}
          title={t("taskForm__comments_lightbox_rotate")}
          aria-label={t("taskForm__comments_lightbox_rotate")}
        >
          <RotateCw size={18} />
        </button>
        <button
          type="button"
          onClick={resetView}
          className={TOOL_BUTTON}
          title={t("taskForm__comments_lightbox_reset")}
          aria-label={t("taskForm__comments_lightbox_reset")}
        >
          <RotateCcw size={18} />
        </button>
        {SEPARATOR}
        <button
          type="button"
          onClick={() => void copyToClipboard()}
          className={cn(TOOL_BUTTON, "relative")}
          title={t("taskForm__comments_lightbox_copy")}
          aria-label={t("taskForm__comments_lightbox_copy")}
        >
          <Copy size={18} />
          {copyFeedback && (
            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded bg-success px-2 py-0.5 text-xs whitespace-nowrap text-white">
              {copyFeedback}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => void download()}
          className={TOOL_BUTTON}
          title={t("taskForm__comments_lightbox_download")}
          aria-label={t("taskForm__comments_lightbox_download")}
        >
          <Download size={18} />
        </button>
        <button
          type="button"
          onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
          className={TOOL_BUTTON}
          title={t("taskForm__comments_lightbox_open_new_tab")}
          aria-label={t("taskForm__comments_lightbox_open_new_tab")}
        >
          <ExternalLink size={18} />
        </button>
        {SEPARATOR}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-black/40 p-2 text-white transition-colors hover:bg-destructive/80"
          title={t("taskForm__comments_lightbox_close")}
          aria-label={t("taskForm__comments_lightbox_close")}
        >
          <X size={18} />
        </button>
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white transition-colors hover:bg-black/60"
            title={t("taskForm__comments_lightbox_prev")}
            aria-label={t("taskForm__comments_lightbox_prev")}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white transition-colors hover:bg-black/60"
            title={t("taskForm__comments_lightbox_next")}
            aria-label={t("taskForm__comments_lightbox_next")}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={cn(
          "max-h-[85vh] max-w-[90vw] object-contain select-none",
          dragging ? "cursor-grabbing" : "cursor-grab transition-transform duration-150",
        )}
        style={{
          transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px) rotate(${rotation}deg)`,
        }}
        onMouseDown={startDrag}
        onMouseMove={moveDrag}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
      />

      {alt && alt !== "Image" && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm text-white/80">
          {alt}
        </div>
      )}
    </div>
  );
}
