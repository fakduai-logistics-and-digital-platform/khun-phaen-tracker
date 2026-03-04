import type { Task, Assignee, Project } from "$lib/types";
import type { Sprint } from "$lib/stores/sprintStore";
import {
  getTasksBySprint,
  exportFilteredSQLiteBinary,
  importAllData,
  getStats,
} from "$lib/db";
import { clearSearch } from "$lib/stores/search";
import { sprints } from "$lib/stores/sprintStore";
import {
  formatDateISO,
  formatExportTimestamp,
  downloadBlob,
  buildCsvFromSnapshot,
  buildPostgresSqlFromSnapshot,
} from "$lib/utils/export-csv-sql";
import {
  sanitizeMarkdownText,
  escapeMarkdownInline,
  normalizeTaskDate,
  sortTasksForReport,
  buildTaskReportHtml,
} from "$lib/utils/export-report";
import {
  type VideoSlide,
  drawRoundedRect,
  wrapText,
  renderVideoSlide,
  loadImage,
  composeMonthlyReportImage,
  createRoyaltyFreeAudioBed,
} from "$lib/utils/export-canvas-video";
import {
  isWithinLastDays,
  type MonthlySummary,
} from "$lib/utils/monthly-summary";
import { toPng } from "html-to-image";
import * as XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";
import { DEFAULT_FILTERS } from "$lib/stores/filterActions";
import type { FilterOptions } from "$lib/types";

type NotifyType = "success" | "error";

export type ExportActionDeps = {
  loadData: () => Promise<void>;
  notify: (message: string, type?: NotifyType) => void;
  t: (key: string, options?: any) => string;
  trackRealtime: (reason: string) => void;
  getTasks: () => Task[];
  getAllTasksIncludingArchived: () => Task[];
  getAssignees: () => Assignee[];
  getProjectList: () => Project[];
  getSprints: () => Sprint[];
  getMonthlySummary: () => MonthlySummary;
  getMonthlySummaryRef: () => HTMLDivElement | undefined;
  getVideoExportState: () => {
    inProgress: boolean;
    percent: number;
    elapsedMs: number;
    timer: ReturnType<typeof setInterval> | null;
  };
  setVideoExportState: (state: {
    inProgress: boolean;
    percent: number;
    elapsedMs: number;
    timer: ReturnType<typeof setInterval> | null;
  }) => void;
  getFilters: () => FilterOptions;
  setFilters: (filters: FilterOptions) => void;
  setSearchInput: (input: string) => void;
  // For handleCompleteSprint delegation
  handleCompleteSprint: (event: CustomEvent<number>) => Promise<boolean>;
};

