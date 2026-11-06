"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Assignee, Project, Task } from "@/lib/types";
import { estimateQRSize, formatBytes, getRelatedData, prepareQRData, QR_MAX_BYTES } from "@/lib/utils/qr-export";
import { cn } from "@/lib/utils";

const NO_TASKS: Task[] = [];
const NO_PROJECTS: Project[] = [];
const NO_ASSIGNEES: Assignee[] = [];

type SizeInfo = { bytes: number; fitsQR: boolean; percentage: number };

export function QRExportModal({
  show = false,
  selectedTasks = NO_TASKS,
  allProjects = NO_PROJECTS,
  allAssignees = NO_ASSIGNEES,
  onClose,
  onExportCSV,
}: {
  show?: boolean;
  selectedTasks?: Task[];
  allProjects?: Project[];
  allAssignees?: Assignee[];
  onClose?: () => void;
  onExportCSV?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrData, setQrData] = useState("");
  const [sizeInfo, setSizeInfo] = useState<SizeInfo>({ bytes: 0, fitsQR: true, percentage: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show || selectedTasks.length === 0) return;
    setError("");
    try {
      const { projects, assignees } = getRelatedData(selectedTasks, allProjects, allAssignees);
      const data = prepareQRData(selectedTasks, projects, assignees);
      setQrData(data);
      setSizeInfo(estimateQRSize(data));
    } catch (e) {
      setError("เกิดข้อผิดพลาดในการสร้าง QR Code");
      console.error("QR generation error:", e);
    }
  }, [show, selectedTasks, allProjects, allAssignees]);

  useEffect(() => {
    if (!show || !sizeInfo.fitsQR || !qrData) return;
    let cancelled = false;
    // The dialog portal mounts the canvas after this effect first runs; retry on the next frame.
    const frame = requestAnimationFrame(async () => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      try {
        await QRCode.toCanvas(canvas, qrData, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: "L",
          color: { dark: "#000000", light: "#ffffff" },
        });
      } catch (e) {
        if (cancelled) return;
        setError("ข้อมูลใหญ่เกินไปสำหรับ QR Code");
        console.error("QR render error:", e);
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [show, sizeInfo.fitsQR, qrData]);

  function handleExportCSV() {
    onExportCSV?.();
    onClose?.();
  }

  return (
    <Dialog open={show} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="max-w-sm gap-0 p-0 sm:max-w-sm">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <QrCode size={20} className="text-brand-500" />
            ส่งออก QR Code
          </DialogTitle>
        </DialogHeader>

        <div className="p-5">
          <p className="mb-4 text-center text-sm text-muted-foreground">เลือก {selectedTasks.length} งาน</p>

          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
              {error}
            </div>
          )}

          {sizeInfo.fitsQR ? (
            <>
              <div className="mb-4 flex justify-center">
                <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
                  <canvas ref={canvasRef} />
                </div>
              </div>

              <div className="mb-4">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>ขนาดข้อมูล</span>
                  <span>
                    {formatBytes(sizeInfo.bytes)} / {formatBytes(QR_MAX_BYTES)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-colors",
                      sizeInfo.percentage > 80 ? "bg-amber-500" : "bg-brand-500",
                    )}
                    style={{ width: `${Math.min(sizeInfo.percentage, 100)}%` }}
                  />
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                สแกน QR Code นี้ด้วยอุปกรณ์อื่นเพื่อนำเข้าข้อมูล
              </p>
            </>
          ) : (
            <div className="py-4 text-center">
              <div className="mb-3 flex justify-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <AlertTriangle size={32} className="text-amber-600" />
                </div>
              </div>
              <h4 className="mb-2 text-base font-medium">ข้อมูลใหญ่เกินไป</h4>
              <p className="mb-1 text-sm text-muted-foreground">
                ขนาด: {formatBytes(sizeInfo.bytes)} / {formatBytes(QR_MAX_BYTES)} ({sizeInfo.percentage}%)
              </p>
              <p className="mb-4 text-sm text-muted-foreground">ลองเลือกน้อยลง หรือใช้การส่งออก CSV แทน</p>
              <Button type="button" onClick={handleExportCSV} className="bg-success text-white hover:bg-success">
                <Download size={16} />
                ส่งออก CSV แทน
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
