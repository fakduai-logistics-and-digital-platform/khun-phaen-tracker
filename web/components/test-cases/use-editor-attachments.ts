"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_ATTACHMENTS } from "./editor-options";

export type AttachmentFile = { file: File; url: string };

export function useEditorAttachments() {
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const latest = useRef(attachments);
  latest.current = attachments;

  useEffect(
    () => () => {
      latest.current.forEach((a) => URL.revokeObjectURL(a.url));
    },
    [],
  );

  const addAttachments = useCallback((files: FileList | null) => {
    if (!files) return;
    setAttachments((prev) => {
      const remaining = MAX_ATTACHMENTS - prev.length;
      const created = Array.from(files)
        .slice(0, remaining)
        .map((file) => ({ file, url: URL.createObjectURL(file) }));
      return [...prev, ...created];
    });
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  return { attachments, addAttachments, removeAttachment };
}
