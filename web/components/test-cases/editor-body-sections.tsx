"use client";

import { FieldGroup } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n";
import { EditorTextField } from "./editor-fields";
import type { EditorForm } from "./editor-options";

type SectionProps = {
  form: EditorForm;
  setField: <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => void;
  isAuthorized: boolean;
};

export function EditorDetailsTab({ form, setField, isAuthorized }: SectionProps) {
  const { t } = useI18n();
  const readOnly = !isAuthorized;

  return (
    <FieldGroup>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <EditorTextField
          id="editor-preconditions"
          label={t("tcEditor__precondition")}
          value={form.preconditions}
          onChange={(v) => setField("preconditions", v)}
          readOnly={readOnly}
          placeholder={t("tcEditor__precondition_placeholder")}
        />
        <EditorTextField
          id="editor-postconditions"
          label={t("tcEditor__postcondition")}
          value={form.postconditions}
          onChange={(v) => setField("postconditions", v)}
          readOnly={readOnly}
          placeholder={t("tcEditor__postcondition_placeholder")}
        />
      </div>
      <EditorTextField
        id="editor-input"
        label={t("tcEditor__input")}
        value={form.input}
        onChange={(v) => setField("input", v)}
        readOnly={readOnly}
        placeholder={t("tcEditor__input_placeholder")}
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <EditorTextField
          id="editor-expected"
          label={t("tcEditor__expected_result")}
          value={form.expectedResult}
          onChange={(v) => setField("expectedResult", v)}
          readOnly={readOnly}
          placeholder={t("tcEditor__expected_placeholder")}
        />
        <EditorTextField
          id="editor-actual"
          label={t("tcEditor__actual_result")}
          value={form.actualResult}
          onChange={(v) => setField("actualResult", v)}
          readOnly={readOnly}
          placeholder={t("tcEditor__actual_placeholder")}
        />
      </div>
    </FieldGroup>
  );
}

export function EditorNotesTab({ form, setField, isAuthorized }: SectionProps) {
  const { t } = useI18n();

  return (
    <FieldGroup>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <EditorTextField
          id="editor-dev-note"
          label={t("tcEditor__dev_note")}
          value={form.devNote}
          onChange={(v) => setField("devNote", v)}
          placeholder={t("tcEditor__dev_note_placeholder")}
        />
        <EditorTextField
          id="editor-test-note"
          label={t("tcEditor__test_note")}
          value={form.testNote}
          onChange={(v) => setField("testNote", v)}
          readOnly={!isAuthorized}
          placeholder={t("tcEditor__test_note_placeholder")}
        />
      </div>
    </FieldGroup>
  );
}
