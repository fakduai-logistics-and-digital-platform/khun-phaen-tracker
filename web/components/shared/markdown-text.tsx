"use client";

import { Fragment, type ReactNode } from "react";
import { marked, type Token, type Tokens } from "marked";
import type { Assignee } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  findMentioned,
  MentionHoverCard,
} from "@/components/task-detail/mentions";

const SAFE_HREF = /^(https?:|mailto:)/i;
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** marked keeps text tokens HTML-escaped for its own renderer; React escapes on its own, so undo it. */
const decode = (text: string) =>
  text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity]);

type Context = { pattern: RegExp | null; assignees: Assignee[] };

function MentionText({ text, ctx }: { text: string; ctx: Context }) {
  if (!ctx.pattern) return <>{text}</>;
  return (
    <>
      {text.split(ctx.pattern).map((part, i) =>
        i % 2 === 1 ? (
          <MentionHoverCard
            key={i}
            assignee={findMentioned(part, ctx.assignees)}
          >
            <span className="rounded bg-primary/10 px-1 font-medium text-primary">
              {part}
            </span>
          </MentionHoverCard>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function inline(tokens: Token[] | undefined, ctx: Context): ReactNode[] {
  return (tokens ?? []).map((token, i) => {
    switch (token.type) {
      case "text": {
        const t = token as Tokens.Text;
        return t.tokens ? (
          <Fragment key={i}>{inline(t.tokens, ctx)}</Fragment>
        ) : (
          <MentionText key={i} text={decode(t.text)} ctx={ctx} />
        );
      }
      case "escape":
        return (
          <Fragment key={i}>{decode((token as Tokens.Escape).text)}</Fragment>
        );
      case "strong":
        return (
          <strong key={i}>
            {inline((token as Tokens.Strong).tokens, ctx)}
          </strong>
        );
      case "em":
        return <em key={i}>{inline((token as Tokens.Em).tokens, ctx)}</em>;
      case "del":
        return <del key={i}>{inline((token as Tokens.Del).tokens, ctx)}</del>;
      case "codespan":
        return (
          <code
            key={i}
            className="rounded bg-muted px-1 font-mono text-[0.9em]"
          >
            {decode((token as Tokens.Codespan).text)}
          </code>
        );
      case "br":
        return <br key={i} />;
      case "link": {
        const link = token as Tokens.Link;
        if (!SAFE_HREF.test(link.href))
          return <Fragment key={i}>{inline(link.tokens, ctx)}</Fragment>;
        return (
          <a
            key={i}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-2 hover:opacity-80"
          >
            {inline(link.tokens, ctx)}
          </a>
        );
      }
      default:
        // Raw HTML and images are shown as the text that was typed, never rendered.
        return <Fragment key={i}>{decode(token.raw)}</Fragment>;
    }
  });
}

function blocks(tokens: Token[], ctx: Context): ReactNode[] {
  return tokens.map((token, i) => {
    switch (token.type) {
      case "space":
        return null;
      case "paragraph":
        return <p key={i}>{inline((token as Tokens.Paragraph).tokens, ctx)}</p>;
      case "text": {
        const t = token as Tokens.Text;
        return (
          <p key={i}>{t.tokens ? inline(t.tokens, ctx) : decode(t.text)}</p>
        );
      }
      case "heading":
        return (
          <p key={i} className="font-semibold">
            {inline((token as Tokens.Heading).tokens, ctx)}
          </p>
        );
      case "list": {
        const list = token as Tokens.List;
        const Tag = list.ordered ? "ol" : "ul";
        return (
          <Tag
            key={i}
            className={list.ordered ? "list-decimal ps-5" : "list-disc ps-5"}
          >
            {list.items.map((item, j) => (
              <li key={j}>{blocks(item.tokens, ctx)}</li>
            ))}
          </Tag>
        );
      }
      case "blockquote":
        return (
          <blockquote key={i} className="border-s-2 ps-3 text-muted-foreground">
            {blocks((token as Tokens.Blockquote).tokens, ctx)}
          </blockquote>
        );
      case "hr":
        return <hr key={i} className="my-1" />;
      case "code":
        return (
          <pre key={i} className="overflow-x-auto rounded bg-muted p-2 text-xs">
            <code>{decode((token as Tokens.Code).text)}</code>
          </pre>
        );
      default:
        return <p key={i}>{decode(token.raw)}</p>;
    }
  });
}

/** Markdown is rendered through React nodes only, so nothing typed can inject HTML. Mentions are optional. */
export function MarkdownText({
  text,
  pattern = null,
  assignees = [],
  className,
}: {
  text: string;
  pattern?: RegExp | null;
  assignees?: Assignee[];
  className?: string;
}) {
  const tokens = marked.lexer(text, { gfm: true, breaks: true });
  return (
    <div
      className={cn(
        "flex flex-col gap-2 break-words [&_li>p]:inline",
        className,
      )}
    >
      {blocks(tokens, { pattern, assignees })}
    </div>
  );
}
