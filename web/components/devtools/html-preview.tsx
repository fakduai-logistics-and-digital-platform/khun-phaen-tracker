"use client";

import { useEffect, useState } from "react";
import { Check, Code2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { ToolModal } from "./tool-modal";

const STORAGE_KEY = "html-preview-code";

export function HtmlPreview({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCode(localStorage.getItem(STORAGE_KEY) ?? "");
  }, []);

  function handleCodeChange(value: string) {
    setCode(value);
    localStorage.setItem(STORAGE_KEY, value);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const codeLabel = t("htmlPreview__tab_code");
  const previewLabel = t("htmlPreview__tab_preview");

  return (
    <ToolModal
      onClose={onClose}
      title={t("htmlPreview__title")}
      subtitle={t("htmlPreview__subtitle")}
      icon={Code2}
      headerActions={
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void handleCopy()}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {t("htmlPreview__copy")}
        </Button>
      }
      bodyClassName="md:flex-row gap-4"
      footer={
        <p className="me-auto text-sm text-muted-foreground tabular-nums">
          {code.length} {t("htmlPreview__characters")} · {code ? code.split("\n").length : 0} {t("htmlPreview__lines")}
        </p>
      }
    >
      <div className="flex min-h-48 flex-1 flex-col gap-2">
        <Label htmlFor="html-preview-code">{codeLabel}</Label>
        <Textarea
          id="html-preview-code"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder={t("htmlPreview__placeholder")}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none font-mono"
        />
      </div>
      <div className="flex min-h-48 flex-1 flex-col gap-2">
        <Label>{previewLabel}</Label>
        <iframe
          srcDoc={code}
          title={previewLabel}
          sandbox="allow-scripts"
          className="min-h-0 flex-1 rounded-md border bg-white"
        />
      </div>
    </ToolModal>
  );
}
