"use client";

import { PropertySelect } from "@/components/task-detail/property-select";
import { stepFormatOptions, type EditorForm } from "./editor-options";
import { TestCaseStepList } from "./test-case-step-list";

type EditorStepsSectionProps = {
  form: EditorForm;
  setField: <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => void;
  isAuthorized: boolean;
};

export function EditorStepsSection({ form, setField, isAuthorized }: EditorStepsSectionProps) {
  return (
    <section className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Test Case Steps</h2>
          <PropertySelect
            id="editor-step-format"
            value={form.stepFormat}
            options={stepFormatOptions}
            className="w-28"
            onSelect={(v) => setField("stepFormat", String(v) as EditorForm["stepFormat"])}
          />
        </div>
      </div>

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
    </section>
  );
}
