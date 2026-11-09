"use client";

import { Folder, FolderOpen, Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import type { Project } from "@/lib/types";

type Props = {
  id?: string;
  value: string;
  projects: Project[];
  onChange: (value: string) => void;
  /** Adds the "All projects" choice used for filtering. */
  includeAll?: boolean;
  className?: string;
};

/** Project picker for the test-case repository: `all`, `none` (no project) or a project id. */
export function TcProjectSelect({ id, value, projects, onChange, includeAll = false, className }: Props) {
  const { t } = useI18n();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={className ?? "w-full"} aria-label={t("tcProject__label")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {includeAll && (
          <SelectItem value="all">
            <Layers className="text-muted-foreground" />
            {t("tcProject__all")}
          </SelectItem>
        )}
        <SelectItem value="none">
          <FolderOpen className="text-muted-foreground" />
          {t("tcProject__none")}
        </SelectItem>
        {projects.map((project) => (
          <SelectItem key={String(project.id)} value={String(project.id)}>
            <Folder className="text-muted-foreground" />
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
