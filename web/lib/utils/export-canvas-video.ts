import type { Task } from "@/lib/types";
import { normalizeTaskDate } from "./export-report";

export interface VideoSlide {
  kicker: string;
  title: string;
  subtitle: string;
  accent: string;
  lines: string[];
  celebrate?: boolean;
}

export type ExportAudioBed = {
  track: MediaStreamTrack;
  stop: () => void;
};

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

export function seededValue(seed: string, index: number): number {
  let h = 2166136261;
  const source = `${seed}:${index}`;
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function drawCelebrationFireworks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  accent: string,
  seedKey: string,
): void {
  const bloom = Math.min(Math.max((progress - 0.15) / 0.7, 0), 1);
  if (bloom <= 0.01) return;

  const bursts = 4;
  for (let i = 0; i < bursts; i++) {
    const burstDelay = i * 0.16;
    const burstProgress = Math.min(Math.max((progress - burstDelay) / 0.55, 0), 1);
    if (burstProgress <= 0 || burstProgress >= 1) continue;

    const originX = width * (0.18 + seededValue(seedKey, i * 5 + 1) * 0.64);
    const originY = height * (0.14 + seededValue(seedKey, i * 5 + 2) * 0.32);
    const radius = 26 + burstProgress * 150;
    const particleCount = 20;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let p = 0; p < particleCount; p++) {
      const baseAngle = (Math.PI * 2 * p) / particleCount;
      const wobble = (seededValue(seedKey, i * 100 + p) - 0.5) * 0.25;
      const angle = baseAngle + wobble;
      const x = originX + Math.cos(angle) * radius;
      const y = originY + Math.sin(angle) * radius;
      const particleRadius = 1.5 + (1 - burstProgress) * 3;
      ctx.globalAlpha = (1 - burstProgress) * (0.35 + seededValue(seedKey, i * 100 + p + 33) * 0.65);
      ctx.fillStyle = p % 3 === 0 ? accent : p % 2 === 0 ? "#ffe082" : "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, particleRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.08 + bloom * 0.22;
  const glow = ctx.createRadialGradient(width * 0.5, height * 0.22, 30, width * 0.5, height * 0.22, width * 0.45);
  glow.addColorStop(0, accent);
  glow.addColorStop(1, "#00000000");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height * 0.7);
  ctx.restore();
}

