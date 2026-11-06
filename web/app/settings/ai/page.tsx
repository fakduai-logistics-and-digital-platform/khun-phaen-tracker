"use client";

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { AiConfigDialog } from "@/components/settings/ai-config-dialog";
import { AiConfigSummary } from "@/components/settings/ai-config-summary";
import { SettingsHero } from "@/components/settings/settings-hero";
import { useAiConfig } from "@/components/settings/use-ai-config";

export default function AiSettingsPage() {
  const ai = useAiConfig();

  useEffect(() => {
    document.title = "AI Settings";
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
      <SettingsHero
        icon={Sparkles}
        title="AI Settings"
        badge="Admin Only"
        subtitle="Configure AI embeddings endpoint for semantic task search and chat features"
      />

      <AiConfigSummary config={ai.config} pageSuccess={ai.pageSuccess} onOpenSettings={ai.openModal} />

      <AiConfigDialog
        open={ai.modalOpen}
        draft={ai.draft}
        models={ai.models}
        loadingModels={ai.loadingModels}
        modalError={ai.modalError}
        modalSuccess={ai.modalSuccess}
        saving={ai.saving}
        resetting={ai.resetting}
        onChange={ai.updateDraft}
        onLoadModels={(service) => void ai.loadModels(service)}
        onSave={() => void ai.save()}
        onReset={() => void ai.reset()}
        onClose={ai.closeModal}
      />
    </div>
  );
}
