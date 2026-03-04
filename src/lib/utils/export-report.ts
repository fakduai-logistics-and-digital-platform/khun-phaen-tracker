import type { Task } from "$lib/types";
import { formatDateISO } from "./export-csv-sql";

export function sanitizeMarkdownText(text: string): string {
  return text.replace(/\r?\n/g, " ").trim();
}

export function escapeMarkdownInline(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, "\\$1");
}

export function normalizeTaskDate(dateText: string | undefined): string {
  if (!dateText) return "-";
  const isoMatch = dateText.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(dateText);
  return Number.isNaN(parsed.getTime()) ? "-" : formatDateISO(parsed);
}

export function sortTasksForReport(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    const dateCompare = normalizeTaskDate(a.date).localeCompare(
      normalizeTaskDate(b.date),
    );
    if (dateCompare !== 0) return dateCompare;
    const idA = a.id ?? Number.MAX_SAFE_INTEGER;
    const idB = b.id ?? Number.MAX_SAFE_INTEGER;
    if (idA !== idB) return Number(idA) - Number(idB);
    return (a.title || "").localeCompare(b.title || "", "th");
  });
}

export function buildTaskReportHtml(
  taskSnapshot: Task[],
  scopeLabel: string,
): string {
  const totalMinutes = taskSnapshot.reduce(
    (sum, task) => sum + (task.duration_minutes || 0),
    0,
  );
  const totalTasks = taskSnapshot.length;
  return `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<style>
				@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap');
				* { margin: 0; padding: 0; box-sizing: border-box; }
				body { font-family: 'Noto Sans Thai', sans-serif; padding: 40px; font-size: 12px; line-height: 1.6; }
				.header { margin-bottom: 24px; border-bottom: 2px solid #334155; padding-bottom: 16px; }
				.header h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
				.meta { color: #64748b; font-size: 11px; }
				.stats { display: flex; gap: 16px; margin-bottom: 20px; }
				.stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; min-width: 130px; }
				.stat-label { color: #64748b; font-size: 10px; }
				.stat-value { font-weight: 700; font-size: 14px; color: #0f172a; }
				table { width: 100%; border-collapse: collapse; margin-top: 12px; }
				th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 11px; }
				th { background: #f8fafc; font-weight: 700; }
				tr:nth-child(even) { background: #f8fafc; }
			</style>
		</head>
		<body>
			<div class="header">
				<h1>รายงานงาน (Task Report)</h1>
				<div class="meta">ช่วงข้อมูล: ${scopeLabel}<br>สร้างเมื่อ: ${new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}</div>
			</div>
			<div class="stats">
				<div class="stat"><div class="stat-label">จำนวนงานทั้งหมด</div><div class="stat-value">${totalTasks} งาน</div></div>
				<div class="stat"><div class="stat-label">เวลารวม</div><div class="stat-value">${(totalMinutes / 60).toFixed(1)} ชั่วโมง</div></div>
				<div class="stat"><div class="stat-label">Man-days</div><div class="stat-value">${(totalMinutes / 60 / 8).toFixed(2)} วัน</div></div>
			</div>
			<table>
				<thead>
					<tr><th>#</th><th>ชื่องาน</th><th>โปรเจกต์</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th>วันที่</th><th>เวลา</th></tr>
				</thead>
				<tbody>
					${taskSnapshot
            .map((task, i) => {
              const hours = Math.floor((task.duration_minutes || 0) / 60);
              const mins = (task.duration_minutes || 0) % 60;
              const timeStr =
                task.duration_minutes > 0
                  ? `${hours > 0 ? `${hours}ชม ` : ""}${mins > 0 ? `${mins}น` : ""}`
                  : "-";
              const statusText =
                task.status === "done"
                  ? "เสร็จแล้ว"
                  : task.status === "in-progress"
                    ? "กำลังทำ"
                    : "รอดำเนินการ";
              return `<tr><td>${i + 1}</td><td>${task.title || "-"}</td><td>${task.project || "-"}</td><td>${task.assignee?.name || "-"}</td><td>${statusText}</td><td>${normalizeTaskDate(task.date)}</td><td>${timeStr}</td></tr>`;
            })
            .join("")}
				</tbody>
			</table>
		</body>
		</html>
	`;
}
