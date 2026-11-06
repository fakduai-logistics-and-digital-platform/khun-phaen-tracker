"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Check, Copy, GitCompare, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RichText } from "./rich-text";
import { ToolModal } from "./tool-modal";

type DiffLine = { type: "same" | "add" | "remove" | "change"; left: string; right: string; lineNum: number };

function buildLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) i--;
    else j--;
  }
  return result;
}

function computeDiff(leftText: string, rightText: string): DiffLine[] {
  if (!leftText && !rightText) return [];
  const leftLines = leftText.split("\n");
  const rightLines = rightText.split("\n");
  const result: DiffLine[] = [];
  const lcs = buildLCS(leftLines, rightLines);
  let li = 0;
  let ri = 0;
  let oi = 0;

  while (oi < lcs.length || li < leftLines.length || ri < rightLines.length) {
    const lcsLine = oi < lcs.length ? lcs[oi] : null;
    const leftLine = li < leftLines.length ? leftLines[li] : null;
    const rightLine = ri < rightLines.length ? rightLines[ri] : null;

    if (lcsLine !== null && leftLine === lcsLine && rightLine === lcsLine) {
      result.push({ type: "same", left: leftLine, right: rightLine, lineNum: li + 1 });
      li++;
      ri++;
      oi++;
    } else if (lcsLine !== null && rightLine === lcsLine) {
      result.push({ type: "remove", left: leftLine || "", right: "", lineNum: li + 1 });
      li++;
    } else if (lcsLine !== null && leftLine === lcsLine) {
      result.push({ type: "add", left: "", right: rightLine || "", lineNum: ri + 1 });
      ri++;
    } else if (leftLine !== null && rightLine !== null && leftLine !== rightLine) {
      result.push({ type: "change", left: leftLine, right: rightLine, lineNum: li + 1 });
      li++;
      ri++;
    } else if (leftLine !== null) {
      result.push({ type: "remove", left: leftLine, right: "", lineNum: li + 1 });
      li++;
    } else if (rightLine !== null) {
      result.push({ type: "add", left: "", right: rightLine, lineNum: ri + 1 });
      ri++;
    } else {
      break;
    }
  }
  return result;
}

function readStored(key: string) {
  return typeof window === "undefined" ? "" : (localStorage.getItem(key) ?? "");
}

const ROW_TONE = {
  same: { row: "text-muted-foreground", sign: "text-muted-foreground" },
  remove: { row: "bg-destructive/10 text-destructive", sign: "text-destructive" },
  add: { row: "bg-success/10 text-success", sign: "text-success" },
} as const;

function Row({ tone, num, sign, text }: { tone: keyof typeof ROW_TONE; num?: number; sign: string; text: string }) {
  return (
    <div className={cn("flex px-3", ROW_TONE[tone].row)}>
      <span className="w-10 shrink-0 select-none pe-2 text-end text-xs leading-6 opacity-60">{num}</span>
      <span className={cn("w-4 shrink-0 select-none font-medium", ROW_TONE[tone].sign)}>{sign}</span>
      <span className="whitespace-pre-wrap break-all">{text}</span>
    </div>
  );
}

function PaneInput({
  label,
  onLabelChange,
  value,
  onValueChange,
  placeholder,
}: {
  label: string;
  onLabelChange: (v: string) => void;
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <Input
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        aria-label={t("diffChecker__label")}
        className="h-8 font-medium"
        placeholder={t("diffChecker__label_placeholder")}
      />
      <Textarea
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="min-h-0 flex-1 resize-none font-mono text-sm field-sizing-fixed"
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  );
}

