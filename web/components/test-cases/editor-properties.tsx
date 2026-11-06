"use client";

import { CalendarDays, ClipboardCheck, Hash, ListChecks, Plus, Shield, UserCheck, UserCog, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PropertySelect } from "./editor-fields";
import { fixedOptions, priorityOptions, statusOptions, type EditorForm, type EditorOption } from "./editor-options";

const DATE_CREATED = "2026-05-03";

type EditorPropertiesProps = {
  form: EditorForm;
  setField: <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => void;
  isAuthorized: boolean;
  isEditing: boolean;
  caseId: string;
  workspaceLabel: string;
  suiteOptions: EditorOption[];
  assigneeOptions: EditorOption[];
  availableAssigneeOptions: EditorOption[];
  onCreateSuite: () => void;
};

export function EditorProperties({
  form,
  setField,
  isAuthorized,
  isEditing,
  caseId,
  workspaceLabel,
  suiteOptions,
  assigneeOptions,
  availableAssigneeOptions,
  onCreateSuite,
}: EditorPropertiesProps) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <span className="truncate">{workspaceLabel}</span>
          <span>/</span>
          <span className="truncate">{isEditing ? caseId : "Create test case"}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <Hash />
            {form.testNo || "Auto test no"}
          </Badge>
          <Badge variant="outline">
            <CalendarDays />
            {DATE_CREATED}
          </Badge>
        </div>

        <Input
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          readOnly={!isAuthorized}
          aria-label="Test case name"
          className="h-auto border-0 px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-2xl dark:bg-transparent"
          placeholder="Example: Validate invite-link signup flow..."
        />

        <Textarea
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          readOnly={!isAuthorized}
          aria-label="Description"
          className="min-h-0 resize-none border-0 px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          placeholder="Additional details..."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PropertySelect
          id="editor-assign-dev"
          label="Assign Dev"
          icon={UserCog}
          value={form.assignDev}
          onValueChange={(v) => setField("assignDev", v)}
          options={availableAssigneeOptions}
        />
        <PropertySelect
          id="editor-assign-tester"
          label="Assign Tester"
          icon={UserCheck}
          value={form.assignTester}
          onValueChange={(v) => setField("assignTester", v)}
          options={assigneeOptions}
          disabled={!isAuthorized}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <PropertySelect
          id="editor-status"
          label="Status"
          icon={ClipboardCheck}
          value={form.status}
          onValueChange={(v) => setField("status", v as EditorForm["status"])}
          options={statusOptions}
          showSearch={false}
          disabled={!isAuthorized}
        />
        <PropertySelect
          id="editor-priority"
          label="Priority"
          icon={Shield}
          value={form.priority}
          onValueChange={(v) => setField("priority", v as EditorForm["priority"])}
          options={priorityOptions}
          showSearch={false}
          disabled={!isAuthorized}
        />
        <PropertySelect
          id="editor-fixed"
          label="Fixed"
          icon={Wrench}
          value={form.fixed}
          onValueChange={(v) => setField("fixed", v as EditorForm["fixed"])}
          options={fixedOptions}
          showSearch={false}
          disabled={!isAuthorized}
        />
        <PropertySelect
          id="editor-suite"
          label="Suite"
          icon={ListChecks}
          value={form.suiteId}
          onValueChange={(v) => setField("suiteId", v)}
          options={suiteOptions}
          disabled={!isAuthorized}
          action={
            isAuthorized ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={onCreateSuite}
                title="Create new suite"
                aria-label="Create new suite"
              >
                <Plus />
              </Button>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
