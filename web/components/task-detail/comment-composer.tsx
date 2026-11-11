"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Extension } from "@tiptap/core";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { FileText, Paperclip, Send, X } from "lucide-react";
import { RichTextEditor as EditorUI, Link } from "@/components/editor";
import { Button } from "@/components/ui/button";
import type { Assignee } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { processFilesForPreview, revokePreview } from "@/lib/utils/file";
import { mentionPattern } from "./mentions";
import "@/components/editor/style.css";

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

type MentionState = { query: string; from: number; to: number };

const MENTION_TRIGGER = /(^|\s)@([^\s@]*)$/;
const MAX_SUGGESTIONS = 6;

/** The `@query` right before the caret, with the document range to replace when a person is picked. */
function detectMention(editor: Editor): MentionState | null {
  const { selection } = editor.state;
  if (!selection.empty) return null;
  const { $from } = selection;
  const before = $from.parent.textBetween(
    0,
    $from.parentOffset,
    undefined,
    "￼",
  );
  const match = MENTION_TRIGGER.exec(before);
  if (!match) return null;
  return {
    query: match[2],
    from: selection.from - match[2].length - 1,
    to: selection.from,
  };
}

/** Marks every `@Name` of a known person while typing; the text itself stays plain so the server still finds it. */
const MentionHighlight = Extension.create<{ getPattern: () => RegExp | null }>({
  name: "mentionHighlight",
  addOptions: () => ({ getPattern: () => null }),
  addProseMirrorPlugins() {
    const { getPattern } = this.options;
    return [
      new Plugin({
        props: {
          decorations(state) {
            const pattern = getPattern();
            if (!pattern) return null;
            const marks: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              for (const match of node.text.matchAll(pattern)) {
                marks.push(
                  Decoration.inline(
                    pos + match.index,
                    pos + match.index + match[0].length,
                    {
                      class: "rounded-sm bg-primary/20 font-medium",
                    },
                  ),
                );
              }
            });
            return DecorationSet.create(state.doc, marks);
          },
        },
      }),
    ];
  },
});

