"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type GherkinKeyword = "given" | "when" | "then" | "and";
export type GherkinStep = { keyword: GherkinKeyword; text: string };
export type ClassicStep = { action: string; data: string; expected: string };
type AnyStep = Record<string, any>;

type TestCaseStepListProps = {
  steps: any[];
  onStepsChange?: (steps: any[]) => void;
  format?: "classic" | "gherkin";
  readOnly?: boolean;
  gherkinView?: "raw" | "steps";
  onGherkinViewChange?: (view: "raw" | "steps") => void;
  gherkinRaw?: string;
  onGherkinRawChange?: (raw: string) => void;
};

const GHERKIN_KEYWORDS = ["given", "when", "then", "and"];

const gherkinKeywordOptions = [
  { value: "given", label: "Given" },
  { value: "when", label: "When" },
  { value: "then", label: "Then" },
  { value: "and", label: "And" },
];

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightGherkin(text: string) {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(/^(\s*)(Given|When|Then|And)\b(.*)/i);
      if (match) {
        return `${match[1]}<span class="text-sky-500 font-bold">${match[2]}</span><span class="text-foreground">${escapeHtml(match[3])}</span>`;
      }
      return `<span class="text-foreground">${escapeHtml(line)}</span>`;
    })
    .join("<br>");
}

function stepsToRaw(steps: AnyStep[]) {
  return steps
    .filter((s) => s.text?.trim() || s.keyword)
    .map((s) => `${s.keyword.charAt(0).toUpperCase() + s.keyword.slice(1)} ${s.text}`)
    .join("\n");
}

function rawToSteps(raw: string): GherkinStep[] {
  const parsed = raw
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line): GherkinStep => {
      const trimmed = line.trim();
      const firstSpace = trimmed.indexOf(" ");
      if (firstSpace !== -1) {
        const firstWord = trimmed.substring(0, firstSpace).toLowerCase();
        if (GHERKIN_KEYWORDS.includes(firstWord)) {
          return { keyword: firstWord as GherkinKeyword, text: trimmed.substring(firstSpace + 1) };
        }
      }
      return { keyword: "given", text: trimmed };
    });
  return parsed.length > 0 ? parsed : [{ keyword: "given", text: "" }];
}

