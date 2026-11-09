"use client";

import { useEffect, useState } from "react";
import { TutorialVideoDialog } from "./tutorial-video-dialog";
import type { HelpVideo } from "./help-videos";

function hasSeen(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

/** Opens the video once for a first-time visitor; closing it remembers that on this browser. */
export function FirstVisitTutorial({ video }: { video: HelpVideo }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasSeen(video.seenKey)) setOpen(true);
  }, [video.seenKey]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) return;
    try {
      localStorage.setItem(video.seenKey, "1");
    } catch {}
  }

  return <TutorialVideoDialog video={video} open={open} onOpenChange={handleOpenChange} />;
}
