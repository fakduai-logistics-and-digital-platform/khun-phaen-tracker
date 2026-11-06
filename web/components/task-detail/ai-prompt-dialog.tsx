"use client";

import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Bot, Check, ChevronDown, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  AI_PROVIDERS,
  buildAiPrompt,
  loadPreferredProvider,
  savePreferredProvider,
  type AiMode,
  type AiProvider,
  type PromptLang,
} from "./ai-prompt";

interface AiPromptDialogProps {
  mode: AiMode;
  task: { title?: string; notes?: string };
  onClose: () => void;
}

export function AiPromptDialog({ mode, task, onClose }: AiPromptDialogProps) {
  const [lang, setLang] = useState<PromptLang>("th");
  const [draft, setDraft] = useState(() => buildAiPrompt(task, mode.id, "th"));
  const [provider, setProvider] = useState<AiProvider>(loadPreferredProvider);
  const [copied, setCopied] = useState(false);

  function switchLang(next: PromptLang) {
    setLang(next);
    setDraft(buildAiPrompt(task, mode.id, next));
  }

  function selectProvider(next: AiProvider) {
    setProvider(next);
    savePreferredProvider(next.id);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function send() {
    if (!provider.supportsQuery) {
      await navigator.clipboard.writeText(draft);
      toast.success(`คัดลอก prompt แล้ว กำลังเปิด ${provider.name}...`);
    }
    window.open(provider.buildUrl(encodeURIComponent(draft)), "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="flex max-h-[80vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogDescription className="sr-only">{mode.desc}</DialogDescription>
        <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-muted-foreground" />
            <DialogTitle className="text-xs font-semibold">ถาม AI — {mode.label}</DialogTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => void copyPrompt()}
              className={cn(copied && "text-success")}
              aria-label="คัดลอก prompt"
              title="คัดลอก prompt"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="ปิด">
              <X size={13} />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5 overflow-hidden px-3 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">แก้ไข prompt ก่อนส่งได้เลย</p>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
              {(["th", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => switchLang(code)}
                  aria-pressed={lang === code}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                    lang === code
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            aria-label="Prompt"
            className="min-h-70 w-full flex-1 resize-none rounded-lg border bg-transparent px-3 py-2.5 text-xs text-foreground outline-none transition-colors focus:border-ring"
          />
        </div>

        <div className="flex shrink-0 items-center justify-between border-t px-3 py-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs">
                <Bot size={12} />
                <span>{provider.name}</span>
                <ChevronDown size={11} className="opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="max-h-80 w-44">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">เลือก AI</DropdownMenuLabel>
              {AI_PROVIDERS.map((item, i) => (
                <Fragment key={item.id}>
                  {i > 0 && AI_PROVIDERS[i - 1].supportsQuery && !item.supportsQuery && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="py-1 text-xs font-medium text-muted-foreground/70">
                        auto-copy
                      </DropdownMenuLabel>
                    </>
                  )}
                  <DropdownMenuItem onSelect={() => selectProvider(item)} className="justify-between">
                    <span>{item.name}</span>
                    {provider.id === item.id && <Check size={12} />}
                  </DropdownMenuItem>
                </Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void send()}
              className="gap-2 font-semibold"
            >
              <Bot size={13} />
              เปิด {provider.name}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
