import { api } from "@/lib/api/apis";
import type { Task } from "@/lib/types";
import { renderVideoSlide, type VideoSlide } from "./export-canvas-video";

const FPS = 30;
export const MIN_SLIDE_SECONDS = 3.2;
/** Silence kept before and after each spoken slide so the voice never touches the transition. */
const NARRATION_PADDING = 0.9;
const TRANSITION_SECONDS = 0.6;
const PAGE_SIZE = 6;
const MAX_SPOKEN_TITLES = 3;

type ReportInput = {
  reportDate: string;
  scopeLabel: string;
  tasks: Task[];
  done: Task[];
  inProgress: Task[];
  todo: Task[];
  summarize: (task: Task) => string;
  title: (task: Task) => string;
};

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

function spokenTitles(tasks: Task[], title: (task: Task) => string) {
  const named = tasks.slice(0, MAX_SPOKEN_TITLES).map(title).join(", ");
  const rest = tasks.length - MAX_SPOKEN_TITLES;
  return rest > 0 ? `${named} และอีก ${rest} รายการ` : named;
}

/** Slides for the report video, each with the sentence a narrator reads over it. */
export function buildReportSlides(input: ReportInput): VideoSlide[] {
  const { reportDate, scopeLabel, tasks, done, inProgress, todo, summarize, title } = input;
  const slides: VideoSlide[] = [];

  slides.push({
    kicker: "TASK REPORT",
    title: `รายงานงาน ${reportDate}`,
    subtitle: `ช่วงข้อมูล ${scopeLabel}`,
    accent: "#38bdf8",
    lines: [],
    stats: [
      { label: "งานทั้งหมด", value: String(tasks.length), color: "#e2e8f0" },
      { label: "เสร็จแล้ว", value: String(done.length), color: "#4ade80" },
      { label: "กำลังทำ", value: String(inProgress.length), color: "#60a5fa" },
      { label: "รอดำเนินการ", value: String(todo.length), color: "#fbbf24" },
    ],
    narration: `สวัสดีครับ นี่คือรายงานงานประจำวันที่ ${reportDate} ช่วงข้อมูล ${scopeLabel} มีงานทั้งหมด ${tasks.length} งาน เสร็จแล้ว ${done.length} งาน กำลังทำ ${inProgress.length} งาน และรอดำเนินการ ${todo.length} งาน`,
  });

  const byAssignee = new Map<string, { total: number; done: number }>();
  for (const task of tasks) {
    const names = task.assignees?.length ? task.assignees.map((a) => a.name) : [task.assignee?.name || "ไม่ระบุ"];
    for (const name of names) {
      const entry = byAssignee.get(name) || { total: 0, done: 0 };
      entry.total++;
      if (task.status === "done") entry.done++;
      byAssignee.set(name, entry);
    }
  }
  const people = [...byAssignee.entries()].sort((a, b) => b[1].total - a[1].total);
  for (let i = 0; i < people.length; i += PAGE_SIZE) {
    const chunk = people.slice(i, i + PAGE_SIZE);
    slides.push({
      kicker: "PERFORMANCE",
      title: "ความสำเร็จรายบุคคล",
      subtitle: `ผู้รับผิดชอบ ${people.length} คน${people.length > PAGE_SIZE ? ` (หน้า ${Math.floor(i / PAGE_SIZE) + 1})` : ""}`,
      accent: "#a78bfa",
      lines: [],
      bars: chunk.map(([name, s]) => ({
        label: name,
        pct: percent(s.done, s.total),
        detail: `เสร็จ ${s.done} จาก ${s.total} งาน`,
      })),
      narration: `ความสำเร็จรายบุคคล ${chunk
        .slice(0, 4)
        .map(([name, s]) => `${name} ทำสำเร็จ ${percent(s.done, s.total)} เปอร์เซ็นต์ จาก ${s.total} งาน`)
        .join(" ")}`,
    });
  }

  const section = (list: Task[], kicker: string, heading: string, accent: string, noun: string, celebrate = false) => {
    if (list.length === 0) {
      slides.push({
        kicker,
        title: heading,
        subtitle: "0 รายการ",
        accent,
        lines: ["ไม่มีงานในหมวดนี้"],
        narration: `${heading} ไม่มีงานในหมวดนี้`,
      });
      return;
    }
    for (let i = 0; i < list.length; i += PAGE_SIZE) {
      const chunk = list.slice(i, i + PAGE_SIZE);
      slides.push({
        kicker,
        title: heading,
        subtitle:
          list.length > PAGE_SIZE
            ? `รายการที่ ${i + 1}-${Math.min(i + PAGE_SIZE, list.length)} จากทั้งหมด ${list.length}`
            : `${list.length} รายการ`,
        accent,
        celebrate: celebrate && i === 0,
        lines: chunk.map(summarize),
        narration:
          i === 0
            ? `${heading} มี ${list.length} รายการ ${noun} ${spokenTitles(chunk, title)}`
            : `${heading} ต่อ ${spokenTitles(chunk, title)}`,
      });
    }
  };
  section(done, "DONE", "งานที่เสร็จแล้ว", "#4ade80", "ได้แก่", true);
  section(inProgress, "IN PROGRESS", "งานที่กำลังทำ", "#60a5fa", "เช่น");
  section(todo, "TODO", "งานรอดำเนินการ", "#fbbf24", "เช่น");

  const rate = percent(done.length, tasks.length);
  slides.push({
    kicker: "SUMMARY",
    title: "ภาพรวมความคืบหน้า",
    subtitle: `เสร็จแล้ว ${done.length} จาก ${tasks.length} งาน`,
    accent: "#34d399",
    lines: [],
    hero: { value: `${rate}`, caption: "ของงานทั้งหมดเสร็จเรียบร้อย" },
    narration: `สรุปภาพรวม งานเสร็จแล้ว ${rate} เปอร์เซ็นต์ ขอบคุณที่รับชมครับ`,
  });

  return slides;
}

