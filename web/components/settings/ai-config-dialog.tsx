"use client";

import { LoaderCircle, Settings2 } from "lucide-react";
import { AiServiceFields } from "@/components/settings/ai-service-fields";
import { SettingsNotice } from "@/components/settings/settings-notice";
import type { AiFields, AiService } from "@/components/settings/use-ai-config";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AiConfigDialogProps = {
  open: boolean;
  draft: AiFields;
  models: Record<AiService, string[]>;
  loadingModels: Record<AiService, boolean>;
  modalError: string;
  modalSuccess: string;
  saving: boolean;
  resetting: boolean;
  onChange: (key: keyof AiFields, value: string) => void;
  onLoadModels: (service: AiService) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
};

export function AiConfigDialog({
  open,
  draft,
  models,
  loadingModels,
  modalError,
  modalSuccess,
  saving,
  resetting,
  onChange,
  onLoadModels,
  onSave,
  onReset,
  onClose,
}: AiConfigDialogProps) {
  const busy = saving || resetting;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b bg-gradient-to-br from-brand-500/15 via-muted/30 to-transparent px-6 py-5 text-left sm:px-7">
          <div className="flex items-center gap-3 pr-8">
            <div className="rounded-xl bg-primary/10 p-3 text-primary ring-1 ring-primary/20">
              <Settings2 size={18} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">AI Configuration</DialogTitle>
              <DialogDescription>Configure embeddings API endpoint and credentials</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-6 sm:px-7">
          {modalError && (
            <SettingsNotice kind="error" className="mb-4">
              {modalError}
            </SettingsNotice>
          )}
          {modalSuccess && (
            <SettingsNotice kind="success" className="mb-4">
              {modalSuccess}
            </SettingsNotice>
          )}

          <div className="grid gap-4">
            <AiServiceFields
              service="embeddings"
              title="Embeddings (Search)"
              urlLabel="Embeddings URL"
              urlPlaceholder="http://example.com/v1/embeddings"
              modelPlaceholder="mistral/mistral-embed"
              draft={draft}
              onChange={onChange}
              modelOptions={models.embeddings}
              loadingModels={loadingModels.embeddings}
              onLoadModels={() => onLoadModels("embeddings")}
            />
            <AiServiceFields
              service="llm"
              title="LLM (Task Generation)"
              urlLabel="LLM URL"
              urlPlaceholder="http://example.com/v1"
              modelPlaceholder="mistral/mistral-7b-instruct"
              draft={draft}
              onChange={onChange}
              modelOptions={models.llm}
              loadingModels={loadingModels.llm}
              onLoadModels={() => onLoadModels("llm")}
              bordered
            />
            <AiServiceFields
              service="tts"
              title="TTS (Text-to-Speech)"
              urlLabel="TTS URL"
              urlPlaceholder="http://example.com/v1/audio/speech"
              modelPlaceholder="google-tts/th"
              draft={draft}
              onChange={onChange}
              bordered
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <div className="mr-auto">
              <Button
                variant="outline"
                onClick={onReset}
                disabled={busy}
                className="border-warning/40 text-warning hover:text-warning"
              >
                Reset
              </Button>
            </div>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={busy} className="gap-2">
              {saving && <LoaderCircle size={16} className="animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
