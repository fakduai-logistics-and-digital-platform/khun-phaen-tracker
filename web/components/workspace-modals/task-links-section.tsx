"use client";

import { useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import { LinkPreview } from "@/components/shared/link-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TaskLinksSection({
  links,
  isOwner,
  onLinksChange,
}: {
  links: string[];
  isOwner: boolean;
  onLinksChange: (links: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addLink() {
    const url = draft.trim();
    if (!url) return;
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    if (!links.includes(withProtocol)) onLinksChange([...links, withProtocol]);
    setDraft("");
  }

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-3 flex items-center gap-2">
        <LinkIcon size={14} className="text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Links</span>
      </div>

      {links.length > 0 && (
        <div className="mb-3 space-y-2">
          {links.map((url) => (
            <LinkPreview
              key={url}
              url={url}
              readonly={!isOwner}
              onRemove={isOwner ? () => onLinksChange(links.filter((l) => l !== url)) : null}
            />
          ))}
        </div>
      )}

      {isOwner && (
        <div className="flex gap-2">
          <Input
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
            placeholder="วาง URL หรือ Figma link..."
            aria-label="Link URL"
          />
          <Button type="button" variant="secondary" onClick={addLink} disabled={!draft.trim()}>
            เพิ่ม
          </Button>
        </div>
      )}
    </div>
  );
}