/** One decoded voice clip per slide, or null for a slide whose clip could not be made. */
export async function narrateSlides(
  workspaceId: string,
  slides: VideoSlide[],
  context: AudioContext,
  onProgress: (done: number, total: number) => void,
): Promise<(AudioBuffer | null)[]> {
  const clips: (AudioBuffer | null)[] = new Array(slides.length).fill(null);
  let finished = 0;
  let next = 0;
  let failures = 0;

  async function worker() {
    while (next < slides.length && failures < 2) {
      const index = next++;
      const text = slides[index].narration?.trim();
      try {
        if (!text) continue;
        const res = await api.data.ai.textToSpeech(workspaceId, text);
        if (!res.ok) throw new Error(`TTS ${res.status}`);
        clips[index] = await context.decodeAudioData(await res.arrayBuffer());
      } catch {
        failures++;
      } finally {
        onProgress(++finished, slides.length);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  // A provider that fails repeatedly is treated as unavailable; a half-narrated video would be worse than none.
  return failures >= 2 ? slides.map(() => null) : clips;
}

export type RecordedReport = { blob: Blob; mimeType: string; narrated: boolean };

/**
 * Records the slides to WebM. Each slide lasts as long as its voice clip, and the clips are scheduled on the
 * recorder's audio track at the matching start time, so picture and voice stay in sync.
 */
export async function recordReportVideo(options: {
  slides: VideoSlide[];
  clips: (AudioBuffer | null)[];
  context: AudioContext;
  bed: { track: MediaStreamTrack; stop: () => void } | null;
  onProgress: (percent: number) => void;
}): Promise<RecordedReport> {
  const { slides, clips, context, bed, onProgress } = options;
  const narrated = clips.some(Boolean);
  const durations = slides.map((_, i) => {
    const clip = clips[i];
    return clip ? Math.max(MIN_SLIDE_SECONDS, clip.duration + NARRATION_PADDING * 2) : MIN_SLIDE_SECONDS;
  });
  const starts = durations.map((_, i) => durations.slice(0, i).reduce((sum, d) => sum + d, 0));
  const total = durations.reduce((sum, d) => sum + d, 0);

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  const stream = canvas.captureStream(FPS);
  const destination = context.createMediaStreamDestination();
  destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
  if (!narrated && bed) stream.addTrack(bed.track);

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  await context.resume();
  recorder.start();
  const origin = context.currentTime + 0.15;
  clips.forEach((clip, i) => {
    if (!clip) return;
    const source = context.createBufferSource();
    source.buffer = clip;
    source.connect(destination);
    source.start(origin + starts[i] + NARRATION_PADDING);
  });

  const clock = performance.now() + 150;
  for (;;) {
    const t = Math.max(0, (performance.now() - clock) / 1000);
    if (t >= total) break;
    const index = Math.min(
      starts.findLastIndex((start) => start <= t),
      slides.length - 1,
    );
    const local = t - starts[index];
    const meta = (i: number) => ({ index: i, total: slides.length, overall: t / total });
    renderVideoSlide(
      ctx,
      canvas.width,
      canvas.height,
      slides[index],
      Math.min(local / durations[index], 1),
      meta(index),
    );
    const untilNext = durations[index] - local;
    if (untilNext < TRANSITION_SECONDS && index < slides.length - 1) {
      ctx.globalAlpha = 1 - untilNext / TRANSITION_SECONDS;
      renderVideoSlide(ctx, canvas.width, canvas.height, slides[index + 1], 0, meta(index + 1));
      ctx.globalAlpha = 1;
    }
    onProgress(Math.min(99, Math.round((t / total) * 100)));
    await new Promise((resolve) => setTimeout(resolve, 1000 / FPS));
  }

  await new Promise((resolve) => setTimeout(resolve, 200));
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  return { blob: new Blob(chunks, { type: mimeType }), mimeType, narrated };
}