export function DiffChecker({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [leftText, setLeftText] = useState(() => readStored("diff-left"));
  const [rightText, setRightText] = useState(() => readStored("diff-right"));
  const [leftLabel, setLeftLabel] = useState(() => t("diffChecker__left"));
  const [rightLabel, setRightLabel] = useState(() => t("diffChecker__right"));
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const diffResult = useMemo(() => computeDiff(leftText, rightText), [leftText, rightText]);
  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    let changed = 0;
    for (const d of diffResult) {
      if (d.type === "add") added++;
      else if (d.type === "remove") removed++;
      else if (d.type === "change") changed++;
    }
    return { added, removed, changed, same: diffResult.length - added - removed - changed };
  }, [diffResult]);

  useEffect(() => localStorage.setItem("diff-left", leftText), [leftText]);
  useEffect(() => localStorage.setItem("diff-right", rightText), [rightText]);

  function handleCopy() {
    const text = diffResult
      .map((d) => {
        if (d.type === "add") return `+ ${d.right}`;
        if (d.type === "remove") return `- ${d.left}`;
        if (d.type === "change") return `- ${d.left}\n+ ${d.right}`;
        return `  ${d.left}`;
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function swapTexts() {
    setLeftText(rightText);
    setRightText(leftText);
    setLeftLabel(rightLabel);
    setRightLabel(leftLabel);
  }

  const legend = [
    { color: "bg-success", text: t("diffChecker__legend_added", { count: stats.added }) },
    { color: "bg-destructive", text: t("diffChecker__legend_removed", { count: stats.removed }) },
    { color: "bg-primary", text: t("diffChecker__legend_changed", { count: stats.changed }) },
    { color: "bg-muted-foreground/40", text: t("diffChecker__legend_same", { count: stats.same }) },
  ];

  return (
    <ToolModal
      onClose={onClose}
      title={t("diffChecker__title")}
      subtitle={t("diffChecker__subtitle")}
      icon={GitCompare}
      bodyClassName="gap-4"
      headerActions={
        <>
          <Button
            type="button"
            variant={showHelp ? "secondary" : "ghost"}
            size="icon"
            aria-label={t("diffChecker__how_to_use")}
            aria-pressed={showHelp}
            onClick={() => setShowHelp((v) => !v)}
          >
            <Info />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("diffChecker__copy_diff")}
            onClick={handleCopy}
          >
            {copied ? <Check className="text-success" /> : <Copy />}
          </Button>
        </>
      }
    >
      {showHelp && (
        <div className="flex shrink-0 flex-col gap-2 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t("diffChecker__help_title")}</p>
          <ul className="list-disc space-y-1 ps-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <li key={n}>
                <RichText text={t(`diffChecker__help_${n}`)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-4">
        {legend.map((item) => (
          <div key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={cn("size-2.5 rounded-sm", item.color)} />
            {item.text}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ms-auto"
          aria-label={t("diffChecker__swap")}
          onClick={swapTexts}
        >
          <ArrowRightLeft />
        </Button>
      </div>

      <div className="grid min-h-48 flex-1 grid-cols-2 gap-4">
        <PaneInput
          label={leftLabel}
          onLabelChange={setLeftLabel}
          value={leftText}
          onValueChange={setLeftText}
          placeholder={t("diffChecker__paste_left")}
        />
        <PaneInput
          label={rightLabel}
          onLabelChange={setRightLabel}
          value={rightText}
          onValueChange={setRightText}
          placeholder={t("diffChecker__paste_right")}
        />
      </div>

      {diffResult.length > 0 && (
        <div className="max-h-72 shrink-0 overflow-y-auto rounded-md border">
          <p className="sticky top-0 border-b bg-muted px-3 py-2 text-sm font-medium">{t("diffChecker__result")}</p>
          <div className="font-mono text-sm leading-6">
            {diffResult.map((d, i) => {
              if (d.type === "same") return <Row key={i} tone="same" num={d.lineNum} sign=" " text={d.left} />;
              if (d.type === "remove") return <Row key={i} tone="remove" num={d.lineNum} sign="-" text={d.left} />;
              if (d.type === "add") return <Row key={i} tone="add" num={d.lineNum} sign="+" text={d.right} />;
              return (
                <div key={i}>
                  <Row tone="remove" num={d.lineNum} sign="-" text={d.left} />
                  <Row tone="add" sign="+" text={d.right} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ToolModal>
  );
}
