"use client";

import { Check, Edit3, Image as ImageIcon, Paperclip, Plus, Save, Trash2, X } from "lucide-react";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fixedOptions, priorityOptions, statusOptions } from "./tc-options";
import { TcHistoryButton } from "./tc-history";
import type { AssigneeOption, SidebarTab, Suite, TestCase, TestCaseAttachment } from "./tc-types";
import { StoredImage } from "@/components/shared/stored-image";
import type { useTcDetail } from "./use-tc-detail";
import { TestCaseStepList } from "./test-case-step-list";

type Detail = ReturnType<typeof useTcDetail>;

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "properties", label: "Properties" },
  { id: "notes", label: "Notes" },
  { id: "attachments", label: "Attachments" },
];

const FIELDS: { field: keyof TestCase; label: string; rows: number; empty: string }[] = [
  { field: "description", label: "Description", rows: 3, empty: "No description" },
  { field: "preconditions", label: "Pre-conditions", rows: 2, empty: "Not set" },
  { field: "postconditions", label: "Post-conditions", rows: 2, empty: "Not set" },
  { field: "input", label: "Input", rows: 2, empty: "No input data" },
  { field: "expected_result", label: "Expected Result", rows: 2, empty: "No expected result" },
  { field: "actual_result", label: "Actual Result", rows: 2, empty: "No actual result" },
];

const HEADING = "text-sm font-bold";