export function createExportActions(deps: ExportActionDeps) {
  // ─── Helpers ──────────────────────────────────────────
  function getFilteredExportContext() {
    const taskSnapshot = [...deps.getTasks()];
    const visibleAssigneeIds = new Set<number>();
    for (const task of taskSnapshot) {
      if (task.assignee_ids && task.assignee_ids.length > 0) {
        task.assignee_ids.forEach((id) => visibleAssigneeIds.add(id as number));
      } else if (task.assignee_id) {
        visibleAssigneeIds.add(task.assignee_id as number);
      }
    }
    const visibleProjectNames = new Set(
      taskSnapshot
        .map((task) => (task.project || "").trim())
        .filter((name) => name.length > 0),
    );
    const visibleSprintIds = new Set(
      taskSnapshot
        .map((task) => (task.sprint_id != null ? String(task.sprint_id) : null))
        .filter((id): id is string => id !== null),
    );

    const relatedAssignees = deps
      .getAssignees()
      .filter(
        (assignee) =>
          assignee.id !== undefined &&
          visibleAssigneeIds.has(assignee.id as number),
      );
    const relatedProjects = deps
      .getProjectList()
      .filter((project) => visibleProjectNames.has(project.name));
    const relatedSprints = deps
      .getSprints()
      .filter(
        (sprint) =>
          sprint.id !== undefined && visibleSprintIds.has(String(sprint.id)),
      );

    return {
      taskSnapshot,
      relatedProjects,
      relatedAssignees,
      relatedSprints,
    };
  }

  async function getExportTaskContext(
    event?: CustomEvent<number | void>,
  ): Promise<{ taskSnapshot: Task[]; scopeLabel: string }> {
    const sprintId = event?.detail != null ? event.detail : undefined;
    if (!sprintId) {
      return {
        taskSnapshot: [...deps.getTasks()],
        scopeLabel: "ข้อมูลปัจจุบันทั้งหมด",
      };
    }
    const sprintTasks = await getTasksBySprint(sprintId);
    const archivedTasks = sprintTasks.filter((task) => task.is_archived);
    const sprintName =
      deps.getSprints().find((sprint) => String(sprint.id) === String(sprintId))
        ?.name || `Sprint ${sprintId}`;
    return {
      taskSnapshot: archivedTasks,
      scopeLabel: `${sprintName} (Archived)`,
    };
  }

  function getMonthlyExportTaskContext(): {
    taskSnapshot: Task[];
    scopeLabel: string;
  } {
    return {
      taskSnapshot: deps
        .getAllTasksIncludingArchived()
        .filter((task) => isWithinLastDays(task.date, 30)),
      scopeLabel: `สรุปรายเดือน (${deps.getMonthlySummary().periodLabel})`,
    };
  }

  async function captureMonthlyChartImages(): Promise<
    Array<{ title: string; image: string }>
  > {
    const ref = deps.getMonthlySummaryRef();
    if (!ref) return [];
    const chartCards = Array.from(
      ref.querySelectorAll<HTMLElement>("[data-monthly-chart]"),
    );
    const images: Array<{ title: string; image: string }> = [];
    for (const card of chartCards) {
      const title = card.dataset.chartTitle || "Chart";
      const image = await toPng(card, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: document.documentElement.classList.contains("dark")
          ? "#111827"
          : "#ffffff",
        fontEmbedCSS: "",
      });
      images.push({ title, image });
    }
    return images;
  }

  function formatElapsedTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  // ─── Export Functions ────────────────────────────────
  async function handleExportCSV() {
    try {
      const {
        taskSnapshot,
        relatedProjects,
        relatedAssignees,
        relatedSprints,
      } = getFilteredExportContext();
      const csv = buildCsvFromSnapshot(
        taskSnapshot,
        relatedProjects,
        relatedAssignees,
        relatedSprints,
      );
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const timeStr = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
      link.setAttribute("download", `tasks_${dateStr}_${timeStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      deps.notify(deps.t("page__export_csv_success"));
    } catch (e) {
      deps.notify(deps.t("page__export_csv_error"), "error");
    }
  }

  async function handleExportDatabase(
    event: CustomEvent<{
      database: "SQLite" | "MongoDB/NoSQL" | "PostgreSQL";
      extensions: string[];
      primaryExtension: string;
      note: string;
    }>,
  ) {
    const { database } = event.detail;
    const timestamp = formatExportTimestamp();
    try {
      if (database === "SQLite") {
        const visibleTaskIds = deps
          .getTasks()
          .map((task) => task.id)
          .filter((id): id is number => id !== null && id !== undefined);
        const binary = await exportFilteredSQLiteBinary(visibleTaskIds);
        const sqliteBytes = new Uint8Array(binary);
        downloadBlob(
          `tasks_${timestamp}.sqlite`,
          new Blob([sqliteBytes], {
            type: "application/vnd.sqlite3",
          }),
        );
        deps.notify(deps.t("page__export_sqlite_success"));
        return;
      }

      const {
        taskSnapshot,
        relatedProjects,
        relatedAssignees,
        relatedSprints,
      } = getFilteredExportContext();
      if (database === "PostgreSQL") {
        const sqlScript = buildPostgresSqlFromSnapshot(
          taskSnapshot,
          relatedProjects,
          relatedAssignees,
          relatedSprints,
        );
        downloadBlob(
          `tasks_${timestamp}_postgres.sql`,
          new Blob([sqlScript], {
            type: "application/sql;charset=utf-8",
          }),
        );
        deps.notify(deps.t("page__export_postgres_success"));
        return;
      }

      const payload = {
        meta: {
          exported_at: new Date().toISOString(),
          source: "khun-phaen-tracker",
          format: "document",
          scope: "filtered-visible",
        },
        tasks: taskSnapshot,
        projects: relatedProjects,
        assignees: relatedAssignees,
        sprints: relatedSprints,
      };
      downloadBlob(
        `tasks_${timestamp}.json`,
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json;charset=utf-8",
        }),
      );
      deps.notify(deps.t("page__export_nosql_success"));
    } catch (e) {
      console.error("Database export failed:", e);
      deps.notify(deps.t("page__export_db_error"), "error");
    }
  }

  async function handleExportMarkdown(
    event?: CustomEvent<number | void>,
    contextOverride?: { taskSnapshot: Task[]; scopeLabel: string },
  ) {
    try {
      const today = new Date();
      const reportDate = formatDateISO(today);
      const { taskSnapshot, scopeLabel } =
        contextOverride || (await getExportTaskContext(event));

      if (event?.detail && taskSnapshot.length === 0) {
        deps.notify(deps.t("page__export_markdown_no_data"), "error");
        return;
      }

      const doneTasks = sortTasksForReport(
        taskSnapshot.filter((task) => task.status === "done"),
      );
      const inProgressTasks = sortTasksForReport(
        taskSnapshot.filter((task) => task.status === "in-progress"),
      );
      const todoTasks = sortTasksForReport(
        taskSnapshot.filter((task) => task.status === "todo"),
      );
      const unknownStatusTasks = sortTasksForReport(
        taskSnapshot.filter(
          (task) =>
            task.status !== "done" &&
            task.status !== "in-progress" &&
            task.status !== "todo",
        ),
      );

      const taskLine = (task: Task, done = false) => {
        const title = escapeMarkdownInline(
          sanitizeMarkdownText(task.title || "ไม่ระบุชื่องาน"),
        );
        const project = escapeMarkdownInline(
          sanitizeMarkdownText(task.project || "-"),
        );
        const assignee = escapeMarkdownInline(
          sanitizeMarkdownText(task.assignee?.name || "ไม่ระบุ"),
        );
        const dateText = normalizeTaskDate(task.date);
        if (done) {
          return `- [x] ${title} (${project}) - ผู้รับผิดชอบ: ${assignee} - ${dateText}`;
        }
        return `- [ ] ${title} (${project}) - ผู้รับผิดชอบ: ${assignee} - Due: ${dateText}`;
      };

      const markdown = [
        `# Task Report - ${reportDate}`,
        "",
        "## 📊 สถิติ",
        `- ช่วงข้อมูล: ${scopeLabel}`,
        `- งานทั้งหมด: ${taskSnapshot.length} งาน`,
        `- เสร็จแล้ว: ${doneTasks.length} งาน`,
        `- กำลังทำ: ${inProgressTasks.length} งาน`,
        `- รอดำเนินการ: ${todoTasks.length} งาน`,
        "",
        "## 📋 รายการงาน",
        "",
        "### ✅ เสร็จแล้ว",
        ...(doneTasks.length > 0
          ? doneTasks.map((task) => taskLine(task, true))
          : ["- ไม่มีงาน"]),
        "",
        "### 🔄 กำลังทำ",
        ...(inProgressTasks.length > 0
          ? inProgressTasks.map((task) => taskLine(task))
          : ["- ไม่มีงาน"]),
        "",
        "### ⏳ รอดำเนินการ",
        ...(todoTasks.length > 0
          ? todoTasks.map((task) => taskLine(task))
          : ["- ไม่มีงาน"]),
        ...(unknownStatusTasks.length > 0
          ? [
              "",
              "### ❓ สถานะอื่นๆ",
              ...unknownStatusTasks.map((task) => taskLine(task)),
            ]
          : []),
      ].join("\n");

      const blob = new Blob([markdown], {
        type: "text/markdown;charset=utf-8;",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const hours = String(today.getHours()).padStart(2, "0");
      const minutes = String(today.getMinutes()).padStart(2, "0");
      const seconds = String(today.getSeconds()).padStart(2, "0");
      link.setAttribute(
        "download",
        `task_report_${reportDate}_${hours}-${minutes}-${seconds}.md`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      deps.notify(deps.t("page__export_markdown_success"));
    } catch (e) {
      console.error("Markdown Export Error:", e);
      deps.notify(deps.t("page__export_markdown_error"), "error");
    }
  }

  async function handleExportVideo(
    event?: CustomEvent<number | void>,
    contextOverride?: { taskSnapshot: Task[]; scopeLabel: string },
  ) {
    try {
      if (typeof MediaRecorder === "undefined") {
        deps.notify(
          deps.t("page__export_video_browser_not_supported"),
          "error",
        );
        return;
      }

      const now = new Date();
      const reportDate = formatDateISO(now);
      const { taskSnapshot, scopeLabel } =
        contextOverride || (await getExportTaskContext(event));
      if (event?.detail && taskSnapshot.length === 0) {
        deps.notify(deps.t("page__export_video_no_data"), "error");
        return;
      }
      const doneTasks = sortTasksForReport(
        taskSnapshot.filter((task) => task.status === "done"),
      );
      const inProgressTasks = sortTasksForReport(
        taskSnapshot.filter((task) => task.status === "in-progress"),
      );
      const todoTasks = sortTasksForReport(
        taskSnapshot.filter((task) => task.status === "todo"),
      );

      const summarize = (task: Task): string => {
        const title = sanitizeMarkdownText(task.title || "ไม่ระบุชื่องาน");
        const assignee = sanitizeMarkdownText(task.assignee?.name || "ไม่ระบุ");
        return `• ${title} (${assignee})`;
      };

      const slides: VideoSlide[] = [];
      slides.push({
        kicker: "TASK REPORT VIDEO",
        title: `รายงานงาน ${reportDate}`,
        subtitle: "Khun Phaen Task Tracker",
        accent: "#35d4ff",
        lines: [
          `ช่วงข้อมูล ${scopeLabel}`,
          `งานทั้งหมด ${taskSnapshot.length} งาน`,
          `เสร็จแล้ว ${doneTasks.length} งาน`,
          `กำลังทำ ${inProgressTasks.length} งาน`,
          `รอดำเนินการ ${todoTasks.length} งาน`,
        ],
      });

      const assigneeStatsMap = new Map<
        string,
        { total: number; done: number }
      >();
      for (const task of taskSnapshot) {
        const name = task.assignee?.name || "ไม่ระบุ";
        const s = assigneeStatsMap.get(name) || {
          total: 0,
          done: 0,
        };
        s.total++;
        if (task.status === "done") s.done++;
        assigneeStatsMap.set(name, s);
      }

      const assigneeEntries = [...assigneeStatsMap.entries()].sort(
        (a, b) => b[1].total - a[1].total,
      );
      for (let i = 0; i < assigneeEntries.length; i += 6) {
        const chunk = assigneeEntries.slice(i, i + 6);
        slides.push({
          kicker: "PERFORMANCE",
          title: "ความสำเร็จรายบุคคล",
          subtitle: `ผู้รับผิดชอบ ${assigneeEntries.length} คน (หน้า ${Math.floor(i / 6) + 1})`,
          accent: "#a78bff",
          lines: chunk.map(([name, s]) => {
            const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
            return `• ${name}: สำเร็จ ${pct}% (${s.done}/${s.total})`;
          }),
        });
      }

      const createTaskSlides = (
        tasks: Task[],
        kicker: string,
        title: string,
        accent: string,
        celebrate = false,
      ): VideoSlide[] => {
        if (tasks.length === 0)
          return [
            {
              kicker,
              title,
              subtitle: "0 รายการ",
              accent,
              lines: ["• ไม่มีงานในหมวดนี้"],
            },
          ];

        const pageSz = 6;
        const pages: VideoSlide[] = [];
        for (let i = 0; i < tasks.length; i += pageSz) {
          const chunk = tasks.slice(i, i + pageSz);
          pages.push({
            kicker,
            title,
            subtitle:
              tasks.length > pageSz
                ? `รายการที่ ${i + 1}-${Math.min(i + pageSz, tasks.length)} / ทั้งหมด ${tasks.length}`
                : `${tasks.length} รายการ`,
            accent,
            celebrate: celebrate && i === 0,
            lines: chunk.map(summarize),
          });
        }
        return pages;
      };

      slides.push(
        ...createTaskSlides(
          doneTasks,
          "DONE",
          "งานที่เสร็จแล้ว",
          "#64ffa8",
          true,
        ),
      );
      slides.push(
        ...createTaskSlides(
          inProgressTasks,
          "IN PROGRESS",
          "งานที่กำลังทำ",
          "#6ec7ff",
        ),
      );
      slides.push(
        ...createTaskSlides(todoTasks, "TODO", "งานรอดำเนินการ", "#ffd470"),
      );

      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        deps.notify(deps.t("page__export_video_canvas_error"), "error");
        return;
      }

      const fps = 30;
      const slideDuration = 2.8;
      const transitionDuration = 0.6;
      const totalDuration = slides.length * slideDuration;
      const totalFrames = Math.ceil(totalDuration * fps);
      const stream = canvas.captureStream(fps);
      const audioBed = createRoyaltyFreeAudioBed(totalDuration);
      if (audioBed) {
        stream.addTrack(audioBed.track);
      }
      const exportStart = performance.now();

      deps.setVideoExportState({
        inProgress: true,
        percent: 0,
        elapsedMs: 0,
        timer: setInterval(() => {
          const st = deps.getVideoExportState();
          deps.setVideoExportState({
            ...st,
            elapsedMs: performance.now() - exportStart,
          });
        }, 200),
      });

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : "video/webm";
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      const stopPromise = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.start();

      for (let frame = 0; frame < totalFrames; frame++) {
        const t = frame / fps;
        const slideIndex = Math.min(
          Math.floor(t / slideDuration),
          slides.length - 1,
        );
        const localT = t - slideIndex * slideDuration;
        const progress = Math.min(localT / slideDuration, 1);
        renderVideoSlide(
          ctx,
          canvas.width,
          canvas.height,
          slides[slideIndex],
          progress,
        );

        if (
          localT > slideDuration - transitionDuration &&
          slideIndex < slides.length - 1
        ) {
          const blend =
            (localT - (slideDuration - transitionDuration)) /
            transitionDuration;
          ctx.globalAlpha = Math.min(Math.max(blend, 0), 1);
          renderVideoSlide(
            ctx,
            canvas.width,
            canvas.height,
            slides[slideIndex + 1],
            0,
          );
          ctx.globalAlpha = 1;
        }
        const st = deps.getVideoExportState();
        const currentPercent = Math.min(
          100,
          Math.round(((frame + 1) / totalFrames) * 100),
        );

        deps.setVideoExportState({
          ...st,
          percent: currentPercent,
        });

        await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
      }

      await new Promise((resolve) => setTimeout(resolve, 120));
      recorder.stop();
      await stopPromise;
      audioBed?.stop();
      stream.getTracks().forEach((track) => track.stop());

      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timeStr = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
      link.href = url;
      link.download = `task_report_${reportDate}_${timeStr}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const st = deps.getVideoExportState();
      if (st.timer) clearInterval(st.timer);
      deps.setVideoExportState({
        inProgress: false,
        percent: 100,
        elapsedMs: performance.now() - exportStart,
        timer: null,
      });
      deps.notify(deps.t("page__export_video_success"));
    } catch (error) {
      console.error("Video export failed:", error);
      const st = deps.getVideoExportState();
      if (st.timer) clearInterval(st.timer);
      deps.setVideoExportState({
        ...st,
        inProgress: false,
        timer: null,
      });
      deps.notify(deps.t("page__export_video_error"), "error");
    }
  }

  async function handleExportSlide(
    event?: CustomEvent<number | void>,
    contextOverride?: { taskSnapshot: Task[]; scopeLabel: string },
  ) {
    try {
      const now = new Date();
      const reportDate = formatDateISO(now);
      const { taskSnapshot, scopeLabel } =
        contextOverride || (await getExportTaskContext(event));
      if (event?.detail && taskSnapshot.length === 0) {
        deps.notify(deps.t("page__export_slide_no_data"), "error");
        return;
      }
      if (taskSnapshot.length === 0) {
        deps.notify(deps.t("page__export_slide_no_data"), "error");
        return;
      }

      const doneTasks = sortTasksForReport(
        taskSnapshot.filter((task) => task.status === "done"),
      );
      const inProgressTasks = sortTasksForReport(
        taskSnapshot.filter((task) => task.status === "in-progress"),
      );
      const todoTasks = sortTasksForReport(
        taskSnapshot.filter((task) => task.status === "todo"),
      );
      const assigneeSummary = [
        ...taskSnapshot
          .reduce((acc, task) => {
            const key = task.assignee?.name || "ไม่ระบุผู้รับผิดชอบ";
            acc.set(key, (acc.get(key) || 0) + 1);
            return acc;
          }, new Map<string, number>())
          .entries(),
      ]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "Khun Phaen Task Tracker";
      pptx.subject = "Task report summary";
      pptx.title = `Task Report ${reportDate}`;

      const addTitle = (
        slide: PptxGenJS.Slide,
        title: string,
        subtitle: string,
      ) => {
        slide.background = { color: "0B1B34" };
        slide.addText(title, {
          x: 0.6,
          y: 0.5,
          w: 12,
          h: 0.8,
          fontFace: "Calibri",
          fontSize: 34,
          bold: true,
          color: "FFFFFF",
        });
        slide.addText(subtitle, {
          x: 0.6,
          y: 1.4,
          w: 12,
          h: 0.5,
          fontFace: "Calibri",
          fontSize: 16,
          color: "BFDBFE",
        });
      };

      const cover = pptx.addSlide();
      addTitle(cover, `Task Report - ${reportDate}`, scopeLabel);
      cover.addText(
        [
          {
            text: `งานทั้งหมด ${taskSnapshot.length} งาน\n`,
          },
          {
            text: `เสร็จแล้ว ${doneTasks.length} งาน\n`,
          },
          {
            text: `กำลังทำ ${inProgressTasks.length} งาน\n`,
          },
          {
            text: `รอดำเนินการ ${todoTasks.length} งาน`,
          },
        ],
        {
          x: 0.7,
          y: 2.3,
          w: 5.4,
          h: 2.2,
          fontFace: "Calibri",
          fontSize: 20,
          color: "E2E8F0",
          breakLine: true,
        },
      );

      const assigneeSlide = pptx.addSlide();
      addTitle(assigneeSlide, "Who Did What", "Top ผู้รับผิดชอบ");
      assigneeSummary.forEach((item, index) => {
        assigneeSlide.addText(
          `${index + 1}. ${item.name} - ${item.count} งาน`,
          {
            x: 0.8,
            y: 2 + index * 0.5,
            w: 11.5,
            h: 0.4,
            fontFace: "Calibri",
            fontSize: 20,
            color: "F8FAFC",
          },
        );
      });

      const taskLine = (task: Task) => {
        const assignee = task.assignee?.name || "ไม่ระบุ";
        const status =
          task.status === "done"
            ? "DONE"
            : task.status === "in-progress"
              ? "IN-PROGRESS"
              : "TODO";
        return `${task.title || "-"} (${assignee}) • ${status} • ${normalizeTaskDate(task.date)}`;
      };

      const addTaskSlide = (title: string, list: Task[]) => {
        const slide = pptx.addSlide();
        addTitle(slide, title, `${list.length} งาน`);
        const chunk = list.slice(0, 12);
        chunk.forEach((task, i) => {
          slide.addText(`• ${taskLine(task)}`, {
            x: 0.8,
            y: 2 + i * 0.42,
            w: 12,
            h: 0.35,
            fontFace: "Calibri",
            fontSize: 14,
            color: "E2E8F0",
          });
        });
        if (list.length === 0) {
          slide.addText("ไม่มีงานในหมวดนี้", {
            x: 0.8,
            y: 2.2,
            w: 8,
            h: 0.5,
            fontFace: "Calibri",
            fontSize: 18,
            color: "CBD5E1",
          });
        }
      };

      addTaskSlide("Done Tasks", doneTasks);
      addTaskSlide("In Progress Tasks", inProgressTasks);
      addTaskSlide("Todo Tasks", todoTasks);

      await pptx.writeFile({
        fileName: `task_report_${reportDate}_${formatExportTimestamp().split("_")[1]}.pptx`,
      });
      deps.notify(deps.t("page__export_slide_success"));
    } catch (error) {
      console.error("Slide export failed:", error);
      deps.notify(deps.t("page__export_slide_error"), "error");
    }
  }

  function handleExportPDF() {
    try {
      const taskSnapshot = [...deps.getTasks()];
      const totalMinutes = taskSnapshot.reduce(
        (sum, task) => sum + (task.duration_minutes || 0),
        0,
      );
      const totalTasks = taskSnapshot.length;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Noto Sans Thai', sans-serif; padding: 40px; font-size: 12px; line-height: 1.6; }
            .header { margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
            .header .meta { color: #666; font-size: 11px; }
            .stats { display: flex; gap: 30px; margin-bottom: 20px; font-size: 11px; }
            .stats .stat { background: #f5f5f5; padding: 10px 15px; border-radius: 5px; }
            .stats .stat-label { color: #666; font-size: 10px; }
            .stats .stat-value { font-weight: 600; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 11px; }
            th { background: #f5f5f5; font-weight: 600; }
            tr:nth-child(even) { background: #fafafa; }
            .status { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; }
            .status-done { background: #dcfce7; color: #166534; }
            .status-in-progress { background: #dbeafe; color: #1e40af; }
            .status-todo { background: #f3f4f6; color: #374151; }
            .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>รายงานงาน (Task Report)</h1>
            <div class="meta">
              สร้างเมื่อ: ${new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}<br>
              ระบบ: Khun Phaen Task Tracker
            </div>
          </div>
          <div class="stats">
            <div class="stat"><div class="stat-label">จำนวนงานทั้งหมด</div><div class="stat-value">${totalTasks} งาน</div></div>
            <div class="stat"><div class="stat-label">เวลารวม</div><div class="stat-value">${(totalMinutes / 60).toFixed(1)} ชั่วโมง</div></div>
            <div class="stat"><div class="stat-label">Man-days</div><div class="stat-value">${(totalMinutes / 60 / 8).toFixed(2)} วัน</div></div>
          </div>
          <table>
            <thead><tr>
              <th style="width:5%">#</th><th style="width:35%">ชื่องาน</th><th style="width:15%">โปรเจกต์</th>
              <th style="width:12%">หมวดหมู่</th><th style="width:10%">สถานะ</th><th style="width:13%">วันที่</th><th style="width:10%">เวลา</th>
            </tr></thead>
            <tbody>${taskSnapshot
              .map((task, i) => {
                const statusClass =
                  task.status === "done"
                    ? "status-done"
                    : task.status === "in-progress"
                      ? "status-in-progress"
                      : "status-todo";
                const statusText =
                  task.status === "done"
                    ? "เสร็จแล้ว"
                    : task.status === "in-progress"
                      ? "กำลังทำ"
                      : "รอดำเนินการ";
                const hours = Math.floor(task.duration_minutes / 60);
                const mins = task.duration_minutes % 60;
                const timeStr =
                  task.duration_minutes > 0
                    ? (hours > 0 ? `${hours}ชม ` : "") +
                      (mins > 0 ? `${mins}น` : "")
                    : "-";
                return `<tr><td>${i + 1}</td><td>${task.title}</td><td>${task.project || "-"}</td><td>${task.category || "อื่นๆ"}</td><td><span class="status ${statusClass}">${statusText}</span></td><td>${new Date(task.date).toLocaleDateString("th-TH")}</td><td>${timeStr}</td></tr>`;
              })
              .join("")}</tbody>
          </table>
          <div class="footer">© ${new Date().getFullYear()} Khun Phaen Task Tracker - สร้างด้วยความภาคภูมิใจ</div>
        </body>
        </html>`;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 1000);
        deps.notify(deps.t("page__export_pdf_success"));
      } else {
        deps.notify(deps.t("page__export_pdf_browser_not_supported"), "error");
      }
    } catch (e) {
      console.error("PDF Export Error:", e);
      deps.notify(deps.t("page__export_pdf_error"), "error");
    }
  }

  async function handleExportMonthlyPDF() {
    const context = getMonthlyExportTaskContext();
    if (context.taskSnapshot.length === 0) {
      deps.notify(deps.t("page__export_monthly_pdf_no_data"), "error");
      return;
    }
    try {
      const chartImages = await captureMonthlyChartImages();
      const chartsHtml =
        chartImages.length > 0
          ? `<div style="margin-top:20px; page-break-inside:avoid;">
              <h2 style="font-family:'Noto Sans Thai',sans-serif; font-size:16px; margin-bottom:10px;">กราฟวิเคราะห์ (30 วัน)</h2>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                ${chartImages
                  .map(
                    (item) => `
                  <div style="border:1px solid #e2e8f0; border-radius:10px; padding:8px;">
                    <div style="font-size:12px; color:#334155; margin-bottom:6px;">${item.title}</div>
                    <img src="${item.image}" style="width:100%; border-radius:8px;" />
                  </div>`,
                  )
                  .join("")}
              </div>
            </div>`
          : "";
      const htmlContent = `${buildTaskReportHtml(context.taskSnapshot, context.scopeLabel).replace("</body>", `${chartsHtml}</body>`)}`;
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 800);
        deps.notify(deps.t("page__export_monthly_pdf_success"));
      } else {
        deps.notify(
          deps.t("page__export_monthly_pdf_browser_not_supported"),
          "error",
        );
      }
    } catch (error) {
      console.error("Monthly PDF export failed:", error);
      deps.notify(deps.t("page__export_monthly_pdf_error"), "error");
    }
  }

  async function handleExportMonthlyXlsx() {
    const context = getMonthlyExportTaskContext();
    if (context.taskSnapshot.length === 0) {
      deps.notify(deps.t("page__export_monthly_xlsx_no_data"), "error");
      return;
    }
    try {
      const rows = context.taskSnapshot.map((task, index) => ({
        no: index + 1,
        title: task.title || "",
        project: task.project || "",
        assignee:
          task.assignees?.map((a) => a.name).join(", ") ||
          task.assignee?.name ||
          "",
        status: task.status,
        date: normalizeTaskDate(task.date),
        end_date: normalizeTaskDate(task.end_date),
        duration_minutes: task.duration_minutes || 0,
        is_archived: task.is_archived ? 1 : 0,
      }));
      const summaryRows = [
        { metric: "ช่วงข้อมูล", value: context.scopeLabel },
        {
          metric: "งานทั้งหมด",
          value: context.taskSnapshot.length,
        },
        {
          metric: "เสร็จแล้ว",
          value: context.taskSnapshot.filter((t) => t.status === "done").length,
        },
        {
          metric: "กำลังทำ",
          value: context.taskSnapshot.filter((t) => t.status === "in-progress")
            .length,
        },
        {
          metric: "รอดำเนินการ",
          value: context.taskSnapshot.filter((t) => t.status === "todo").length,
        },
        {
          metric: "Archived",
          value: context.taskSnapshot.filter((t) => t.is_archived).length,
        },
      ];
      const wb = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      const tasksSheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
      XLSX.utils.book_append_sheet(wb, tasksSheet, "Tasks");
      XLSX.writeFile(wb, `monthly_summary_${formatExportTimestamp()}.xlsx`);
      deps.notify(deps.t("page__export_monthly_xlsx_success"));
    } catch (error) {
      console.error("Monthly XLSX export failed:", error);
      deps.notify(deps.t("page__export_monthly_xlsx_error"), "error");
    }
  }

  async function handleExportMonthlyPng() {
    const context = getMonthlyExportTaskContext();
    if (context.taskSnapshot.length === 0) {
      deps.notify(deps.t("page__export_monthly_png_no_data"), "error");
      return;
    }
    const ref = deps.getMonthlySummaryRef();
    if (!ref) {
      deps.notify(deps.t("page__export_monthly_png_no_data"), "error");
      return;
    }
    try {
      const start = performance.now();
      deps.setVideoExportState({
        inProgress: true,
        percent: 0,
        elapsedMs: 0,
        timer: setInterval(() => {
          deps.setVideoExportState({
            ...deps.getVideoExportState(),
            elapsedMs: performance.now() - start,
          });
        }, 100),
      });

      // Give UI time to update
      await new Promise((r) => setTimeout(r, 100));

      deps.setVideoExportState({
        ...deps.getVideoExportState(),
        percent: 30,
      });

      const chartImages = await captureMonthlyChartImages();

      deps.setVideoExportState({
        ...deps.getVideoExportState(),
        percent: 70,
      });

      const dataUrl = await composeMonthlyReportImage(
        chartImages,
        deps.getMonthlySummary().periodLabel,
        context.taskSnapshot,
      );
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `monthly_summary_${formatExportTimestamp()}.png`;
      link.click();

      const st = deps.getVideoExportState();
      if (st.timer) clearInterval(st.timer);
      deps.setVideoExportState({
        ...st,
        inProgress: false,
        percent: 100,
        timer: null,
      });

      deps.notify(deps.t("page__export_monthly_png_success"));
    } catch (error) {
      console.error("Monthly PNG export failed:", error);
      const st = deps.getVideoExportState();
      if (st.timer) clearInterval(st.timer);
      deps.setVideoExportState({
        ...st,
        inProgress: false,
        timer: null,
      });
      deps.notify(deps.t("page__export_monthly_png_error"), "error");
    }
  }

  async function handleExportMonthlyVideo() {
    const context = getMonthlyExportTaskContext();
    if (context.taskSnapshot.length === 0) {
      deps.notify(deps.t("page__export_monthly_video_no_data"), "error");
      return;
    }
    // This one is very large - delegate to video with monthly context
    await handleExportVideo(undefined, context);
  }

  async function handleExportMonthlySlide() {
    const context = getMonthlyExportTaskContext();
    if (context.taskSnapshot.length === 0) {
      deps.notify(deps.t("page__export_monthly_slide_no_data"), "error");
      return;
    }
    await handleExportSlide(undefined, context);
  }

  async function handleCompleteAndExport(
    event: CustomEvent<{
      sprintId: string | number;
      format: "markdown" | "video";
    }>,
  ) {
    const { sprintId, format } = event.detail;
    const completed = await deps.handleCompleteSprint(
      new CustomEvent("complete", { detail: sprintId as number }),
    );
    if (!completed) return;
    if (format === "markdown") {
      await handleExportMarkdown(
        new CustomEvent("exportMarkdown", {
          detail: sprintId as number,
        }),
      );
    } else {
      await handleExportVideo(
        new CustomEvent("exportVideo", {
          detail: sprintId as number,
        }),
      );
    }
  }

  async function handleImportCSV(event: CustomEvent<string>) {
    try {
      console.log("📥 Starting import...");
      const beforeStats = await getStats();
      console.log("📊 Before import:", beforeStats);

      const result = await importAllData(event.detail, {
        clearExisting: false,
      });
      console.log("✅ Import result:", result);

      deps.setFilters({ ...DEFAULT_FILTERS });
      deps.setSearchInput("");
      clearSearch([]);

      await new Promise((r) => setTimeout(r, 100));
      await deps.loadData();

      const afterStats = await getStats();
      console.log("📊 After import:", afterStats);

      await sprints.refresh();

      const actualAdded = afterStats.total - beforeStats.total;
      deps.notify(
        deps.t("page__import_success", {
          values: {
            tasks: result.tasks,
            added: actualAdded,
            projects: result.projects,
            assignees: result.assignees,
            sprints: result.sprints,
          },
        }),
      );
      deps.trackRealtime("import-csv");
    } catch (e) {
      console.error("❌ Import error:", e);
      deps.notify(
        deps.t("page__import_error") +
          ": " +
          (e instanceof Error ? e.message : "Unknown error"),
        "error",
      );
    }
  }

  return {
    handleExportCSV,
    handleExportDatabase,
    handleExportMarkdown,
    handleExportVideo,
    handleExportSlide,
    handleExportPDF,
    handleExportMonthlyPDF,
    handleExportMonthlyXlsx,
    handleExportMonthlyPng,
    handleExportMonthlyVideo,
    handleExportMonthlySlide,
    handleCompleteAndExport,
    handleImportCSV,
    getFilteredExportContext,
    getExportTaskContext,
    getMonthlyExportTaskContext,
    captureMonthlyChartImages,
    formatElapsedTime,
  };
}
