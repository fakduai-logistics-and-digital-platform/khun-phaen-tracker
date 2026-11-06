import { Settings2, Sparkles } from "lucide-react";
import { InfoTile } from "@/components/settings/info-tile";
import { SettingsNotice } from "@/components/settings/settings-notice";
import { Button } from "@/components/ui/button";
import type { AiFields } from "@/components/settings/use-ai-config";

type AiConfigSummaryProps = {
  config: AiFields;
  pageSuccess: string;
  onOpenSettings: () => void;
};

const NOT_CONFIGURED = "Not configured";
const MASKED_KEY = "••••••••••••••••";

type Group = { title: string; urlLabel: string; url: string; model: string; apiKey: string };

export function AiConfigSummary({ config, pageSuccess, onOpenSettings }: AiConfigSummaryProps) {
  const groups: Group[] = [
    {
      title: "Embeddings (Search)",
      urlLabel: "Embeddings URL",
      url: config.embeddings_url,
      model: config.embeddings_model,
      apiKey: config.embeddings_api_key,
    },
    {
      title: "LLM (Task Generation)",
      urlLabel: "LLM URL",
      url: config.llm_url,
      model: config.llm_model,
      apiKey: config.llm_api_key,
    },
    {
      title: "TTS (Text-to-Speech)",
      urlLabel: "TTS URL",
      url: config.tts_url,
      model: config.tts_model,
      apiKey: config.tts_api_key,
    },
  ];

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Embeddings Configuration</h3>
            <p className="text-sm text-muted-foreground">Configure the AI embeddings API endpoint and credentials</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon-lg"
          onClick={onOpenSettings}
          aria-label="Open AI settings"
          title="Open AI settings"
        >
          <Settings2 size={18} />
        </Button>
      </div>

      <div className="mt-5 space-y-6">
        {groups.map((group) => (
          <div key={group.title}>
            <h4 className="mb-3 text-sm font-semibold text-muted-foreground">{group.title}</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              <InfoTile label={group.urlLabel} value={group.url || NOT_CONFIGURED} truncate />
              <InfoTile label="Model" value={group.model || NOT_CONFIGURED} />
              <InfoTile
                label="API Key"
                value={group.apiKey ? MASKED_KEY : NOT_CONFIGURED}
                mono
                className="lg:col-span-2"
              />
            </div>
          </div>
        ))}
      </div>

      {pageSuccess && (
        <SettingsNotice kind="success" className="mt-4">
          {pageSuccess}
        </SettingsNotice>
      )}
    </section>
  );
}
