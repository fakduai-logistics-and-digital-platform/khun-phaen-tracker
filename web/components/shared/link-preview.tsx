"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Link as LinkIcon, X } from "lucide-react";

type LinkPreviewProps = {
  url: string;
  readonly?: boolean;
  onRemove?: (() => void) | null;
};

type OEmbedData = {
  title?: string;
  thumbnail_url?: string;
  provider_name?: string;
};

function Figma({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.097-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h.098c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-.098z" />
    </svg>
  );
}

const FIGMA_PATTERN = /figma\.com\/(proto|design|file|board)\//i;

function getDisplayUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 40) + (u.pathname.length > 40 ? "…" : "");
  } catch {
    return url.slice(0, 50);
  }
}

export function LinkPreview({ url, readonly = false, onRemove = null }: LinkPreviewProps) {
  const isFigma = FIGMA_PATTERN.test(url);
  const displayUrl = getDisplayUrl(url);
  const [oEmbed, setOEmbed] = useState<OEmbedData | null>(null);
  const [loading, setLoading] = useState(isFigma);

  useEffect(() => {
    if (!isFigma) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setOEmbed(null);
    fetch(`https://www.figma.com/api/oembed?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setOEmbed(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, isFigma]);

  return (
    <div className="group relative flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-3 transition-colors hover:border-ring/50">
      {isFigma && oEmbed?.thumbnail_url && !loading ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-start gap-3">
          <img
            src={oEmbed.thumbnail_url}
            alt={oEmbed.title || "Figma preview"}
            className="h-14 w-20 shrink-0 rounded-lg border border-border bg-muted object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-1.5">
              <Figma size={12} className="shrink-0 text-[#F24E1E]" />
              <span className="text-[11px] font-medium text-[#F24E1E]">Figma</span>
            </div>
            <p className="truncate text-sm leading-snug font-medium text-foreground">{oEmbed.title || "Figma file"}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{displayUrl}</p>
          </div>
          <ExternalLink size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
        </a>
      ) : isFigma ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F24E1E]/10">
            <Figma size={18} className="text-[#F24E1E]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {loading ? "กำลังโหลด..." : oEmbed?.title || "Figma"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{displayUrl}</p>
          </div>
          <ExternalLink size={14} className="shrink-0 text-muted-foreground" />
        </a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <LinkIcon size={16} className="text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground/80">{displayUrl}</p>
          </div>
          <ExternalLink size={14} className="shrink-0 text-muted-foreground" />
        </a>
      )}

      {!readonly && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove link"
          className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}
