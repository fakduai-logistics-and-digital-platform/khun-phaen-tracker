"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { antigravityConfig, claudeCodeCommand, codexConfig } from "./api-key-guide";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard access can be denied; the text stays selectable. */
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={`${t("apiKeys__copy")}: ${label}`}
      onClick={() => void copy()}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

function CodeBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-start gap-2">
      <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
        {value}
      </pre>
      <CopyButton value={value} label={label} />
    </div>
  );
}

export function ConnectGuide({ apiKey, url }: { apiKey: string; url: string }) {
  const { t } = useI18n();
  return (
    <Tabs defaultValue="claude">
      <TabsList>
        <TabsTrigger value="claude">Claude Code</TabsTrigger>
        <TabsTrigger value="codex">Codex</TabsTrigger>
        <TabsTrigger value="antigravity">Antigravity</TabsTrigger>
      </TabsList>
      <TabsContent value="claude" className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("apiKeys__guide_claude")}</p>
        <CodeBlock value={claudeCodeCommand(apiKey, url)} label="Claude Code" />
      </TabsContent>
      <TabsContent value="codex" className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("apiKeys__guide_codex")}</p>
        <CodeBlock value={codexConfig(apiKey, url)} label="Codex" />
      </TabsContent>
      <TabsContent value="antigravity" className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("apiKeys__guide_antigravity")}</p>
        <CodeBlock value={antigravityConfig(apiKey, url)} label="Antigravity" />
      </TabsContent>
    </Tabs>
  );
}
