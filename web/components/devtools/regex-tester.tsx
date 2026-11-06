"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Info, Regex } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { ToolModal } from "./tool-modal";

const STORAGE_KEY = "regex-tester";

type HelpSection = { titleKey: string; rows: [string, string][] };

const COMMON_PATTERNS: { label?: string; labelKey?: string; pattern: string }[] = [
  { label: "Email", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
  { label: "URL", pattern: "https?://[\\w\\-]+(\\.[\\w\\-]+)+[\\w\\-.,@?^=%&:/~+#]*" },
  { labelKey: "regexTester__phone_th", pattern: "0[689]\\d{8}" },
  { label: "IPv4", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b" },
  { label: "Date (YYYY-MM-DD)", pattern: "\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])" },
  { label: "HTML Tag", pattern: "<\\/?[a-zA-Z][\\w\\-]*(?:\\s[^>]*)?\\/?>" },
];

const FLAG_OPTIONS = [
  { flag: "g", labelKey: "regexTester__flag_global" },
  { flag: "i", labelKey: "regexTester__flag_ignore_case" },
  { flag: "m", labelKey: "regexTester__flag_multiline" },
  { flag: "s", labelKey: "regexTester__flag_dotall" },
  { flag: "u", labelKey: "regexTester__flag_unicode" },
];

const HELP_LEFT: HelpSection[] = [
  {
    titleKey: "regexTester__help_special",
    rows: [
      [".", "regexTester__help_special_dot"],
      ["\\d", "regexTester__help_special_digit"],
      ["\\w", "regexTester__help_special_word"],
      ["\\s", "regexTester__help_special_space"],
      ["\\b", "regexTester__help_special_boundary"],
      ["\\", "regexTester__help_special_escape"],
    ],
  },
  {
    titleKey: "regexTester__help_quantifiers",
    rows: [
      ["*", "regexTester__help_quantifiers_star"],
      ["+", "regexTester__help_quantifiers_plus"],
      ["?", "regexTester__help_quantifiers_optional"],
      ["{n}", "regexTester__help_quantifiers_exact"],
      ["{n,m}", "regexTester__help_quantifiers_range"],
    ],
  },
];

const HELP_RIGHT: HelpSection[] = [
  {
    titleKey: "regexTester__help_groups",
    rows: [
      ["[abc]", "regexTester__help_groups_set"],
      ["[a-z]", "regexTester__help_groups_az"],
      ["[^abc]", "regexTester__help_groups_negate"],
      ["(abc)", "regexTester__help_groups_capture"],
      ["(a|b)", "regexTester__help_groups_alt"],
      ["(?<name>)", "regexTester__help_groups_named"],
    ],
  },
  {
    titleKey: "regexTester__help_anchors",
    rows: [
      ["^", "regexTester__help_anchors_start"],
      ["$", "regexTester__help_anchors_end"],
    ],
  },
  {
    titleKey: "regexTester__help_flags",
    rows: [
      ["g", "regexTester__help_flags_g"],
      ["i", "regexTester__help_flags_i"],
      ["m", "regexTester__help_flags_m"],
    ],
  },
];

type MatchResult = { match: string; index: number; groups: Record<string, string> | undefined };
type Segment = { text: string; hit: boolean };

function computeMatches(pattern: string, flags: string, testString: string): { results: MatchResult[]; error: string } {
  if (!pattern || !testString) return { results: [], error: "" };
  try {
    const regex = new RegExp(pattern, flags);
    const results: MatchResult[] = [];
    let m: RegExpExecArray | null;
    if (flags.includes("g")) {
      while ((m = regex.exec(testString)) !== null) {
        results.push({ match: m[0], index: m.index, groups: m.groups });
        if (m[0].length === 0) regex.lastIndex++;
      }
    } else {
      m = regex.exec(testString);
      if (m) results.push({ match: m[0], index: m.index, groups: m.groups });
    }
    return { results, error: "" };
  } catch (e) {
    return { results: [], error: e instanceof Error ? e.message : String(e) };
  }
}

function computeSegments(pattern: string, flags: string, testString: string, error: string): Segment[] {
  if (!pattern || !testString || error) return [{ text: testString, hit: false }];
  try {
    const regex = flags.includes("g") ? new RegExp(pattern, flags) : new RegExp(pattern, `${flags}g`);
    const segments: Segment[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(testString)) !== null) {
      if (m.index > lastIndex) segments.push({ text: testString.slice(lastIndex, m.index), hit: false });
      segments.push({ text: m[0], hit: true });
      lastIndex = m.index + m[0].length;
      if (m[0].length === 0) regex.lastIndex++;
    }
    if (lastIndex < testString.length) segments.push({ text: testString.slice(lastIndex), hit: false });
    return segments;
  } catch {
    return [{ text: testString, hit: false }];
  }
}

function loadStored() {
  if (typeof window === "undefined") return { pattern: "", flags: "g", testString: "" };
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      pattern: (data.pattern as string) || "",
      flags: (data.flags as string) || "g",
      testString: (data.testString as string) || "",
    };
  } catch {
    return { pattern: "", flags: "g", testString: "" };
  }
}

