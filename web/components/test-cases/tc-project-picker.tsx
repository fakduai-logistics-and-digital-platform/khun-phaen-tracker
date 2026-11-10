"use client";

import { Folder, FolderOpen, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import type { Project } from "@/lib/types";

type TcProjectPickerProps = {
  projects: Project[];
  onSelect: (projectId: string) => void;
};

export function TcProjectPicker({ projects, onSelect }: TcProjectPickerProps) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-6">
      <div className="w-full max-w-3xl space-y-6 py-8">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("tcPicker__title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("tcPicker__description")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <button
              key={String(project.id)}
              aria-label={project.name}
              type="button"
              onClick={() => onSelect(String(project.id))}
              className="rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Card className="h-full gap-0 py-4 transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{project.name}</span>
                  </CardTitle>
                  {project.short_name && (
                    <CardDescription>{project.short_name}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect("none")}
          >
            <FolderOpen />
            {t("tcProject__none")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelect("all")}
          >
            <Layers />
            {t("tcPicker__view_all")}
          </Button>
        </div>
      </div>
    </div>
  );
}
