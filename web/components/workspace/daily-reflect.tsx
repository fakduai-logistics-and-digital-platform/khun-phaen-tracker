"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardCopy, Clock, RefreshCcw, Save, Send, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
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
        className="z-[20001] max-h-[92vh] max-w-lg gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        <div className="border-b p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>{t("dailyReflect__title")}</DialogTitle>
              <DialogDescription>{t("dailyReflect__subtitle")}</DialogDescription>
            </div>
            <div className="flex items-center gap-1">
              {isOwner && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings((open) => !open)}
                  title={t("dailyReflect__settings_title")}
                  aria-label={t("dailyReflect__settings_title")}
                  aria-expanded={showSettings}
                >
                  <Settings />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onShowChange(false)}
                aria-label={t("dailyReflect__btn_close")}
              >
                <X />
              </Button>
            </div>
          </div>

          {isOwner && showSettings && (
            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="webhook">{t("dailyReflect__webhook_label")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook"
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => reflect.setWebhookUrl(e.target.value)}
                    placeholder={t("dailyReflect__webhook_placeholder")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      reflect.saveWebhookSettings();
                      setShowSettings(false);
                    }}
                  >
                    <Save />
                    {t("timer__btn_save")}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                <b>Tip:</b> For automatic daily reports and instant notifications on task events, please use the{" "}
                <b>Workspace Settings</b> (Gear icon) on the main workspace page.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4 p-6">
          {reflect.isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <RefreshCcw className="animate-spin text-muted-foreground" size={32} />
              <p className="text-sm text-muted-foreground">{t("layout__loading_db")}</p>
            </div>
          ) : reflect.todayTasks.length === 0 ? (
            <div className="rounded-lg border px-4 py-12 text-center">
              <CheckCircle2 size={32} className="mx-auto mb-3 text-muted-foreground" />
              <h3 className="mb-1 font-medium">{t("dailyReflect__no_data_title")}</h3>
              <p className="mx-auto max-w-xs text-sm text-muted-foreground">{t("dailyReflect__no_data")}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-4">
                  <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 size={14} />
                    <span className="text-xs">{t("dailyReflect__completed_today_section")}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-semibold tabular-nums">{reflect.doneTodayTasks.length}</p>
                    <span className="text-xs text-muted-foreground">{t("dailyReflect__tasks_unit")}</span>
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                    <Clock size={14} />
                    <span className="text-xs">{t("dailyReflect__pending_section")}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-semibold tabular-nums">{reflect.pendingTasks.length}</p>
                    <span className="text-xs text-muted-foreground">{t("dailyReflect__pending_unit")}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="daily-reflect-text">{t("dailyReflect__generated_text")}</Label>
                  <div className="flex items-center gap-2">
                    {reflect.sendError && (
                      <span role="alert" className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle size={12} />
                        {reflect.sendError}
                      </span>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={reflect.refresh}>
                      <RefreshCcw />
                      {t("dailyReflect__btn_refresh")}
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <Textarea
                    id="daily-reflect-text"
                    value={generatedText}
                    readOnly
                    rows={10}
                    className="resize-none pb-12"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={reflect.copyToClipboard}
                    disabled={!generatedText}
                    className="absolute right-2 bottom-2"
                    title={t("dailyReflect__btn_copy")}
                    aria-label={t("dailyReflect__btn_copy")}
                  >
                    {copied ? <CheckCircle2 /> : <ClipboardCopy />}
                  </Button>
                </div>

                {isOwner && (
                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      type="button"
                      onClick={() => void reflect.sendToDiscord()}
                      disabled={!generatedText || !webhookUrl || reflect.isSending}
                      className="w-full"
                    >
                      {reflect.isSending ? (
                        <>
                          <RefreshCcw className="animate-spin" />
                          {t("layout__stats_syncing")}...
                        </>
                      ) : reflect.sendSuccess ? (
                        <>
                          <CheckCircle2 />
                          {t("dailyReflect__send_success")}
                        </>
                      ) : (
                        <>
                          <Send />
                          {t("dailyReflect__btn_send_discord")}
                        </>
                      )}
                    </Button>

                    {!webhookUrl && (
                      <p className="text-center text-xs text-muted-foreground">{t("dailyReflect__webhook_help")}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t px-6 py-3 text-center text-xs text-muted-foreground">
          {t("dailyReflect__footer_text")}
        </div>
      </DialogContent>
    </Dialog>
  );
}