export function renderVideoSlide(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  slide: VideoSlide,
  progress: number,
): void {
  const reveal = Math.min(Math.max(progress / 0.6, 0), 1);
  const sway = Math.sin(progress * Math.PI * 2) * 6;
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#041228");
  bg.addColorStop(0.6, "#0f2347");
  bg.addColorStop(1, "#091735");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const orb = ctx.createRadialGradient(width * 0.8, height * 0.15, 40, width * 0.8, height * 0.15, 380);
  orb.addColorStop(0, `${slide.accent}AA`);
  orb.addColorStop(1, "#00000000");
  ctx.fillStyle = orb;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 36; i++) {
    const x = width * seededValue(slide.title, i * 2 + 1);
    const y = height * seededValue(slide.title, i * 2 + 2);
    const twinkle = 1.3 + Math.sin(progress * Math.PI * 6 + i) * 0.9;
    ctx.fillStyle = "#dbeafe";
    ctx.fillRect(x, y, twinkle, twinkle);
  }

  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = "#ffffff22";
  for (let i = 0; i < 10; i++) {
    const y = 80 + i * 64 + sway;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const cardX = 84;
  const cardY = 92;
  const cardW = width - 168;
  const cardH = height - 184;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fillStyle = "#0b1f3ecc";
  ctx.fill();
  ctx.strokeStyle = "#ffffff2a";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (slide.celebrate) {
    drawCelebrationFireworks(ctx, width, height, progress, slide.accent, `${slide.kicker}-${slide.title}`);
  }

  ctx.fillStyle = slide.accent;
  ctx.font = '700 24px "Trebuchet MS", "Noto Sans Thai", sans-serif';
  ctx.fillText(slide.kicker, cardX + 46, cardY + 54);

  ctx.fillStyle = "#ffffff";
  ctx.font = '700 58px "Trebuchet MS", "Noto Sans Thai", sans-serif';
  ctx.globalAlpha = reveal;
  ctx.fillText(slide.title, cardX + 46, cardY + 132);
  ctx.globalAlpha = 0.92 * reveal;
  ctx.font = '400 27px "Trebuchet MS", "Noto Sans Thai", sans-serif';
  ctx.fillStyle = "#d8e7ff";
  ctx.fillText(slide.subtitle, cardX + 46, cardY + 174);

  ctx.globalAlpha = reveal;
  ctx.font = '500 30px "Trebuchet MS", "Noto Sans Thai", sans-serif';
  ctx.fillStyle = "#ecf2ff";
  let y = cardY + 250;
  for (const line of slide.lines.slice(0, 8)) {
    ctx.fillStyle = "#8cc8ff";
    ctx.font = '700 20px "Trebuchet MS", "Noto Sans Thai", sans-serif';
    ctx.fillText("*", cardX + 52, y);
    ctx.fillStyle = "#ecf2ff";
    ctx.font = '500 30px "Trebuchet MS", "Noto Sans Thai", sans-serif';
    const wrapped = wrapText(ctx, line, cardW - 96);
    for (const part of wrapped.slice(0, 2)) {
      ctx.fillText(part, cardX + 88, y);
      y += 40;
    }
    y += 8;
    if (y > cardY + cardH - 40) break;
  }
  ctx.globalAlpha = 1;
}

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function composeMonthlyReportImage(
  charts: Array<{ title: string; image: string }>,
  periodLabel: string,
  taskSnapshot: Task[],
): Promise<string> {
  const loaded = await Promise.all(charts.map(async (chart) => ({ ...chart, img: await loadImage(chart.image) })));
  const doneTasks = taskSnapshot.filter((task) => task.status === "done");
  const inProgressTasks = taskSnapshot.filter((task) => task.status === "in-progress");
  const todoTasks = taskSnapshot.filter((task) => task.status === "todo");
  const archivedTasks = taskSnapshot.filter((task) => task.is_archived);
  const assigneeSummary = [
    ...taskSnapshot
      .reduce((acc, task) => {
        const name = task.assignee?.name || "ไม่ระบุผู้รับผิดชอบ";
        const item = acc.get(name) || { name, total: 0, done: 0, inProgress: 0, todo: 0 };
        item.total += 1;
        if (task.status === "done") item.done += 1;
        else if (task.status === "in-progress") item.inProgress += 1;
        else item.todo += 1;
        acc.set(name, item);
        return acc;
      }, new Map<string, { name: string; total: number; done: number; inProgress: number; todo: number }>())
      .values(),
  ]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const keyTasks = [...taskSnapshot]
    .sort((a, b) => normalizeTaskDate(b.date).localeCompare(normalizeTaskDate(a.date)))
    .slice(0, 8);

  const cols = 2;
  const rows = Math.max(1, Math.ceil(Math.max(1, loaded.length) / cols));
  const cellWidth = 900;
  const cellHeight = 560;
  const gap = 24;
  const headerHeight = 580;
  const padding = 32;

  const width = padding * 2 + cols * cellWidth + (cols - 1) * gap;
  const height = padding * 2 + headerHeight + rows * cellHeight + (rows - 1) * gap;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Cannot create canvas context");

  // Background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f8fafc");
  gradient.addColorStop(1, "#e2e8f0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = "#0f172a";
  ctx.font = '700 52px "Noto Sans Thai", sans-serif';
  ctx.fillText("Monthly Performance Report", padding, padding + 52);
  ctx.fillStyle = "#334155";
  ctx.font = '400 30px "Noto Sans Thai", sans-serif';
  ctx.fillText(periodLabel, padding, padding + 98);

  const statsY = padding + 126;
  const statCards = [
    { label: "งานทั้งหมด", value: `${taskSnapshot.length}`, color: "#0f172a" },
    { label: "เสร็จแล้ว", value: `${doneTasks.length}`, color: "#16a34a" },
    { label: "กำลังทำ", value: `${inProgressTasks.length}`, color: "#2563eb" },
    { label: "รอดำเนินการ", value: `${todoTasks.length}`, color: "#d97706" },
    { label: "Archived", value: `${archivedTasks.length}`, color: "#475569" },
  ];
  statCards.forEach((card, i) => {
    const cardW = 350;
    const cardX = padding + i * (cardW + 12);
    drawRoundedRect(ctx, cardX, statsY, cardW, 110, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.font = '600 21px "Noto Sans Thai", sans-serif';
    ctx.fillText(card.label, cardX + 16, statsY + 38);
    ctx.fillStyle = card.color;
    ctx.font = '700 42px "Noto Sans Thai", sans-serif';
    ctx.fillText(card.value, cardX + 16, statsY + 86);
  });

  const summaryBoxY = statsY + 130;
  drawRoundedRect(ctx, padding, summaryBoxY, width - padding * 2, 190, 18);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.font = '700 26px "Noto Sans Thai", sans-serif';
  ctx.fillText("ใครทำอะไรบ้าง (Top 5)", padding + 18, summaryBoxY + 36);
  ctx.fillStyle = "#334155";
  ctx.font = '500 20px "Noto Sans Thai", sans-serif';
  assigneeSummary.forEach((person, idx) => {
    const personY = summaryBoxY + 70 + idx * 24;
    ctx.fillText(
      `${idx + 1}. ${person.name} • รวม ${person.total} • เสร็จ ${person.done} • กำลังทำ ${person.inProgress} • รอดำเนินการ ${person.todo}`,
      padding + 24,
      personY,
    );
  });

  const taskBoxY = summaryBoxY + 206;
  drawRoundedRect(ctx, padding, taskBoxY, width - padding * 2, 180, 18);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.font = '700 26px "Noto Sans Thai", sans-serif';
  ctx.fillText("รายการงานล่าสุด", padding + 18, taskBoxY + 36);
  ctx.font = '500 18px "Noto Sans Thai", sans-serif';
  keyTasks.slice(0, 6).forEach((task, idx) => {
    const assignee = task.assignee?.name || "ไม่ระบุ";
    const line = `${idx + 1}. ${task.title || "-"} (${assignee}) • ${normalizeTaskDate(task.date)}`;
    const taskY = taskBoxY + 66 + idx * 20;
    const wrapped = wrapText(ctx, line, width - padding * 2 - 30);
    ctx.fillText(wrapped[0], padding + 24, taskY);
  });

  loaded.forEach((item, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = padding + col * (cellWidth + gap);
    const chartY = padding + headerHeight + row * (cellHeight + gap);

    // Card
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, chartY, cellWidth, cellHeight, 18);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = "#1e293b";
    ctx.font = '700 28px "Noto Sans Thai", sans-serif';
    ctx.fillText(item.title, x + 18, chartY + 42);

    // Image
    const imageX = x + 16;
    const imageY = chartY + 56;
    const imageW = cellWidth - 32;
    const imageH = cellHeight - 72;
    ctx.drawImage(item.img, imageX, imageY, imageW, imageH);
  });

  if (loaded.length === 0) {
    drawRoundedRect(ctx, padding, padding + headerHeight, width - padding * 2, 220, 18);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.font = '700 34px "Noto Sans Thai", sans-serif';
    ctx.fillText("ไม่มีกราฟในช่วงข้อมูลนี้", padding + 24, padding + headerHeight + 84);
  }

  return canvas.toDataURL("image/png");
}

export function createRoyaltyFreeAudioBed(totalDuration: number): ExportAudioBed | null {
  try {
    const AudioCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    const audioContext = new AudioCtor();
    const destination = audioContext.createMediaStreamDestination();
    const master = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const limiter = audioContext.createDynamicsCompressor();

    filter.type = "lowpass";
    filter.frequency.value = 1500;
    limiter.threshold.value = -20;
    limiter.knee.value = 24;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    master.gain.value = 0.3;

    master.connect(filter);
    filter.connect(limiter);
    limiter.connect(destination);

    const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    const startAt = audioContext.currentTime + 0.05;
    const beat = 0.5;
    const totalBeats = Math.max(1, Math.floor(totalDuration / beat));
    for (let i = 0; i < totalBeats; i++) {
      const t = startAt + i * beat;
      const leadFreq = notes[i % notes.length];
      const bassFreq = notes[(i + 3) % notes.length] / 2;

      const lead = audioContext.createOscillator();
      lead.type = "triangle";
      lead.frequency.setValueAtTime(leadFreq, t);
      const leadGain = audioContext.createGain();
      leadGain.gain.setValueAtTime(0.0001, t);
      leadGain.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
      leadGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      lead.connect(leadGain);
      leadGain.connect(master);
      lead.start(t);
      lead.stop(t + 0.45);

      const bass = audioContext.createOscillator();
      bass.type = "sine";
      bass.frequency.setValueAtTime(bassFreq, t);
      const bassGain = audioContext.createGain();
      bassGain.gain.setValueAtTime(0.0001, t);
      bassGain.gain.exponentialRampToValueAtTime(0.055, t + 0.03);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
      bass.connect(bassGain);
      bassGain.connect(master);
      bass.start(t);
      bass.stop(t + 0.5);
    }

    const endAt = startAt + totalBeats * beat + 0.2;
    const stop = () => {
      try {
        audioContext.suspend().catch(() => undefined);
        audioContext.close().catch(() => undefined);
      } catch {
        // Ignore close failures because video export can still finish without audio cleanup.
      }
    };
    window.setTimeout(stop, Math.max(1000, Math.ceil((endAt - audioContext.currentTime) * 1000) + 300));

    const [track] = destination.stream.getAudioTracks();
    if (!track) {
      stop();
      return null;
    }
    return { track, stop };
  } catch {
    return null;
  }
}
