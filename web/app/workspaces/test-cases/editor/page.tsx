"use client";

import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, Clock, Plus } from "lucide-react";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { LanguagePicker } from "@/components/language-picker";
import { PaletteSwitch } from "@/components/palette-switch";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@/components/ui/button";
import { EditorAttachments } from "@/components/test-cases/editor-attachments";
import { EditorBodySections } from "@/components/test-cases/editor-body-sections";
import { EditorCreateSuiteDialog } from "@/components/test-cases/editor-create-suite-dialog";
import { EditorProperties } from "@/components/test-cases/editor-properties";
import { EditorStepsSection } from "@/components/test-cases/editor-steps-section";
import { useEditorForm } from "@/components/test-cases/use-editor-form";
import { ClientOnly } from "@/components/shared/client-only";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useRouteIds } from "@/lib/use-route-ids";
import { currentWorkspaceName } from "@/lib/stores/workspace";

function TestCaseEditor() {
  const { t } = useI18n();
  const { workspaceId } = useRouteIds();
  const workspaceName = useStore(currentWorkspaceName);
  const workspaceLabel = workspaceName || "Current workspace";
  const [showCreateSuite, setShowCreateSuite] = useState(false);

  const editor = useEditorForm(workspaceId);
  const { form, isEditing, isAuthorized, isSaving } = editor;

  useEffect(() => {
    const action = isEditing ? t("meta__testcase_action_edit") : t("meta__testcase_action_create");
    document.title = t("meta__testcase_editor_title", { action, name: workspaceLabel });
  }, [t, isEditing, workspaceLabel]);

  return (
    <>
      <Header>
        <Search />
        <div className="ms-auto flex items-center gap-2">
          <LanguagePicker />
          <PaletteSwitch />
          <ThemeSwitch />
        </div>
      </Header>

      <Main id="content">
        <form
          className="mx-auto flex w-full max-w-6xl flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void editor.submit();
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <Button type="button" variant="ghost" size="sm" onClick={editor.backToRepository}>
              <ArrowLeft size={16} />
              Back
            </Button>
            <div className="flex items-center gap-3">
              {isEditing && isAuthorized && (
                <Button type="button" variant="secondary" onClick={() => void editor.convertToTask()}>
                  <Plus size={16} />
                  <span>Create Task</span>
                </Button>
              )}
              <Button type="submit" disabled={isSaving || !form.name.trim()}>
                {isSaving ? (
                  <>
                    <Clock size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : isEditing ? (
                  "Save test case"
                ) : (
                  "Create test case"
                )}
              </Button>
            </div>
          </div>

          <div className="mt-6 flex-1 rounded-xl border bg-card shadow-sm">
            <EditorProperties
              form={form}
              setField={editor.setField}
              isAuthorized={isAuthorized}
              isEditing={isEditing}
              caseId={editor.caseId}
              workspaceLabel={workspaceLabel}
              suiteOptions={editor.suiteOptions}
              assigneeOptions={editor.assigneeOptions}
              availableAssigneeOptions={editor.availableAssigneeOptions}
              onCreateSuite={() => setShowCreateSuite(true)}
            />
            <EditorBodySections form={form} setField={editor.setField} isAuthorized={isAuthorized} />
            <EditorAttachments
              attachments={editor.attachments}
              isAuthorized={isAuthorized}
              onAdd={editor.addAttachments}
              onRemove={editor.removeAttachment}
            />
            <EditorStepsSection form={form} setField={editor.setField} isAuthorized={isAuthorized} />
          </div>
        </form>
      </Main>

      <EditorCreateSuiteDialog open={showCreateSuite} onOpenChange={setShowCreateSuite} onCreate={editor.createSuite} />
    </>
  );
}

export default function TestCaseEditorPage() {
  return (
    <AuthenticatedLayout>
      <Suspense>
        <ClientOnly>
          <TestCaseEditor />
        </ClientOnly>
      </Suspense>
    </AuthenticatedLayout>
  );
}
