"use client";

import { Folder, FolderOpen, Hash, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n";
import type { Project } from "@/lib/types";
import { PropertyField } from "./editor-fields";
import { fixedOptions, priorityOptions, statusOptions, type EditorForm, type EditorOption } from "./editor-options";

type EditorPropertiesProps = {
  form: EditorForm;
  setField: <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => void;
  isAuthorized: boolean;
  projects: Project[];
  onProjectChange: (projectId: string) => void;
  suiteOptions: EditorOption[];
  assigneeOptions: EditorOption[];
  availableAssigneeOptions: EditorOption[];
  onCreateSuite: () => void;
};

/** Sidebar card with every property of the test case, one control per row. */
export function EditorProperties({
  form,
  setField,
  isAuthorized,
  projects,
  onProjectChange,
  suiteOptions,
  assigneeOptions,
  availableAssigneeOptions,
  onCreateSuite,
}: EditorPropertiesProps) {
  const { t } = useI18n();
  const translate = (defs: typeof statusOptions) => defs.map((def) => ({ ...def, label: t(def.labelKey) }));

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="flex items-center justify-between px-4">
        <CardTitle className="text-sm">{t("tcEditor__properties")}</CardTitle>
        <Badge variant="outline" className="font-mono">
          <Hash />
          {form.testNo || t("tcEditor__auto_test_no")}
        </Badge>
      </CardHeader>
      <CardContent className="px-4">
        <FieldGroup className="gap-4">
          <PropertyField
            id="editor-status"
            label={t("tcopt__prop_status")}
            value={form.status}
            onValueChange={(v) => setField("status", v as EditorForm["status"])}
            options={translate(statusOptions)}
            disabled={!isAuthorized}
          />
          <PropertyField
            id="editor-priority"
            label={t("tcopt__prop_priority")}
            value={form.priority}
            onValueChange={(v) => setField("priority", v as EditorForm["priority"])}
            options={translate(priorityOptions)}
            disabled={!isAuthorized}
          />
          <PropertyField
            id="editor-fixed"
            label={t("tcopt__prop_fixed")}
            value={form.fixed}
            onValueChange={(v) => setField("fixed", v as EditorForm["fixed"])}
            options={translate(fixedOptions)}
            disabled={!isAuthorized}
          />
          {projects.length > 0 && (
            <PropertyField
              id="editor-project"
              label={t("tcProject__label")}
              value={form.projectId || "none"}
              onValueChange={(v) => onProjectChange(v === "none" ? "" : v)}
              options={[
                { value: "none", label: t("tcProject__none"), icon: FolderOpen, iconClass: "text-muted-foreground" },
                ...projects.map((project) => ({
                  value: String(project.id),
                  label: project.name,
                  icon: Folder,
                  iconClass: "text-muted-foreground",
                })),
              ]}
              disabled={!isAuthorized}
            />
          )}
          <PropertyField
            id="editor-suite"
            label={t("tcopt__field_suite")}
            value={form.suiteId}
            onValueChange={(v) => setField("suiteId", v)}
            options={suiteOptions}
            placeholder={t("tcEditor__no_suite")}
            disabled={!isAuthorized}
            action={
              isAuthorized ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={onCreateSuite}
                  title={t("tcEditor__create_suite")}
                  aria-label={t("tcEditor__create_suite")}
                >
                  <Plus />
                </Button>
              ) : undefined
            }
          />
          <PropertyField
            id="editor-assign-dev"
            label={t("tcopt__prop_assign_dev")}
            value={form.assignDev}
            onValueChange={(v) => setField("assignDev", v)}
            options={availableAssigneeOptions}
          />
          <PropertyField
            id="editor-assign-tester"
            label={t("tcEditor__assign_tester")}
            value={form.assignTester}
            onValueChange={(v) => setField("assignTester", v)}
            options={assigneeOptions}
            disabled={!isAuthorized}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
