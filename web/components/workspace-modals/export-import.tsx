"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  ChevronDown,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Presentation,
  Upload,
  Video,
  type LucideIcon,
} from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import type { Readable, Writable } from "@/lib/store";
import { showMessage } from "@/lib/stores/uiActions";
import { cn } from "@/lib/utils";

export type DatabaseExportTarget = {
  database: "SQLite" | "MongoDB/NoSQL" | "PostgreSQL";
  extensions: string[];
  primaryExtension: string;
  note: string;
};

function FormatItem({ icon: Icon, label, onSelect }: { icon: LucideIcon; label: ReactNode; onSelect: () => void }) {
  return (
    <DropdownMenuItem onSelect={onSelect}>
      <Icon />
      <span>{label}</span>
    </DropdownMenuItem>
  );
}

export function ExportImport({
  showImport = true,
  videoExportState: videoExportProp = null,
  onExportCSV,
  onExportPDF,
  onExportPNG,
  onExportMarkdown,
  onExportVideo,
  onExportVideoWithVoice,
  onExportSlide,
  onExportDatabase,
  onImportCSV,
}: {
  showImport?: boolean;
  videoExportState?: Readable<any> | Writable<any> | null;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  onExportPNG?: () => void;
  onExportMarkdown?: () => void;
  onExportVideo?: () => void;
  onExportVideoWithVoice?: () => void;
  onExportSlide?: () => void;
  onExportDatabase?: (target: DatabaseExportTarget) => void;
  onImportCSV?: (content: string) => void;
}) {
  const { t } = useI18n();
  const videoExportState = videoExportProp as Writable<any> | null;
  const fileInput = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importContent, setImportContent] = useState("");
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  const databaseTargets: DatabaseExportTarget[] = [
    {
      database: "SQLite",
      extensions: [".db", ".sqlite"],
      primaryExtension: ".sqlite",
      note: t("exportImport__sqlite_note"),
    },
    {
      database: "MongoDB/NoSQL",
      extensions: [".json", ".bson"],
      primaryExtension: ".json",
      note: t("exportImport__nosql_note"),
    },
    {
      database: "PostgreSQL",
      extensions: [".sql"],
      primaryExtension: ".sql",
      note: t("exportImport__postgres_note"),
    },
  ];

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setImportContent(content);
        setShowImportConfirm(true);
      }
    };
    reader.readAsText(file);
  }

  function resetImport() {
    setShowImportConfirm(false);
    setImportContent("");
    if (fileInput.current) fileInput.current.value = "";
  }

  function confirmImport() {
    if (!importContent) return;
    onImportCSV?.(importContent);
    resetImport();
  }

  async function handleExportPNG() {
    const element = (document.getElementById("content") ||
      document.querySelector(".space-y-6") ||
      document.querySelector(".max-w-7xl")) as HTMLElement | null;
    if (!element) {
      alert(t("exportImport__error_no_content"));
      return;
    }

    try {
      if (videoExportState) {
        const start = performance.now();
        videoExportState.set({
          inProgress: true,
          percent: 0,
          elapsedMs: 0,
          timer: setInterval(() => {
            videoExportState.update((s: any) => ({ ...s, elapsedMs: performance.now() - start }));
          }, 100),
        });
      } else {
        showMessage(`${t("exportImport__export_png")}...`, "success");
      }

      await new Promise((r) => setTimeout(r, 100));

      videoExportState?.update((s: any) => ({ ...s, percent: 50 }));

      const dataUrl = await toPng(element, {
        quality: 0.95,
        backgroundColor: document.documentElement.classList.contains("dark") ? "#1f2937" : "#ffffff",
        pixelRatio: 2,
        width: element.offsetWidth,
        height: element.offsetHeight,
        style: { transform: "none", margin: "0" },
        fontEmbedCSS: "",
        filter: (node: any) => {
          if (node.tagName === "BUTTON" && node.closest(".fixed")) return false;
          if (node.classList?.contains("fixed")) return false;
          return true;
        },
      });

      const link = document.createElement("a");
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
      link.download = `khu-phaen-tasks_${dateStr}_${timeStr}.png`;
      link.href = dataUrl;
      link.click();

      videoExportState?.update((s: any) => {
        if (s.timer) clearInterval(s.timer);
        return { ...s, inProgress: false, percent: 100, timer: null };
      });

      showMessage(t("page__export_png_success"), "success");
      onExportPNG?.();
    } catch (error) {
      console.error("PNG export failed:", error);
      videoExportState?.update((s: any) => {
        if (s.timer) clearInterval(s.timer);
        return { ...s, inProgress: false, timer: null };
      });
      showMessage(t("exportImport__error_export_png"), "error");
    }
  }

  return (
    <>
      <div className="flex flex-nowrap items-center gap-2">
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Download />
              <span className="hidden sm:inline">{t("exportImport__export")}</span>
              <ChevronDown className={cn("transition-transform", menuOpen && "rotate-180")} />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
            <DropdownMenuLabel>Choose Format</DropdownMenuLabel>

            <FormatItem icon={FileSpreadsheet} label={t("exportImport__export_csv")} onSelect={() => onExportCSV?.()} />
            <FormatItem icon={FileText} label={t("exportImport__export_pdf")} onSelect={() => onExportPDF?.()} />
            <FormatItem
              icon={ImageIcon}
              label={t("exportImport__export_png")}
              onSelect={() => void handleExportPNG()}
            />
            <FormatItem
              icon={FileCode}
              label={t("exportImport__export_markdown")}
              onSelect={() => onExportMarkdown?.()}
            />
            <FormatItem icon={Video} label={t("exportImport__export_video")} onSelect={() => onExportVideo?.()} />
            <FormatItem icon={Video} label="Video + Voice (AI)" onSelect={() => onExportVideoWithVoice?.()} />
            <FormatItem
              icon={Presentation}
              label={t("exportImport__export_slide")}
              onSelect={() => onExportSlide?.()}
            />

            <DropdownMenuSeparator className="my-2" />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t("exportImport__export_database")}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-72 rounded-lg py-2">
                {databaseTargets.map((target) => (
                  <DropdownMenuItem
                    key={target.database}
                    onSelect={() => onExportDatabase?.(target)}
                    className="flex-col items-start gap-0.5 rounded-none border-b px-4 py-2.5 last:border-0"
                  >
                    <span className="text-sm font-medium">{target.database}</span>
                    <span className="text-xs text-muted-foreground">{target.note}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        {showImport && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              aria-label={t("exportImport__import")}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <Upload />
              <span className="hidden sm:inline">{t("exportImport__import")}</span>
              <span className="sm:hidden">{t("exportImport__import_short")}</span>
            </Button>
          </>
        )}
      </div>

      <Dialog open={showImportConfirm} onOpenChange={(next) => !next && resetImport()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("exportImport__import_confirm_title")}</DialogTitle>
            <DialogDescription>{t("exportImport__import_confirm_message")}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetImport}>
              {t("exportImport__btn_cancel")}
            </Button>
            <Button type="button" onClick={confirmImport}>
              {t("exportImport__btn_import")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
