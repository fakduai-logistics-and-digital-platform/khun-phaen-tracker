"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, FileCheck, Plus } from "lucide-react";
import { LinkPreview } from "@/components/shared/link-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SECTION_TITLE = "flex items-center gap-2 text-sm font-semibold text-foreground/80";

interface TaskLinksProps {
  links: string[];
  onChange: (links: string[]) => void;
}

export function TaskLinks({ links, onChange }: TaskLinksProps) {
  const [input, setInput] = useState("");

  function add() {
    const url = input.trim();
    if (!url) return;
    setInput("");
    onChange([...links, url]);
  }

  return (
    <div className="space-y-3">
      <div className={SECTION_TITLE}>
        <ExternalLink size={15} />
        <span>Links</span>
      </div>

      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) => (
            <LinkPreview
              key={link}
              url={link}
              readonly={false}
              onRemove={() => onChange(links.filter((l) => l !== link))}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          type="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="วาง URL ที่นี่..."
          aria-label="Link URL"
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1 text-sm"
        />
        <Button type="button" onClick={add} disabled={!input.trim()} aria-label="Add link">
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}

interface RelatedTestCaseProps {
  href: string;
  testcaseId: string;
}

export function RelatedTestCase({ href, testcaseId }: RelatedTestCaseProps) {
  return (
    <div className="space-y-3">
      <div className={SECTION_TITLE}>
        <FileCheck size={15} />
        <span>Related Test Case</span>
      </div>
      <Link
        href={href}
        className="group flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 transition-colors hover:bg-accent"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/10">
            <FileCheck size={16} className="text-success" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">View Test Case</span>
            <span className="truncate text-xs text-muted-foreground">ID: {testcaseId}</span>
          </div>
        </div>
        <ExternalLink
          size={14}
          className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        />
      </Link>
    </div>
  );
}
