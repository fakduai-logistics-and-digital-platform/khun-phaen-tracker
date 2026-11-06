"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  MessageSquareQuote,
  RefreshCcw,
  Save,
  Send,
  Settings,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useDailyReflect } from "./use-daily-reflect";

export interface DailyReflectProps {
  show: boolean;
  onShowChange: (show: boolean) => void;
  isOwner?: boolean;
}

export function DailyReflect({ show, onShowChange, isOwner = true }: DailyReflectProps) {
  const { t } = useI18n();
  const [showSettings, setShowSettings] = useState(false);
  const reflect = useDailyReflect(show);
  const { generatedText, webhookUrl, copied } = reflect;

  return (
    <Dialog open={show} onOpenChange={onShowChange}>
      <DialogContent
        showCloseButton={false}
        className="z-[20001] max-h-[92vh] max-w-lg gap-0 overflow-y-auto rounded-lg p-0 sm:max-w-lg"
      >
        <div className="relative overflow-hidden px-6 py-6">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-secondary/5 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-linear-to-br from-primary to-blue-600 p-3 text-white">
                <MessageSquareQuote size={24} />
              </div>
              <div>
                <DialogTitle className="text-2xl font-semibold">{t("dailyReflect__title")}</DialogTitle>
                <DialogDescription className="font-medium">{t("dailyReflect__subtitle")}</DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowSettings((open) => !open)}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                  title={t("dailyReflect__settings_title")}
                  aria-label={t("dailyReflect__settings_title")}
                  aria-expanded={showSettings}
                >
                  <Settings size={20} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onShowChange(false)}
                className="group rounded-full p-2 transition-colors hover:bg-accent"
                aria-label={t("dailyReflect__btn_close")}
              >
                <X size={24} className="text-muted-foreground group-hover:text-foreground" />
              </button>
            </div>
          </div>

          {isOwner && showSettings && (
            <div className="relative mt-4 rounded-lg border bg-muted/60 p-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-col gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="webhook" className="text-xs font-medium text-muted-foreground">
                      {t("dailyReflect__webhook_label")}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        reflect.saveWebhookSettings();
                        setShowSettings(false);
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Save size={12} />
                      {t("timer__btn_save")}
                    </button>
                  </div>
                  <input
                    id="webhook"
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => reflect.setWebhookUrl(e.target.value)}
                    placeholder={t("dailyReflect__webhook_placeholder")}
                    className="w-full rounded-lg border bg-background px-4 py-2 text-sm transition-colors outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
                  <p className="text-xs leading-relaxed font-medium text-primary/80">
                    💡 <b>Tip:</b> For automatic daily reports and instant notifications on task events, please use the{" "}
                    <b>Workspace Settings</b> (Gear icon) on the main workspace page.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6 px-6 pb-6">
          {reflect.isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative">
                <RefreshCcw className="animate-spin text-primary" size={48} />
                <div className="absolute inset-0 animate-ping rounded-full bg-primary opacity-25" />
              </div>
              <p className="font-medium text-muted-foreground">{t("layout__loading_db")}</p>
            </div>
          ) : reflect.todayTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-12 text-center">
              <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="mb-2 text-lg font-medium">{t("dailyReflect__no_data_title")}</h3>
              <p className="mx-auto max-w-xs text-sm text-muted-foreground">{t("dailyReflect__no_data")}</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-success bg-linear-to-br from-emerald-50 to-teal-50 p-4 transition-colors hover:hover:shadow-emerald-500/5 dark:from-emerald-500/10 dark:to-teal-500/10">
                  <div className="mb-1 flex items-center gap-2 text-success">
                    <CheckCircle2 size={16} />
                    <span className="text-xs font-medium">{t("dailyReflect__completed_today_section")}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-semibold text-success">{reflect.doneTodayTasks.length}</p>
                    <span className="text-xs font-medium text-success/60">{t("dailyReflect__tasks_unit")}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-100 bg-linear-to-br from-amber-50 to-orange-50 p-4 transition-colors hover:hover:shadow-amber-500/5 dark:border-amber-500/20 dark:from-amber-500/10 dark:to-orange-500/10">
                  <div className="mb-1 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Clock size={16} />
                    <span className="text-xs font-medium">{t("dailyReflect__pending_section")}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-semibold text-amber-700 dark:text-amber-300">
                      {reflect.pendingTasks.length}
                    </p>
                    <span className="text-xs font-medium text-amber-600/60">{t("dailyReflect__pending_unit")}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label htmlFor="daily-reflect-text" className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquareQuote size={18} className="text-primary" />
                    {t("dailyReflect__generated_text")}
                  </label>
                  <div className="flex items-center gap-2">
                    {reflect.sendError && (
                      <span role="alert" className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertCircle size={12} />
                        {reflect.sendError}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={reflect.refresh}
                      className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      <RefreshCcw size={14} className="transition-transform duration-500 group-hover:rotate-180" />
                      {t("dailyReflect__btn_refresh")}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    id="daily-reflect-text"
                    value={generatedText}
                    readOnly
                    rows={10}
                    className="w-full resize-none rounded-lg border bg-muted/40 p-5 leading-relaxed font-medium shadow-inner transition-colors outline-none focus:border-primary focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="button"
                    onClick={reflect.copyToClipboard}
                    disabled={!generatedText}
                    className={cn(
                      "absolute right-3 bottom-3 rounded-lg p-2.5 transition-colors disabled:opacity-50",
                      copied
                        ? "bg-success text-white shadow-emerald-500/20"
                        : "border bg-background/80 text-muted-foreground backdrop-blur-sm hover:bg-primary hover:text-primary-foreground hover:hover:",
                    )}
                    title={t("dailyReflect__btn_copy")}
                    aria-label={t("dailyReflect__btn_copy")}
                  >
                    {copied ? (
                      <CheckCircle2 size={20} className="animate-in zoom-in-50 duration-200" />
                    ) : (
                      <ClipboardCopy size={20} />
                    )}
                  </button>
                </div>

                {isOwner && (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void reflect.sendToDiscord()}
                      disabled={!generatedText || !webhookUrl || reflect.isSending}
                      className={cn(
                        "flex w-full items-center justify-center gap-3 rounded-lg py-4 font-medium text-white transition-colors active:scale-[0.98] disabled:opacity-50 disabled:grayscale",
                        reflect.sendSuccess
                          ? "bg-success"
                          : "bg-[#5865F2] shadow-[#5865F2]/20 hover:-translate-y-0.5 hover:hover:shadow-[#5865F2]/30",
                      )}
                    >
                      {reflect.isSending ? (
                        <>
                          <RefreshCcw size={20} className="animate-spin" />
                          <span>{t("layout__stats_syncing")}...</span>
                        </>
                      ) : reflect.sendSuccess ? (
                        <>
                          <CheckCircle2 size={20} />
                          <span>{t("dailyReflect__send_success")}</span>
                        </>
                      ) : (
                        <>
                          <Send size={20} />
                          <span>{t("dailyReflect__btn_send_discord")}</span>
                        </>
                      )}
                    </button>

                    {!webhookUrl && (
                      <p className="text-center text-xs font-medium text-muted-foreground">
                        {t("dailyReflect__webhook_help")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center border-t bg-muted/40 px-6 py-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <div className="size-1.5 rounded-full bg-primary" />
            {t("dailyReflect__footer_text")}
            <div className="size-1.5 rounded-full bg-primary" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
