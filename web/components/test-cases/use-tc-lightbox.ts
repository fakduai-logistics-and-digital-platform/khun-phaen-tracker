"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signedFileUrl } from "@/lib/api/file-urls";

type LightboxImage = { src: string; alt: string };

export function useTcLightbox() {
  const [images, setImages] = useState<LightboxImage[]>([]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const current = images[index];

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  const openLightbox = useCallback(
    async (list: { file_key: string; filename?: string }[], startIndex: number) => {
      const urls = await Promise.all(list.map((img) => signedFileUrl(img.file_key)));
      const mapped = list.map((img, i) => ({
        src: urls[i] ?? "",
        alt: img.filename || "Image",
      }));
      setImages(mapped);
      setIndex(Math.min(Math.max(startIndex, 0), mapped.length - 1));
      resetView();
      setOpen(true);
    },
    [resetView],
  );

  const close = useCallback(() => {
    setOpen(false);
    setDragging(false);
  }, []);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 5)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.25, 0.25)), []);
  const rotateRight = useCallback(() => setRotation((r) => (r + 90) % 360), []);

  const navigate = useCallback(
    (step: 1 | -1) => {
      if (images.length <= 1) return;
      setIndex((i) => (i + step + images.length) % images.length);
      resetView();
    },
    [images.length, resetView],
  );

  const openInNewTab = useCallback(() => {
    if (current) window.open(current.src, "_blank", "noopener,noreferrer");
  }, [current]);

  const download = useCallback(async () => {
    if (!current) return;
    try {
      const a = document.createElement("a");
      const res = await fetch(current.src);
      const blob = await res.blob();
      a.href = URL.createObjectURL(blob);
      a.download = (current.alt && current.alt !== "Image" ? current.alt : "image") + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {}
  }, [current]);

  const startDrag = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;
      setDragging(true);
      dragStart.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
    },
    [offset],
  );

  const moveDrag = useCallback(
    (event: React.MouseEvent) => {
      if (!dragging) return;
      const s = dragStart.current;
      setOffset({ x: s.offsetX + (event.clientX - s.x), y: s.offsetY + (event.clientY - s.y) });
    },
    [dragging],
  );

  const endDrag = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          close();
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
        case "ArrowLeft":
          navigate(-1);
          break;
        case "ArrowRight":
          navigate(1);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, zoomIn, zoomOut, resetView, rotateRight, navigate]);

  return {
    open,
    current,
    count: images.length,
    index,
    zoom,
    offset,
    rotation,
    dragging,
    openLightbox,
    close,
    zoomIn,
    zoomOut,
    rotateRight,
    resetView,
    navigate,
    openInNewTab,
    download,
    startDrag,
    moveDrag,
    endDrag,
  };
}

export type TcLightbox = ReturnType<typeof useTcLightbox>;
