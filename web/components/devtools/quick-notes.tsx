"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, FilePlus, FileText, Pin, PinOff, Search, SquarePlus, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { noteText, quickNotes, type QuickNote } from "@/lib/stores/quickNotes";
import { cn } from "@/lib/utils";
import { QuickNoteEditor } from "./quick-note-editor";
import { ToolModal } from "./tool-modal";

function shortTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function sortNotes(notes: QuickNote[]) {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
}

export function QuickNotes({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const notes = useStore(quickNotes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<QuickNote | null>(null);

  const sorted = useMemo(() => sortNotes(notes), [notes]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? sorted.filter((note) => noteText(note.content).toLowerCase().includes(needle)) : sorted;
  }, [sorted, query]);
  const selected = notes.find((note) => note.id === selectedId) ?? null;

  // Like Notes on a Mac: there is always a note to type into.
  useEffect(() => {
    if (notes.length === 0) setSelectedId(quickNotes.add().id);
    else if (!selected) setSelectedId(sorted[0].id);
  }, [notes.length, selected, sorted]);

  function createNote() {
    setQuery("");
    setSelectedId(quickNotes.add().id);
  }

  async function copyNote(note: QuickNote) {
    try {
      await navigator.clipboard.writeText(noteText(note.content));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy text: ", error);
    }
  }

  function confirmDelete() {
    if (pendingDelete) quickNotes.remove(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <>
      <ToolModal
        onClose={onClose}
        title={t("quickNotes__title")}
        subtitle={t("quickNotes__subtitle")}
        icon={FileText}
        bodyClassName="overflow-hidden"
        headerActions={
          <>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={createNote}>
              <SquarePlus className="size-4" />
              {t("quickNotes__new")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!selected}
              onClick={() => selected && void copyNote(selected)}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {t("quickNotes__copy")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!selected}
              onClick={() => selected && setPendingDelete(selected)}
            >
              <Trash2 className="size-4" />
              {t("quickNotes__delete")}
            </Button>
          </>
        }
        footer={
          <p className="me-auto text-sm text-muted-foreground tabular-nums">
            {selected ? noteText(selected.content).length : 0} {t("quickNotes__characters")}
          </p>
        }
      >
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-md border md:grid-cols-[17rem_1fr]">
          <aside className="flex min-h-0 flex-col border-b md:border-e md:border-b-0">
            <div className="relative p-2">
              <Search className="pointer-events-none absolute start-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("quickNotes__search")}
                aria-label={t("quickNotes__search")}
                className="h-8 ps-8"
              />
            </div>
            <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 pt-0">
              {visible.length === 0 && (
                <li className="px-2 py-6 text-center text-sm text-muted-foreground">{t("quickNotes__no_results")}</li>
              )}
              {visible.map((note) => {
                const lines = noteText(note.content).split("\n");
                return (
                  <li key={note.id}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setSelectedId(note.id)}
                          aria-current={note.id === selectedId}
                          className={cn(
                            "w-full rounded-md px-3 py-2 text-start transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                            note.id === selectedId ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                          )}
                        >
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            {note.pinned && <Pin className="size-3 shrink-0 text-muted-foreground" />}
                            <span className="truncate">{lines[0] || t("quickNotes__untitled")}</span>
                          </span>
                          <span className="flex items-baseline gap-2 text-xs text-muted-foreground">
                            <span className="shrink-0 tabular-nums">{shortTime(note.updated_at)}</span>
                            <span className="truncate">{lines[1] || t("quickNotes__no_text")}</span>
                          </span>
                        </button>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem onSelect={createNote}>
                          <SquarePlus />
                          {t("quickNotes__new")}
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => setSelectedId(quickNotes.duplicate(note.id)?.id ?? note.id)}>
                          <FilePlus />
                          {t("quickNotes__duplicate")}
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => quickNotes.togglePin(note.id)}>
                          {note.pinned ? <PinOff /> : <Pin />}
                          {note.pinned ? t("quickNotes__unpin") : t("quickNotes__pin")}
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => void copyNote(note)}>
                          <Copy />
                          {t("quickNotes__copy")}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem variant="destructive" onSelect={() => setPendingDelete(note)}>
                          <Trash2 />
                          {t("quickNotes__delete")}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="flex min-h-0 flex-col">
            {selected && (
              <>
                <p className="py-3 text-center text-xs text-muted-foreground">
                  {new Date(selected.updated_at).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}
                </p>
                <QuickNoteEditor key={selected.id} id={selected.id} initialContent={selected.content} />
              </>
            )}
          </section>
        </div>
      </ToolModal>
      <ConfirmModal
        show={pendingDelete !== null}
        title={t("quickNotes__delete")}
        message={t("quickNotes__delete_confirm")}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
