"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import type { EditorForm } from "./editor-options";
import { TestCaseStepList } from "./test-case-step-list";

type EditorStepsSectionProps = {
  form: EditorForm;
  setField: <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => void;
  isAuthorized: boolean;
};

export function EditorStepsSection({ form, setField, isAuthorized }: EditorStepsSectionProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={form.stepFormat} onValueChange={(v) => setField("stepFormat", v as EditorForm["stepFormat"])}>
        <TabsList className="h-8 w-fit">
          <TabsTrigger value="classic" className="px-3 text-xs">
            {t("tcEditor__format_classic")}
          </TabsTrigger>
          <TabsTrigger value="gherkin" className="px-3 text-xs">
            Gherkin
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {form.stepFormat === "classic" ? (
        <TestCaseStepList
          steps={form.classicSteps}
          onStepsChange={(steps) => setField("classicSteps", steps)}
          format="classic"
          readOnly={!isAuthorized}
        />
      ) : (
        <TestCaseStepList
          steps={form.gherkinSteps}
          onStepsChange={(steps) => setField("gherkinSteps", steps)}
          format="gherkin"
          readOnly={!isAuthorized}
          gherkinView={form.gherkinView}
          onGherkinViewChange={(view) => setField("gherkinView", view)}
          gherkinRaw={form.gherkinRaw}
          onGherkinRawChange={(raw) => setField("gherkinRaw", raw)}
        />
      )}
    </div>
  );
}
