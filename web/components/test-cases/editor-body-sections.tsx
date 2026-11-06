"use client";

import { CheckCircle2, ClipboardCheck, Keyboard, MessageSquare, ShieldCheck, Target } from "lucide-react";
import { EditorTextField } from "./editor-fields";
import type { EditorForm } from "./editor-options";

type EditorBodySectionsProps = {
  form: EditorForm;
  setField: <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => void;
  isAuthorized: boolean;
};

export function EditorBodySections({ form, setField, isAuthorized }: EditorBodySectionsProps) {
  const readOnly = !isAuthorized;

  return (
    <>
      <section className="grid grid-cols-1 gap-5 border-t p-6 md:grid-cols-2">
        <EditorTextField
          label="Precondition"
          icon={ShieldCheck}
          value={form.preconditions}
          onChange={(v) => setField("preconditions", v)}
          readOnly={readOnly}
          placeholder="Conditions required before this test starts..."
        />
        <EditorTextField
          label="Post-conditions"
          icon={Target}
          value={form.postconditions}
          onChange={(v) => setField("postconditions", v)}
          readOnly={readOnly}
          placeholder="Expected state after this test finishes..."
        />
      </section>

      <section className="border-t p-6">
        <EditorTextField
          label="Input"
          icon={Keyboard}
          value={form.input}
          onChange={(v) => setField("input", v)}
          readOnly={readOnly}
          placeholder="Data that tester must enter..."
        />
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <EditorTextField
            label="Expected Result"
            icon={CheckCircle2}
            value={form.expectedResult}
            onChange={(v) => setField("expectedResult", v)}
            readOnly={readOnly}
            placeholder="Expected behavior after running the step..."
          />
          <EditorTextField
            label="Actual Result"
            icon={ClipboardCheck}
            value={form.actualResult}
            onChange={(v) => setField("actualResult", v)}
            readOnly={readOnly}
            placeholder="Actual behavior found during testing..."
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 border-t p-6 lg:grid-cols-2">
        <EditorTextField
          label="Dev Note"
          icon={MessageSquare}
          value={form.devNote}
          onChange={(v) => setField("devNote", v)}
          placeholder="Developer note..."
        />
        <EditorTextField
          label="Test Note"
          icon={MessageSquare}
          value={form.testNote}
          onChange={(v) => setField("testNote", v)}
          readOnly={readOnly}
          placeholder="Tester note..."
        />
      </section>
    </>
  );
}
