"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/settings/native-select";
import { SecretInput } from "@/components/settings/secret-input";
import type { AiFields } from "@/components/settings/use-ai-config";

type ServiceKey = "embeddings" | "llm" | "tts";

type AiServiceFieldsProps = {
  service: ServiceKey;
  title: string;
  urlLabel: string;
  urlPlaceholder: string;
  modelPlaceholder: string;
  draft: AiFields;
  onChange: (key: keyof AiFields, value: string) => void;
  modelOptions?: string[];
  loadingModels?: boolean;
  onLoadModels?: () => void;
  bordered?: boolean;
};

export function AiServiceFields({
  service,
  title,
  urlLabel,
  urlPlaceholder,
  modelPlaceholder,
  draft,
  onChange,
  modelOptions = [],
  loadingModels = false,
  onLoadModels,
  bordered = false,
}: AiServiceFieldsProps) {
  const urlKey = `${service}_url` as const;
  const keyKey = `${service}_api_key` as const;
  const modelKey = `${service}_model` as const;
  const canLoad = !!draft[urlKey] && !!draft[keyKey] && !loadingModels;

  return (
    <div className={bordered ? "border-t pt-4" : undefined}>
      <h5 className="mb-3 text-sm font-semibold">{title}</h5>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`ai-${urlKey}`}>{urlLabel}</Label>
          <Input
            id={`ai-${urlKey}`}
            value={draft[urlKey]}
            onChange={(e) => onChange(urlKey, e.target.value)}
            placeholder={urlPlaceholder}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`ai-${keyKey}`}>API Key</Label>
          <SecretInput
            id={`ai-${keyKey}`}
            value={draft[keyKey]}
            onValueChange={(value) => onChange(keyKey, value)}
            showLabel="Show API key"
            hideLabel="Hide API key"
            placeholder="sk-..."
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={`ai-${modelKey}`}>Model</Label>
            {onLoadModels && (
              <button
                type="button"
                className="text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onLoadModels}
                disabled={!canLoad}
              >
                {loadingModels ? "Loading..." : "Load Models"}
              </button>
            )}
          </div>
          {modelOptions.length > 0 ? (
            <NativeSelect
              id={`ai-${modelKey}`}
              value={draft[modelKey]}
              onChange={(e) => onChange(modelKey, e.target.value)}
            >
              <option value="">Select a model</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <Input
              id={`ai-${modelKey}`}
              value={draft[modelKey]}
              onChange={(e) => onChange(modelKey, e.target.value)}
              placeholder={modelPlaceholder}
              className="h-11"
            />
          )}
        </div>
      </div>
    </div>
  );
}