function HelpColumn({ sections }: { sections: HelpSection[] }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      {sections.map((section) => (
        <div key={section.titleKey} className="flex flex-col gap-1">
          <p className="text-sm font-medium">{t(section.titleKey)}</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {section.rows.map(([token, descKey]) => (
              <div key={token} className="contents">
                <code className="font-mono text-primary">{token}</code>
                <span className="text-muted-foreground">{t(descKey)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RegexTester({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [stored] = useState(loadStored);
  const [pattern, setPattern] = useState(stored.pattern);
  const [flags, setFlags] = useState(stored.flags);
  const [testString, setTestString] = useState(stored.testString);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const { results: matches, error } = useMemo(
    () => computeMatches(pattern, flags, testString),
    [pattern, flags, testString],
  );
  const segments = useMemo(
    () => computeSegments(pattern, flags, testString, error),
    [pattern, flags, testString, error],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pattern, flags, testString }));
  }, [pattern, flags, testString]);

  function handleCopy() {
    navigator.clipboard.writeText(`/${pattern}/${flags}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleFlag(flag: string) {
    setFlags((f) => (f.includes(flag) ? f.replace(flag, "") : f + flag));
  }

  const copyLabel = t("regexTester__copy");

  return (
    <ToolModal
      onClose={onClose}
      title={t("regexTester__title")}
      subtitle={t("regexTester__subtitle")}
      icon={Regex}
      bodyClassName="gap-4"
      headerActions={
        <>
          <Button
            type="button"
            variant={showHelp ? "secondary" : "ghost"}
            size="icon"
            aria-label={t("regexTester__help_aria")}
            aria-pressed={showHelp}
            onClick={() => setShowHelp((v) => !v)}
          >
            <Info />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label={copyLabel} onClick={handleCopy}>
            {copied ? <Check className="text-success" /> : <Copy />}
          </Button>
        </>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-4 text-sm text-muted-foreground">
          <Badge variant={error ? "destructive" : matches.length > 0 ? "default" : "secondary"}>
            {error ? t("regexTester__error") : `${matches.length} ${t("regexTester__matches_found")}`}
          </Badge>
          <span className="truncate font-mono">
            /{pattern || "..."}/{flags}
          </span>
        </div>
      }
    >
      {showHelp && (
        <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4">
          <h4 className="text-sm font-medium">{t("regexTester__help_title")}</h4>
          <div className="grid grid-cols-2 gap-6">
            <HelpColumn sections={HELP_LEFT} />
            <HelpColumn sections={HELP_RIGHT} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="regex-pattern">{t("regexTester__pattern")}</Label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-base text-muted-foreground">/</span>
          <Input
            id="regex-pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="font-mono"
            placeholder={t("regexTester__pattern_placeholder")}
          />
          <span className="font-mono text-base text-muted-foreground">/</span>
          <Input
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            aria-label={t("regexTester__flags_aria")}
            className="w-20 font-mono"
            placeholder="g"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FLAG_OPTIONS.map((f) => (
            <Button
              key={f.flag}
              type="button"
              size="sm"
              variant={flags.includes(f.flag) ? "secondary" : "outline"}
              aria-pressed={flags.includes(f.flag)}
              onClick={() => toggleFlag(f.flag)}
            >
              {f.flag} — {t(f.labelKey)}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 px-3 py-2 font-mono text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("regexTester__common")}</p>
        <div className="flex flex-wrap gap-2">
          {COMMON_PATTERNS.map((p) => (
            <Button key={p.pattern} type="button" size="sm" variant="outline" onClick={() => setPattern(p.pattern)}>
              {p.labelKey ? t(p.labelKey) : p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="regex-test-string">{t("regexTester__test_string")}</Label>
        <Textarea
          id="regex-test-string"
          value={testString}
          onChange={(e) => setTestString(e.target.value)}
          rows={5}
          spellCheck={false}
          className="font-mono text-sm"
          placeholder={t("regexTester__test_placeholder")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("regexTester__result")}</p>
        <div className="min-h-20 whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 font-mono text-sm">
          {segments.length === 0 || (segments.length === 1 && segments[0].text === "") ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            segments.map((seg, i) =>
              seg.hit ? (
                <mark key={i} className="rounded-sm bg-primary px-0.5 text-primary-foreground">
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )
          )}
        </div>
      </div>

      {matches.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {t("regexTester__matches")} ({matches.length})
          </p>
          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
            {matches.map((m, i) => (
              <div key={`${m.index}-${i}`} className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
                <Badge variant="secondary">#{i + 1}</Badge>
                <code className="flex-1 truncate font-mono text-sm">&quot;{m.match}&quot;</code>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {t("regexTester__match_index", { index: m.index })}
                </span>
                {m.groups && Object.keys(m.groups).length > 0 && (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {t("regexTester__match_groups", { groups: JSON.stringify(m.groups) })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </ToolModal>
  );
}
