"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { currentWorkspaceName, currentWorkspaceShortName } from "@/lib/stores/workspace";
import {
  getBranchPrefixForTaskType,
  getCheckoutCommand,
  getComputedBranchName,
  type BranchNameOptions,
  type GitFlowType,
  type TaskType,
} from "@/lib/utils/branch-name";
import { cn } from "@/lib/utils";
import { createBranchTranslator } from "./branch-translator";

const GIT_FLOW_TYPES: readonly GitFlowType[] = [
  "feature",
  "bugfix",
  "hotfix",
  "release",
  "perf",
  "refactor",
  "docs",
  "chore",
];

type MessageType = "info" | "success" | "error";
type CopiedField = "branch" | "command";

export function BranchDialog({
  show = false,
  title = "",
  gitFlowType: initialGitFlowType = "feature",
  workspaceShortName = "",
  taskNumber = null,
  taskType,
  onClose,
}: {
  show?: boolean;
  title?: string;
  gitFlowType?: GitFlowType;
  workspaceShortName?: string;
  taskNumber?: number | null;
  taskType?: TaskType | null;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const workspaceName = useStore(currentWorkspaceName);
  const storeShortName = useStore(currentWorkspaceShortName);

  const [editableTitle, setEditableTitle] = useState("");
  const [translatedTitle, setTranslatedTitle] = useState("");
  const [gitFlowType, setGitFlowType] = useState<GitFlowType>(initialGitFlowType);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("info");
  const [isTranslating, setIsTranslating] = useState(false);
  const [copiedField, setCopiedField] = useState<CopiedField | null>(null);

  const translatorRef = useRef<ReturnType<typeof createBranchTranslator> | null>(null);
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userOverrodePrefixRef = useRef(false);
  const titleRef = useRef(title);
  titleRef.current = title;

  const getTranslator = useCallback(() => {
    translatorRef.current ??= createBranchTranslator();
    return translatorRef.current;
  }, []);

  const effectiveShortName = useMemo(() => {
    const fallback = workspaceName.replace(/\s+/g, "").slice(0, 4).toUpperCase();
    return workspaceShortName.trim() || storeShortName || fallback;
  }, [workspaceName, storeShortName, workspaceShortName]);

  const nameOptions = (translated: string): BranchNameOptions => ({
    gitFlowType,
    workspaceShortName: effectiveShortName,
    taskNumber,
    translatedTitle: translated,
    editableTitle,
    title,
  });

  const branchName = getComputedBranchName(nameOptions(translatedTitle));
  const checkoutCommand = getCheckoutCommand(nameOptions(translatedTitle));

  const updateBranchPreview = useCallback(
    async (rawTitle: string): Promise<string | null> => {
      const cleanedTitle = rawTitle.trim();
      const requestId = ++requestIdRef.current;

      if (!cleanedTitle) {
        setTranslatedTitle("");
        setMessage("พิมพ์ชื่องาน แล้วระบบจะช่วยสร้างชื่อ branch");
        setMessageType("info");
        setIsTranslating(false);
        return "";
      }

      setIsTranslating(true);
      setMessage("กำลังแปลชื่อ task เป็นภาษาอังกฤษ...");
      setMessageType("info");
      setTranslatedTitle("");

      const { text, translated } = await getTranslator().translateTitle(cleanedTitle);
      if (requestId !== requestIdRef.current) return null;

      setTranslatedTitle(text);
      setIsTranslating(false);
      setMessage(translated ? "แปลเป็นภาษาอังกฤษแล้ว" : "ใช้ชื่อเดิม (ภาษาไทยหรือแปลไม่สำเร็จ)");
      setMessageType(translated ? "success" : "info");
      return text;
    },
    [getTranslator],
  );

  useEffect(() => {
    if (!show) return;
    setEditableTitle(titleRef.current);
    userOverrodePrefixRef.current = false;
    setGitFlowType(getBranchPrefixForTaskType(taskType));
    void updateBranchPreview(titleRef.current);
    // Runs on open only; later taskType changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, updateBranchPreview]);

  useEffect(() => {
    if (show && !userOverrodePrefixRef.current) {
      setGitFlowType(getBranchPrefixForTaskType(taskType));
    }
  }, [show, taskType]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      translatorRef.current?.destroy();
    },
    [],
  );

  function handleTitleChange(value: string) {
    setEditableTitle(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void updateBranchPreview(value);
    }, 1000);
  }

  function handlePrefixChange(value: string) {
    userOverrodePrefixRef.current = true;
    setGitFlowType(value as GitFlowType);
  }

  async function copyValue(field: CopiedField) {
    const cleanedTitle = editableTitle.trim();
    if (!cleanedTitle) return;

    await getTranslator().warmUp();
    const latestTranslation = await updateBranchPreview(cleanedTitle);
    if (latestTranslation === null) return;

    if (!navigator.clipboard?.writeText) {
      setMessage("เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ");
      setMessageType("error");
      return;
    }

    const options = nameOptions(latestTranslation);
    const value = field === "branch" ? getComputedBranchName(options) : getCheckoutCommand(options);

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setMessage(`คัดลอกแล้ว: ${value}`);
      setMessageType("success");

      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
      setMessage("คัดลอกไม่สำเร็จ กรุณาลองใหม่");
      setMessageType("error");
    }
  }

  const copyDisabled = !editableTitle.trim() || isTranslating;

  function renderCopyLabel(field: CopiedField) {
    return copiedField === field ? (
      <>
        <Check size={14} strokeWidth={3} />
        <span>{t("branchDialog__btn_copied")}</span>
      </>
    ) : (
      <>
        <Copy size={14} />
        <span>{t("branchDialog__btn_copy")}</span>
      </>
    );
  }

  return (
    <Dialog open={show} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="max-w-md gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-medium">
            <GitBranch size={16} className="text-brand-500" />
            {t("branchDialog__title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="branch-task-title" className="text-xs font-medium text-muted-foreground">
              {t("branchDialog__task_title")}
            </Label>
            <Input
              id="branch-task-title"
              value={editableTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t("branchDialog__task_title_placeholder")}
              className="h-11 rounded-lg text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="git-flow-prefix" className="text-xs font-medium text-muted-foreground">
              {t("branchDialog__prefix")}
            </Label>
            <Select value={gitFlowType} onValueChange={handlePrefixChange}>
              <SelectTrigger id="git-flow-prefix" className="h-11 w-full rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GIT_FLOW_TYPES.map((flow) => (
                  <SelectItem key={flow} value={flow}>
                    {flow}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="branch-name-preview" className="text-xs font-medium text-muted-foreground">
              {t("branchDialog__branch_name")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="branch-name-preview"
                value={branchName}
                readOnly
                className="h-11 flex-1 rounded-lg font-mono text-xs text-brand-500"
              />
              <Button
                type="button"
                onClick={() => void copyValue("branch")}
                disabled={copyDisabled}
                className="h-11 rounded-lg px-4 text-xs font-medium"
              >
                {renderCopyLabel("branch")}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="checkout-command-preview" className="text-xs font-medium text-muted-foreground">
              {t("branchDialog__checkout_command")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="checkout-command-preview"
                value={checkoutCommand}
                readOnly
                className="h-11 flex-1 rounded-lg font-mono text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void copyValue("command")}
                disabled={copyDisabled}
                className="h-11 rounded-lg px-4 text-xs font-medium"
              >
                {renderCopyLabel("command")}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1" role="status">
            <div
              className={cn(
                "size-1.5 rounded-full",
                messageType === "error" ? "bg-destructive" : messageType === "success" ? "bg-success" : "bg-brand-500",
              )}
            />
            <p className="text-xs font-medium text-muted-foreground">
              {!editableTitle.trim() ? (
                t("branchDialog__msg_empty")
              ) : isTranslating ? (
                t("branchDialog__msg_translating")
              ) : (
                <>
                  <span>{t("branchDialog__translated")}:</span>
                  <span className="mx-1 text-brand-500">{translatedTitle || "-"}</span>
                  <span className="mx-1 opacity-30">|</span>
                  <span className={cn(messageType === "error" && "text-destructive")}>{message}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} className="rounded-lg font-medium">
            {t("branchDialog__btn_close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
