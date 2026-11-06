"use client";

import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { sanitizeHtml } from "@/lib/sanitize-html";

const MARKDOWN_CLASS = [
  "max-w-none text-sm leading-relaxed",
  "[&_p]:my-2 [&_h1]:my-3 [&_h1]:text-xl [&_h1]:font-medium [&_h2]:my-3 [&_h2]:text-lg [&_h2]:font-medium [&_h3]:my-2 [&_h3]:font-semibold",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_hr]:my-4 [&_img]:max-w-full [&_table]:my-2 [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1",
].join(" ");

function renderMarkdown(markdown: string): string {
  if (!markdown) return "";
  try {
    return sanitizeHtml(marked.parse(markdown, { breaks: true, gfm: true }) as string);
  } catch {
    return "";
  }
}

interface TaskDescriptionProps {
  notes: string;
  onSave: (notes: string) => Promise<void>;
}

export function TaskDescription({ notes, onSave }: TaskDescriptionProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);

  useEffect(() => {
    if (!editing) setDraft(notes);
  }, [notes, editing]);

  const html = useMemo(() => renderMarkdown(draft), [draft]);

  async function save() {
    await onSave(draft);
    setEditing(false);
  }

  function cancel() {
    setDraft(notes);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <RichTextEditor value={draft} onChange={setDraft} placeholder={t("taskDetail__no_description")} />
        <div className="mt-2 flex animate-in items-center justify-end gap-2 fade-in slide-in-from-bottom-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancel}
            className="text-xs font-medium text-muted-foreground"
          >
            {t("page__cancel")}
          </Button>
          <Button type="button" size="sm" onClick={() => void save()} className="text-xs font-medium">
            {t("page__save")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => e.key === "Enter" && setEditing(true)}
        className="min-h-[100px] cursor-text rounded-lg px-3 py-3 transition-colors outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {draft ? (
          <div className={MARKDOWN_CLASS} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="text-muted-foreground">{t("taskDetail__no_description")}</p>
        )}
      </div>
    </div>
  );
}
