"use client";

import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { LanguagePicker } from "@/components/language-picker";
import { PaletteSwitch } from "@/components/palette-switch";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EditorAttachments } from "@/components/test-cases/editor-attachments";
import { EditorDetailsTab, EditorNotesTab } from "@/components/test-cases/editor-body-sections";
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
  const workspaceLabel = workspaceName || t("tcEditor__workspace_fallback");
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
          className="mx-auto flex w-full max-w-6xl flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void editor.submit();
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0"
                onClick={editor.backToRepository}
                aria-label={t("tcEditor__back")}
              >
                <ArrowLeft />
              </Button>
              <Breadcrumb className="min-w-0">
                <BreadcrumbList className="flex-nowrap">
                  <BreadcrumbItem className="min-w-0">
                    <span className="truncate">{workspaceLabel}</span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <button type="button" className="hover:text-foreground" onClick={editor.backToRepository}>
                      {t("tcEditor__breadcrumb_cases")}
                    </button>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="truncate">
                      {isEditing ? form.testNo || editor.caseId : t("tcEditor__new_case")}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-2">
              {isEditing && isAuthorized && (
                <Button type="button" variant="outline" onClick={() => void editor.convertToTask()}>
                  <Plus />
                  {t("tcEditor__create_task")}
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={editor.backToRepository}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSaving || !form.name.trim()}>
                {isSaving && <Spinner data-icon="inline-start" />}
                {isSaving ? t("tcEditor__saving") : isEditing ? t("tcEditor__save") : t("tcEditor__create")}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Card className="gap-4">
              <CardContent className="flex flex-col gap-4">
                <Input
                  value={form.name}
                  onChange={(e) => editor.setField("name", e.target.value)}
                  readOnly={!isAuthorized}
                  aria-label={t("tcEditor__name_label")}
                  className="h-auto border-0 px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-2xl dark:bg-transparent"
                  placeholder={t("tcEditor__name_placeholder")}
                />
                <Textarea
                  value={form.description}
                  onChange={(e) => editor.setField("description", e.target.value)}
                  readOnly={!isAuthorized}
                  aria-label={t("tcEditor__description")}
                  className="min-h-16 resize-none border-0 px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                  placeholder={t("tcEditor__description_placeholder")}
                />

                <Tabs defaultValue="steps" className="gap-4">
                  <TabsList className="w-fit">
                    <TabsTrigger value="steps">{t("tcEditor__tab_steps")}</TabsTrigger>
                    <TabsTrigger value="details">{t("tcEditor__tab_details")}</TabsTrigger>
                    <TabsTrigger value="notes">{t("tcEditor__tab_notes")}</TabsTrigger>
                    <TabsTrigger value="attachments">
                      {t("tcEditor__tab_attachments")}
                      {editor.attachments.length > 0 && (
                        <Badge variant="secondary" className="rounded-full px-1.5">
                          {editor.attachments.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="steps">
                    <EditorStepsSection form={form} setField={editor.setField} isAuthorized={isAuthorized} />
                  </TabsContent>
                  <TabsContent value="details">
                    <EditorDetailsTab form={form} setField={editor.setField} isAuthorized={isAuthorized} />
                  </TabsContent>
                  <TabsContent value="notes">
                    <EditorNotesTab form={form} setField={editor.setField} isAuthorized={isAuthorized} />
                  </TabsContent>
                  <TabsContent value="attachments">
                    <EditorAttachments
                      attachments={editor.attachments}
                      isAuthorized={isAuthorized}
                      onAdd={editor.addAttachments}
                      onRemove={editor.removeAttachment}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="lg:sticky lg:top-20">
              <EditorProperties
                form={form}
                setField={editor.setField}
                isAuthorized={isAuthorized}
                projects={editor.projects}
                onProjectChange={editor.setProject}
                suiteOptions={editor.suiteOptions}
                assigneeOptions={editor.assigneeOptions}
                availableAssigneeOptions={editor.availableAssigneeOptions}
                onCreateSuite={() => setShowCreateSuite(true)}
              />
            </div>
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