export function TestCaseStepList({
  steps,
  onStepsChange,
  format = "classic",
  readOnly = false,
  gherkinView = "steps",
  onGherkinViewChange,
  gherkinRaw = "",
  onGherkinRawChange,
}: TestCaseStepListProps) {
  const { t } = useI18n();

  const emit = (next: any[]) => onStepsChange?.(next);
  const updateStep = (index: number, patch: AnyStep) =>
    emit(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  const removeStep = (index: number) => emit(steps.filter((_, i) => i !== index));

  function addStep() {
    if (format === "classic") {
      emit([...steps, { action: "", data: "", expected: "" }]);
      return;
    }
    const keyword = steps.length % 3 === 0 ? "given" : steps.length % 3 === 1 ? "when" : "then";
    emit([...steps, { keyword, text: "" }]);
  }

  function showRaw() {
    onGherkinViewChange?.("raw");
    onGherkinRawChange?.(stepsToRaw(steps));
  }

  function showSteps() {
    onGherkinViewChange?.("steps");
    emit(rawToSteps(gherkinRaw));
  }

  const deleteButton = (index: number) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-destructive"
      title={t("tcEditor__delete_step")}
      aria-label={t("tcEditor__delete_step")}
      onClick={() => removeStep(index)}
    >
      <Trash2 size={15} />
    </Button>
  );

  return (
    <div className="space-y-5">
      {format === "gherkin" && !readOnly && (
        <div className="flex items-center justify-end gap-4 text-xs font-medium">
          <button
            type="button"
            className={cn(
              "transition-colors hover:text-foreground",
              gherkinView === "raw" ? "text-primary" : "text-muted-foreground",
            )}
            onClick={showRaw}
          >
            {t("tcEditor__view_raw")}
          </button>
          <button
            type="button"
            className={cn(
              "transition-colors hover:text-foreground",
              gherkinView === "steps" ? "text-primary" : "text-muted-foreground",
            )}
            onClick={showSteps}
          >
            {t("tcEditor__view_steps")}
          </button>
        </div>
      )}

      {format === "classic" &&
        steps.map((step, index) => (
          <div
            key={index}
            className="grid gap-3"
            style={{
              gridTemplateColumns: readOnly
                ? "28px minmax(0,1fr) 76px"
                : "28px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 72px",
            }}
          >
            <div className="pt-2 text-center text-sm font-medium text-muted-foreground">{index + 1}</div>

            {readOnly ? (
              <div className="space-y-2 py-1">
                <div className="text-sm font-medium text-foreground">{step.action || t("tcEditor__no_action")}</div>
                {step.data && (
                  <div className="text-xs font-medium text-muted-foreground">
                    <span className="mr-1 font-medium">{t("tcEditor__step_data")}:</span>
                    {step.data}
                  </div>
                )}
                {step.expected && (
                  <div className="text-xs font-medium text-muted-foreground">
                    <span className="mr-1 font-medium">{t("tcEditor__step_expected")}:</span>
                    {step.expected}
                  </div>
                )}
              </div>
            ) : (
              <>
                <Textarea
                  value={step.action ?? ""}
                  onChange={(e) => updateStep(index, { action: e.target.value })}
                  className="min-h-9 resize-none"
                  placeholder={t("tcEditor__step_action")}
                />
                <Textarea
                  value={step.data ?? ""}
                  onChange={(e) => updateStep(index, { data: e.target.value })}
                  className="min-h-9 resize-none"
                  placeholder={t("tcEditor__step_data")}
                />
                <Textarea
                  value={step.expected ?? ""}
                  onChange={(e) => updateStep(index, { expected: e.target.value })}
                  className="min-h-9 resize-none"
                  placeholder={t("tcEditor__expected_result")}
                />
              </>
            )}

            <div className="flex items-start gap-2 pt-1">{!readOnly && deleteButton(index)}</div>
          </div>
        ))}

      {format !== "classic" && gherkinView === "raw" && !readOnly && (
        <div className="relative min-h-40 w-full rounded-xl border border-input bg-muted/40 font-mono text-sm font-medium leading-6 shadow-sm">
          <div
            className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-4 py-3"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlightGherkin(gherkinRaw) || " " }}
          />
          <Textarea
            value={gherkinRaw}
            onChange={(e) => onGherkinRawChange?.(e.target.value)}
            className="relative m-0 h-full min-h-40 resize-none border-0 bg-transparent px-4 py-3 text-transparent caret-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
            spellCheck={false}
            placeholder={t("tcEditor__gherkin_placeholder")}
          />
        </div>
      )}

      {format !== "classic" &&
        !(gherkinView === "raw" && !readOnly) &&
        steps.map((step, index) => (
          <div
            key={index}
            className="grid items-center gap-3"
            style={{
              gridTemplateColumns: readOnly ? "28px minmax(0,1fr) 76px" : "28px 104px minmax(0,1fr) 32px",
            }}
          >
            <div className="text-center text-sm font-medium text-muted-foreground">{index + 1}</div>

            {readOnly ? (
              <div className="py-2 text-sm font-medium text-foreground">
                <span className="mr-2 font-medium text-primary">{step.keyword}</span>
                {step.text || t("tcEditor__no_text")}
              </div>
            ) : (
              <>
                <Select value={step.keyword} onValueChange={(value) => updateStep(index, { keyword: value })}>
                  <SelectTrigger id={`step-keyword-${index}`} className="w-full" aria-label={t("tcEditor__keyword")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gherkinKeywordOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={step.text ?? ""}
                  onChange={(e) => updateStep(index, { text: e.target.value })}
                  placeholder={t("tcEditor__write_step")}
                />
              </>
            )}

            <div className="flex items-center gap-2">{!readOnly && deleteButton(index)}</div>
          </div>
        ))}

      {!readOnly && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" className="font-medium" onClick={addStep}>
            <Plus size={15} />
            {t("testCases__add_step")}
          </Button>
        </div>
      )}
    </div>
  );
}