function EditableField({
  testCase,
  spec,
  detail,
  isAuthorized,
}: {
  testCase: TestCase;
  spec: (typeof FIELDS)[number];
  detail: Detail;
  isAuthorized: boolean;
}) {
  const key = spec.field as string;
  const editing = detail.editingField === key;
  const value = (testCase[spec.field] as string | undefined) || "";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className={HEADING}>{spec.label}</h3>
        {isAuthorized && !editing && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Edit ${spec.label}`}
            onClick={() => detail.startEditing(key, value)}
          >
            <Edit3 size={14} />
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            rows={spec.rows}
            value={detail.tempFieldValue}
            onChange={(e) => detail.setTempFieldValue(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="icon" aria-label="Cancel" onClick={detail.cancelEditing}>
              <X size={16} />
            </Button>
            <Button
              type="button"
              size="icon"
              aria-label="Save"
              disabled={detail.isSavingField}
              onClick={() => detail.saveField(key)}
            >
              <Check size={16} />
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{value || spec.empty}</p>
      )}
    </div>
  );
}

function PropertySelect({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className={cn(HEADING, "mb-2")} id={`${id}-label`}>
        {label}
      </h3>
      {children}
    </section>
  );
}

export function TcDetailPanel({
  testCase,
  suite,
  detail,
  isAuthorized,
  width,
  assigneeOptions,
  availableAssigneeOptions,
  onStartResize,
  onClose,
  onConvertToTask,
  onEdit,
  onDelete,
  onUpdatePriority,
  onUpdateStatus,
  onUpdateFixed,
  onUpdateAssignDev,
  onUpdateAssignTester,
  onOpenAttachment,
}: {
  testCase: TestCase;
  suite: Suite | undefined;
  detail: Detail;
  isAuthorized: boolean;
  width: number;
  assigneeOptions: AssigneeOption[];
  availableAssigneeOptions: AssigneeOption[];
  onStartResize: (event: React.PointerEvent) => void;
  onClose: () => void;
  onConvertToTask: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdatePriority: (value: string) => void;
  onUpdateStatus: (value: string) => void;
  onUpdateFixed: (value: string) => void;
  onUpdateAssignDev: (value: string) => void;
  onUpdateAssignTester: (value: string) => void;
  onOpenAttachment: (attachments: TestCaseAttachment[], index: number) => void;
}) {
  const { t } = useI18n();
  const tab = detail.sidebarTab;
  const attachments = testCase.attachments || [];

  return (
    <aside
      className="relative hidden shrink-0 flex-col overflow-hidden border-l bg-card lg:flex"
      style={{ width }}
      aria-label="Test case details"
    >
      <button
        type="button"
        aria-label="Resize test case details panel"
        title={t("tc__title_resize")}
        onPointerDown={onStartResize}
        className="absolute inset-y-0 left-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-primary/40"
      />

      <div className="shrink-0 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs tabular-nums text-muted-foreground">TC-{testCase.test_no}</p>
            <h2 className="mt-1 text-lg font-bold">{testCase.title}</h2>
            {suite && <p className="mt-0.5 text-sm text-muted-foreground">{suite.title}</p>}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("tc__title_close_details")}
            title={t("tc__title_close_details")}
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onConvertToTask}>
            <Plus size={16} />
            Create Task
          </Button>
          {isAuthorized && (
            <>
              <Button type="button" variant="ghost" size="icon" aria-label={t("tc__title_edit")} onClick={onEdit}>
                <Edit3 size={17} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("tc__title_delete")}
                className="text-destructive"
                onClick={onDelete}
              >
                <Trash2 size={17} />
              </Button>
            </>
          )}
        </div>

        <div className="mt-4 flex gap-5 text-sm" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => detail.setSidebarTab(item.id)}
              className={cn(
                "border-b-2 pb-2 transition-colors",
                tab === item.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {tab === "general" && (
          <>
            {FIELDS.map((spec) => (
              <EditableField
                key={spec.field}
                testCase={testCase}
                spec={spec}
                detail={detail}
                isAuthorized={isAuthorized}
              />
            ))}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className={HEADING}>{t("tc__steps")}</h3>
                {isAuthorized &&
                  (detail.isEditingSteps ? (
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={detail.cancelStepsEdit}>
                        {t("tc__cancel")}
                      </Button>
                      <Button type="button" size="sm" disabled={detail.isSavingSteps} onClick={detail.saveSteps}>
                        {t("tc__save_changes")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Edit steps"
                      onClick={() => detail.setIsEditingSteps(true)}
                    >
                      <Edit3 size={14} />
                    </Button>
                  ))}
              </div>
              <TestCaseStepList
                steps={detail.sidebarSteps}
                onStepsChange={detail.setSidebarSteps}
                format={detail.sidebarStepFormat}
                readOnly={!detail.isEditingSteps}
              />
            </section>
          </>
        )}

        {tab === "properties" && (
          <>
            <TcHistoryButton
              testCaseId={testCase.id}
              updatedAt={testCase.updated_at}
              passedAt={testCase.passed_at}
              showTime
              className="-ml-2 w-fit"
            />
            <PropertySelect id="priority" label="Priority">
              <SearchableSelect
                id="sidebar-prop-priority-update"
                value={testCase.priority}
                options={priorityOptions}
                showSearch={false}
                disabled={!isAuthorized}
                onSelect={(v) => onUpdatePriority(String(v ?? ""))}
              />
            </PropertySelect>
            <PropertySelect id="status" label="Status">
              <SearchableSelect
                id="sidebar-prop-status-update"
                value={testCase.status}
                options={statusOptions}
                showSearch={false}
                disabled={!isAuthorized}
                onSelect={(v) => onUpdateStatus(String(v ?? ""))}
              />
            </PropertySelect>
            <PropertySelect id="fixed" label="Fix Status">
              <SearchableSelect
                id="sidebar-prop-fixed-update"
                value={testCase.fixed}
                options={fixedOptions}
                showSearch={false}
                onSelect={(v) => onUpdateFixed(String(v ?? ""))}
              />
            </PropertySelect>
            <PropertySelect id="dev" label="Assign Developer">
              <SearchableSelect
                id="sidebar-prop-assigndev-update"
                value={testCase.assign_dev || "unassigned"}
                options={availableAssigneeOptions}
                onSelect={(v) => onUpdateAssignDev(String(v ?? ""))}
              />
            </PropertySelect>
            <PropertySelect id="tester" label="Assign Tester">
              <SearchableSelect
                id="sidebar-prop-assigntester-update"
                value={testCase.assignee || "unassigned"}
                options={assigneeOptions}
                disabled={!isAuthorized}
                onSelect={(v) => onUpdateAssignTester(String(v ?? ""))}
              />
            </PropertySelect>
          </>
        )}

        {tab === "notes" && (
          <>
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className={HEADING}>Dev Notes</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={detail.isSavingNotes}
                  onClick={detail.saveNotes}
                >
                  <Save size={14} />
                  {detail.isSavingNotes ? "Saving..." : "Save"}
                </Button>
              </div>
              <Textarea
                rows={6}
                placeholder={t("tc__ph_dev_notes")}
                value={detail.devNote}
                onChange={(e) => detail.setDevNote(e.target.value)}
              />
            </section>
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className={HEADING}>Tester Notes</h3>
                {isAuthorized && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={detail.isSavingNotes}
                    onClick={detail.saveNotes}
                  >
                    <Save size={14} />
                    {detail.isSavingNotes ? "Saving..." : "Save"}
                  </Button>
                )}
              </div>
              <Textarea
                rows={6}
                placeholder={isAuthorized ? "Add tester notes..." : "Only QA Testers can add notes here"}
                value={detail.testNote}
                disabled={!isAuthorized}
                onChange={(e) => detail.setTestNote(e.target.value)}
              />
            </section>
          </>
        )}

        {tab === "attachments" &&
          (attachments.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {attachments.map((attachment, i) => (
                <button
                  key={attachment.id || attachment.file_key}
                  type="button"
                  onClick={() => onOpenAttachment(attachments, i)}
                  className="group relative aspect-square overflow-hidden rounded-lg border"
                >
                  <StoredImage
                    fileKey={attachment.file_key}
                    thumb
                    alt={attachment.filename}
                    className="size-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <ImageIcon size={14} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <Paperclip size={32} />
              <h3 className="mt-3 font-bold text-foreground">No attachments yet</h3>
              <p className="mt-1 text-sm">Images added to this test case will appear here</p>
            </div>
          ))}
      </div>
    </aside>
  );
}