export function CommentComposer({
  userInitial,
  assignees,
  onSubmit,
}: CommentComposerProps) {
  const { t } = useI18n();
  const [attached, setAttached] = useState<AttachedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [focused, setFocused] = useState(false);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachedRef = useRef(attached);
  attachedRef.current = attached;

  const pattern = useMemo(
    () => mentionPattern(assignees.map((a) => a.name)),
    [assignees],
  );
  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  const suggestions = mention
    ? assignees
        .filter(
          (a) =>
            a.name &&
            a.name.toLowerCase().includes(mention.query.toLowerCase()),
        )
        .slice(0, MAX_SUGGESTIONS)
    : [];

  // The editor is created once, so its key handlers read the latest state through refs.
  const live = useRef({ mention, suggestions, activeSuggestion });
  live.current = { mention, suggestions, activeSuggestion };
  const actions = useRef({
    submit: () => {},
    pick: (_assignee: Assignee) => {},
    addFiles: (_files: File[]) => {},
  });

  useEffect(
    () => () => {
      attachedRef.current.forEach((af) => revokePreview(af.preview));
    },
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({ link: false, heading: false, trailingNode: false }),
      Markdown,
      Link,
      Placeholder.configure({
        placeholder: t("taskForm__comments_placeholder"),
        emptyEditorClass: "is-editor-empty",
      }),
      MentionHighlight.configure({ getPattern: () => patternRef.current }),
    ],
    contentType: "markdown",
    editorProps: {
      attributes: {
        "aria-label": t("taskForm__comments_placeholder"),
        class: "min-h-20 max-h-72 overflow-y-auto outline-none",
      },
      handlePaste: (_view, event) => {
        const files: File[] = [];
        for (const item of Array.from(event.clipboardData?.items ?? [])) {
          const file = item.kind === "file" ? item.getAsFile() : null;
          if (file) files.push(file);
        }
        if (files.length === 0) return false;
        actions.current.addFiles(files);
        return true;
      },
      handleKeyDown: (_view, event) => {
        const {
          mention: open,
          suggestions: options,
          activeSuggestion: active,
        } = live.current;
        if (open && options.length > 0) {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActiveSuggestion(
              (i) => (i + step + options.length) % options.length,
            );
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            actions.current.pick(options[active]);
            return true;
          }
        }
        if (open && event.key === "Escape") {
          event.preventDefault();
          setMention(null);
          return true;
        }
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          actions.current.submit();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: next }) => {
      setIsEmpty(next.isEmpty);
      setMention(detectMention(next));
      setActiveSuggestion(0);
    },
    onSelectionUpdate: ({ editor: next }) => setMention(detectMention(next)),
    onBlur: () => setMention(null),
  });

  const expanded = focused || !isEmpty || attached.length > 0;
  const canSubmit = (!isEmpty || attached.length > 0) && !submitting;

  actions.current.addFiles = (files) => {
    if (files.length === 0) return;
    setAttached((prev) => [...prev, ...processFilesForPreview(files)]);
  };

  actions.current.pick = (assignee) => {
    const target = live.current.mention;
    if (!editor || !target) return;
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: target.from, to: target.to },
        { type: "text", text: `@${assignee.name} ` },
      )
      .run();
    setMention(null);
  };

  actions.current.submit = async () => {
    if (!editor || !canSubmit) return;
    setSubmitting(true);
    const ok = await onSubmit(
      editor.getMarkdown(),
      attached.map((af) => af.file),
    );
    setSubmitting(false);
    if (!ok) return;
    attached.forEach((af) => revokePreview(af.preview));
    setAttached([]);
    editor.commands.clearContent(true);
  };

  function removeFile(index: number) {
    setAttached((prev) => {
      revokePreview(prev[index]?.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  return (
    <div className="flex gap-3 pt-2">
      <div className="shrink-0">
        <div className="flex size-8 select-none items-center justify-center rounded-full bg-brand-500 text-sm font-medium text-white">
          {userInitial}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div
          role="presentation"
          data-expanded={expanded}
          className="[&_.ProseMirror]:min-h-9! [&_.ProseMirror]:max-h-48 [&_.ProseMirror]:overflow-y-auto data-[expanded=true]:[&_.ProseMirror]:min-h-16!"
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
          }}
          // Buttons must not take focus from the editor, or the bar would collapse before the click lands.
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) e.preventDefault();
          }}
        >
          <EditorUI editor={editor} variant="compact">
            {expanded && (
              <EditorUI.Toolbar>
                <EditorUI.ControlsGroup>
                  <EditorUI.Bold />
                  <EditorUI.Italic />
                  <EditorUI.Strikethrough />
                </EditorUI.ControlsGroup>
                <EditorUI.ControlsGroup>
                  <EditorUI.BulletList />
                  <EditorUI.OrderedList />
                </EditorUI.ControlsGroup>
                <EditorUI.ControlsGroup>
                  <EditorUI.Link />
                </EditorUI.ControlsGroup>
              </EditorUI.Toolbar>
            )}
            <div className="relative">
              <EditorContent
                editor={editor}
                className="rte-content w-full"
                spellCheck={false}
              />
              {mention && suggestions.length > 0 && (
                <div
                  role="listbox"
                  aria-label={t("taskForm__comments_mention")}
                  className="absolute bottom-full left-3 z-10 mb-1 max-h-56 w-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                >
                  {suggestions.map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      role="option"
                      aria-selected={i === activeSuggestion}
                      aria-label={a.name}
                      // Keep focus in the editor; blur would close the list before the click lands.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => actions.current.pick(a)}
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
            </div>
            {attached.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t px-3 py-2">
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
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                actions.current.addFiles(
                  Array.from(e.currentTarget.files || []),
                );
                e.currentTarget.value = "";
              }}
            />
            {expanded && (
              <div className="flex items-center gap-1 border-t px-2 py-1.5">
                <span className="me-auto ps-1 text-xs text-muted-foreground">
                  ⌘+Enter · @ {t("taskForm__comments_mention_hint")}
                </span>
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
                  onClick={() => void actions.current.submit()}
                  disabled={!canSubmit}
                  title="Send (⌘+Enter)"
                  aria-label="Send (⌘+Enter)"
                >
                  <Send />
                </Button>
              </div>
            )}
          </EditorUI>
        </div>
      </div>
    </div>
  );
}
