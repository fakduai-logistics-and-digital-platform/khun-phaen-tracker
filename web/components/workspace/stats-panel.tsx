"use client";

import {
  Book,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle2,
  Circle,
  Code2,
  Coffee,
  FlaskConical,
  Globe,
  Heart,
  LayoutTemplate,
  Loader2,
  Music,
  PauseCircle,
  Rocket,
  Smile,
  Target,
  Zap,
  type LucideIcon,
  BadgeCheck,
} from "lucide-react";
import { ExportImport } from "@/components/workspace-modals/export-import";
import { useI18n } from "@/lib/i18n";
import type { Readable } from "@/lib/store";
import { useStore } from "@/lib/store";
import { currentWorkspaceIcon, currentWorkspaceName } from "@/lib/stores/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutTemplate,
  Briefcase,
  Code2,
  Rocket,
  Zap,
  Heart,
  Target,
  Globe,
  Book,
  Camera,
  Coffee,
  Music,
  Smile,
};

export type StatusFilter = "all" | "pending" | "todo" | "in-progress" | "in-test" | "tested" | "done";

export interface WorkspaceStats {
  total: number;
  pending: number;
  todo: number;
  in_progress: number;
  in_test: number;
  tested: number;
  done: number;
  total_minutes: number;
}

const EMPTY_STATS: WorkspaceStats = {
  total: 0,
  pending: 0,
  todo: 0,
  in_progress: 0,
  in_test: 0,
  tested: 0,
  done: 0,
  total_minutes: 0,
};

export interface StatsPanelProps {
  isOwner?: boolean;
  videoExportState?: Readable<any> | null;
  stats?: WorkspaceStats;
  onFilterStatus?: (detail: { status: StatusFilter }) => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  onExportPNG?: () => void;
  onExportMarkdown?: (detail?: any) => void;
  onExportVideo?: (detail?: any) => void;
  onExportSlide?: (detail?: any) => void;
  onExportDatabase?: (detail: any) => void;
  onImportCSV?: (content: string) => void;
}

const CARDS: { status: StatusFilter; labelKey: string; valueKey: keyof WorkspaceStats; Icon: LucideIcon }[] = [
  { status: "all", labelKey: "statsPanel__total_tasks", valueKey: "total", Icon: Calendar },
  { status: "pending", labelKey: "statsPanel__pending", valueKey: "pending", Icon: PauseCircle },
  { status: "todo", labelKey: "statsPanel__todo", valueKey: "todo", Icon: Circle },
  { status: "in-progress", labelKey: "statsPanel__in_progress", valueKey: "in_progress", Icon: Loader2 },
  { status: "done", labelKey: "statsPanel__done", valueKey: "done", Icon: CheckCircle2 },
  { status: "in-test", labelKey: "statsPanel__in_test", valueKey: "in_test", Icon: FlaskConical },
  { status: "tested", labelKey: "statsPanel__tested", valueKey: "tested", Icon: BadgeCheck },
];

export function StatsPanel({
  isOwner = false,
  videoExportState = null,
  stats = EMPTY_STATS,
  onFilterStatus,
  onExportCSV,
  onExportPDF,
  onExportPNG,
  onExportMarkdown,
  onExportVideo,
  onExportSlide,
  onExportDatabase,
  onImportCSV,
}: StatsPanelProps) {
  const { t } = useI18n();
  const name = useStore(currentWorkspaceName);
  const iconKey = useStore(currentWorkspaceIcon);
  const WorkspaceIcon = ICON_MAP[iconKey || "LayoutTemplate"] ?? LayoutTemplate;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {name ? (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <WorkspaceIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t("statsPanel__workspace")}</p>
              <h2 className="truncate text-lg font-semibold">{name}</h2>
            </div>
          </div>
        ) : (
          <span />
        )}
        <ExportImport
          showImport={isOwner}
          videoExportState={videoExportState}
          onExportCSV={onExportCSV}
          onExportPDF={onExportPDF}
          onExportPNG={onExportPNG}
          onExportMarkdown={onExportMarkdown}
          onExportVideo={onExportVideo}
          onExportSlide={onExportSlide}
          onExportDatabase={onExportDatabase}
          onImportCSV={onImportCSV}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {CARDS.map(({ status, labelKey, valueKey, Icon }) => (
          <button
            key={status}
            type="button"
            onClick={() => onFilterStatus?.({ status })}
            aria-label={t(labelKey)}
            className="rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="gap-2 py-4 transition-colors hover:bg-accent/50">
              <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
                <CardTitle className="text-sm font-medium">{t(labelKey)}</CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4">
                <div className="text-2xl font-medium tabular-nums">{stats[valueKey] ?? 0}</div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </section>
  );
}
