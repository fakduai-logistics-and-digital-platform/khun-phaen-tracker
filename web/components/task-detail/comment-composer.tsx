"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Maximize2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Assignee } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { processFilesForPreview, revokePreview } from "@/lib/utils/file";
import { findMentioned, MentionHoverCard, mentionPattern } from "./mentions";

interface AttachedFile {
  file: File;
  preview?: string;
}

interface CommentComposerProps {
  userInitial: string;
  /** People that can be tagged with `@`. */
  assignees: Assignee[];
  onSubmit: (content: string, files: File[]) => Promise<boolean>;
}

const MENTION_TRIGGER = /(^|\s)@([^\s@]*)$/;
const MAX_SUGGESTIONS = 6;

export function CommentComposer({
  userInitial,
  assignees,
  onSubmit,
}: CommentComposerProps) {
  const { t } = useI18n();
  const [content, setContent] = useState("");
  const [attached, setAttached] = useState<AttachedFile[]>([]);
  const [rows, setRows] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [mention, setMention] = useState<{
    query: string;
    start: number;
  } | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachedRef = useRef(attached);
  attachedRef.current = attached;

  useEffect(
    () => () => {
      attachedRef.current.forEach((af) => revokePreview(af.preview));
    },
    [],
  );

  const pattern = useMemo(
    () => mentionPattern(assignees.map((a) => a.name)),
    [assignees],
  );

  const suggestions = mention
    ? assignees
        .filter(
          (a) =>
            a.name &&
            a.name.toLowerCase().includes(mention.query.toLowerCase()),
        )
        .slice(0, MAX_SUGGESTIONS)
    : [];

  function detectMention(value: string, caret: number) {
    const match = MENTION_TRIGGER.exec(value.slice(0, caret));
    setMention(
      match ? { query: match[2], start: caret - match[2].length - 1 } : null,
    );
    setActiveSuggestion(0);
  }

  function pickMention(assignee: Assignee) {
    const area = textareaRef.current;
    if (!mention || !area) return;
    const before = content.slice(0, mention.start);
    const after = content.slice(area.selectionStart);
    const inserted = `@${assignee.name} `;
    setContent(`${before}${inserted}${after}`);
    setMention(null);
    const caret = before.length + inserted.length;
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(caret, caret);
    });
  }

  const canSubmit =
    (content.trim().length > 0 || attached.length > 0) && !submitting;

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    setAttached((prev) => [...prev, ...processFilesForPreview(files)]);
  }

  function removeFile(index: number) {
    setAttached((prev) => {
      revokePreview(prev[index]?.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files: File[] = [];
    for (const item of Array.from(e.clipboardData?.items ?? [])) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    addFiles(files);
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const ok = await onSubmit(
      content,
      attached.map((af) => af.file),
    );
    setSubmitting(false);
    if (!ok) return;
    attached.forEach((af) => revokePreview(af.preview));
    setContent("");
    setAttached([]);
  }

  return (
    <div className="flex gap-3 pt-2">
      <div className="shrink-0">
        <div className="flex size-8 select-none items-center justify-center rounded-full bg-brand-500 text-sm font-medium text-white">
          {userInitial}
        </div>
      </div>
      <div className="flex-1">
        <div className="relative rounded-lg border bg-transparent transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.currentTarget.files || []));
              e.currentTarget.value = "";
            }}
          />
          {attached.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3">
              {attached.map((af, i) => (
                <div
                  key={`${af.file.name}-${i}`}
                  className="group relative flex items-center gap-2 rounded-lg border bg-muted p-1 text-xs text-muted-foreground"
                >
                  {af.preview ? (
                    <img
                      src={af.preview}
                      alt="preview"
                      className="size-8 rounded border object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex size-8 items-center justify-center rounded bg-accent text-muted-foreground">
                      <FileText size={12} />
                    </div>
                  )}
                  <span className="max-w-[100px] truncate px-1">
                    {af.file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Remove file"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                detectMention(e.target.value, e.target.selectionStart);
              }}
              onClick={(e) =>
                detectMention(content, e.currentTarget.selectionStart)
              }
              onBlur={() => setMention(null)}
              placeholder={t("taskForm__comments_placeholder")}
              rows={rows}
              aria-label={t("taskForm__comments_placeholder")}
              className="w-full resize-none bg-transparent px-4 pt-3 pb-10 text-sm text-foreground outline-none [scrollbar-width:none] placeholder:text-muted-foreground [&::-webkit-scrollbar]:hidden"
              onScroll={(e) => {
                if (overlayRef.current)
                  overlayRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (mention && suggestions.length > 0) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const step = e.key === "ArrowDown" ? 1 : -1;
                    setActiveSuggestion(
                      (i) =>
                        (i + step + suggestions.length) % suggestions.length,
                    );
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    pickMention(suggestions[activeSuggestion]);
                    return;
                  }
                }
                if (mention && e.key === "Escape") {
                  e.preventDefault();
                  setMention(null);
                  return;
                }
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            {pattern && (
              <div
                ref={overlayRef}
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden px-4 pt-3 pb-10 text-sm leading-normal break-words whitespace-pre-wrap text-transparent"
              >
                {content.split(pattern).map((part, i) =>
                  i % 2 === 1 ? (
                    <MentionHoverCard
                      key={i}
                      assignee={findMentioned(part, assignees)}
                    >
                      <span
                        role="presentation"
                        className="pointer-events-auto cursor-default rounded-sm bg-primary/25"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          textareaRef.current?.focus();
                        }}
                      >
                        {part}
                      </span>
                    </MentionHoverCard>
                  ) : (
                    <Fragment key={i}>{part}</Fragment>
                  ),
                )}
                {"\u200b"}
              </div>
            )}
          </div>
          {mention && suggestions.length > 0 && (
            <div
              role="listbox"
              aria-label={t("taskForm__comments_mention")}
              className="absolute bottom-12 left-3 z-10 max-h-56 w-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {suggestions.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={i === activeSuggestion}
                  aria-label={a.name}
                  // Keep focus in the textarea; blur would close the list before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickMention(a)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm",
                    i === activeSuggestion
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50",
                  )}
                >
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: a.color || "#6366f1" }}
                  >
                    {a.name[0]?.toUpperCase()}
                  </span>
                  <span className="truncate">{a.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title="Expand"
              aria-label="Expand"
              onClick={() => {
                setRows((r) => (r < 8 ? 8 : 3));
                textareaRef.current?.focus();
              }}
            >
              <Maximize2 />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title="Attach file"
              aria-label="Attach file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip />
            </Button>
            <Button
              type="button"
              size="icon"
              className="size-8"
              onClick={() => void submit()}
              disabled={!canSubmit}
              title="Send (⌘+Enter)"
              aria-label="Send (⌘+Enter)"
            >
              <Send />
            </Button>
          </div>
        </div>
        <p className="mt-1 pl-1 text-xs text-muted-foreground">
          ⌘+Enter to send · @ {t("taskForm__comments_mention_hint")}
        </p>
      </div>
    </div>
  );
}
