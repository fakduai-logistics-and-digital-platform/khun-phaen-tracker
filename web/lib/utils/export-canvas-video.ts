import type { Task } from "@/lib/types";
import { normalizeTaskDate } from "./export-report";

export interface VideoSlide {
  kicker: string;
  title: string;
  subtitle: string;
  accent: string;
  lines: string[];
  celebrate?: boolean;
  /** Spoken text for this slide; the slide lasts as long as its narration. */
  narration?: string;
  stats?: { label: string; value: string; color: string }[];
  bars?: { label: string; pct: number; detail: string }[];
  hero?: { value: string; caption: string };
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

const VIDEO_FONT = '"Noto Sans Thai", "Sarabun", system-ui, sans-serif';

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const span = (progress: number, from: number, to: number) => Math.min(Math.max((progress - from) / (to - from), 0), 1);

/** Wraps on spaces, then on characters, so unspaced Thai text never runs past `maxWidth`. */
function fitLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const char of text) {
    const next = current + char;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current.trimEnd());
      current = char === " " ? "" : char;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/.{1}$/, "")}…`;
    return kept;
  }
  return lines;
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, accent: string, t: number) {
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#070b18");
  bg.addColorStop(1, "#101830");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const blobs = [
    { x: 0.82 + Math.sin(t * Math.PI * 2) * 0.03, y: 0.12, r: 460, color: accent, alpha: 0.35 },
    { x: 0.1, y: 0.95 + Math.cos(t * Math.PI * 2) * 0.03, r: 420, color: "#6366f1", alpha: 0.22 },
  ];
  for (const blob of blobs) {
    const g = ctx.createRadialGradient(blob.x * width, blob.y * height, 20, blob.x * width, blob.y * height, blob.r);
    g.addColorStop(
      0,
      `${blob.color}${Math.round(blob.alpha * 255)
        .toString(16)
        .padStart(2, "0")}`,
    );
    g.addColorStop(1, "#00000000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.fillStyle = "#ffffff14";
  for (let x = 40; x < width; x += 48) {
    for (let y = 40; y < height; y += 48) ctx.fillRect(x, y, 1.5, 1.5);
  }
}

export interface VideoSlideMeta {
  index: number;
  total: number;
  /** Position of the whole video, 0 to 1, drawn as a thin progress bar. */
  overall: number;
}

export function renderVideoSlide(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  slide: VideoSlide,
  progress: number,
  meta?: VideoSlideMeta,
): void {
  drawBackground(ctx, width, height, slide.accent, progress);

  const cardX = 72;
  const cardY = 64;
  const cardW = width - 144;
  const cardH = height - 128;
  const pad = 52;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.fillStyle = "#ffffff0d";
  ctx.fill();
  ctx.strokeStyle = "#ffffff1f";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (slide.celebrate) {
    drawCelebrationFireworks(ctx, width, height, progress, slide.accent, `${slide.kicker}-${slide.title}`);
  }

  const head = easeOut(span(progress, 0, 0.18));
  ctx.save();
  ctx.globalAlpha = head;
  ctx.translate(0, (1 - head) * 14);

  ctx.font = `600 20px ${VIDEO_FONT}`;
  const pillW = ctx.measureText(slide.kicker).width + 52;
  drawRoundedRect(ctx, cardX + pad, cardY + 40, pillW, 38, 19);
  ctx.fillStyle = `${slide.accent}26`;
  ctx.fill();
  ctx.fillStyle = slide.accent;
  ctx.beginPath();
  ctx.arc(cardX + pad + 20, cardY + 59, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText(slide.kicker, cardX + pad + 36, cardY + 66);

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff99";
  ctx.font = `600 22px ${VIDEO_FONT}`;
  ctx.fillText("Khun Phaen", cardX + cardW - pad, cardY + 66);
  ctx.textAlign = "left";

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 54px ${VIDEO_FONT}`;
  ctx.fillText(fitLines(ctx, slide.title, cardW - pad * 2, 1)[0], cardX + pad, cardY + 150);
  ctx.fillStyle = "#ffffffa6";
  ctx.font = `400 26px ${VIDEO_FONT}`;
  ctx.fillText(fitLines(ctx, slide.subtitle, cardW - pad * 2, 1)[0], cardX + pad, cardY + 196);
  ctx.restore();

  const bodyX = cardX + pad;
  const bodyY = cardY + 250;
  const bodyW = cardW - pad * 2;
  const bodyBottom = cardY + cardH - 72;

  if (slide.stats?.length) {
    const gap = 20;
    const tileW = (bodyW - gap * (slide.stats.length - 1)) / slide.stats.length;
    slide.stats.forEach((stat, i) => {
      const enter = easeOut(span(progress, 0.12 + i * 0.07, 0.4 + i * 0.07));
      const x = bodyX + i * (tileW + gap);
      const y = bodyY + (1 - enter) * 24;
      ctx.save();
      ctx.globalAlpha = enter;
      drawRoundedRect(ctx, x, y, tileW, 190, 22);
      ctx.fillStyle = "#ffffff0f";
      ctx.fill();
      ctx.strokeStyle = `${stat.color}55`;
      ctx.stroke();
      const numeric = Number(stat.value);
      const shown = Number.isFinite(numeric) ? String(Math.round(numeric * enter)) : stat.value;
      ctx.fillStyle = stat.color;
      ctx.font = `700 76px ${VIDEO_FONT}`;
      ctx.fillText(shown, x + 28, y + 108);
      ctx.fillStyle = "#ffffffb3";
      ctx.font = `500 24px ${VIDEO_FONT}`;
      ctx.fillText(stat.label, x + 28, y + 154);
      ctx.restore();
    });
  } else if (slide.hero) {
    const enter = easeOut(span(progress, 0.1, 0.5));
    ctx.save();
    ctx.globalAlpha = enter;
    const numeric = Number.parseFloat(slide.hero.value);
    const shown = Number.isFinite(numeric) ? `${Math.round(numeric * enter)}%` : slide.hero.value;
    ctx.fillStyle = slide.accent;
    ctx.font = `700 150px ${VIDEO_FONT}`;
    ctx.fillText(shown, bodyX, bodyY + 130);
    ctx.fillStyle = "#ffffffb3";
    ctx.font = `500 30px ${VIDEO_FONT}`;
    ctx.fillText(slide.hero.caption, bodyX, bodyY + 190);
    drawRoundedRect(ctx, bodyX, bodyY + 230, bodyW, 14, 7);
    ctx.fillStyle = "#ffffff1a";
    ctx.fill();
    drawRoundedRect(
      ctx,
      bodyX,
      bodyY + 230,
      Math.max(14, bodyW * ((Number.isFinite(numeric) ? numeric : 0) / 100) * enter),
      14,
      7,
    );
    ctx.fillStyle = slide.accent;
    ctx.fill();
    ctx.restore();
  } else if (slide.bars?.length) {
    const rowH = Math.min(78, (bodyBottom - bodyY) / slide.bars.length);
    slide.bars.forEach((bar, i) => {
      const enter = easeOut(span(progress, 0.1 + i * 0.06, 0.5 + i * 0.06));
      const y = bodyY + i * rowH;
      ctx.save();
      ctx.globalAlpha = enter;
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 28px ${VIDEO_FONT}`;
      ctx.fillText(fitLines(ctx, bar.label, 300, 1)[0], bodyX, y + 30);
      ctx.fillStyle = "#ffffff8c";
      ctx.font = `400 21px ${VIDEO_FONT}`;
      ctx.fillText(bar.detail, bodyX, y + 58);
      const trackX = bodyX + 340;
      const trackW = bodyW - 340 - 110;
      drawRoundedRect(ctx, trackX, y + 14, trackW, 16, 8);
      ctx.fillStyle = "#ffffff1a";
      ctx.fill();
      drawRoundedRect(ctx, trackX, y + 14, Math.max(16, trackW * (bar.pct / 100) * enter), 16, 8);
      ctx.fillStyle = slide.accent;
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 28px ${VIDEO_FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(bar.pct * enter)}%`, bodyX + bodyW, y + 32);
      ctx.textAlign = "left";
      ctx.restore();
    });
  } else {
    let y = bodyY;
    const count = Math.min(slide.lines.length, 8);
    for (let i = 0; i < count; i++) {
      const enter = easeOut(span(progress, 0.1 + i * 0.05, 0.4 + i * 0.05));
      ctx.save();
      ctx.globalAlpha = enter;
      ctx.translate((1 - enter) * 28, 0);
      ctx.font = `500 30px ${VIDEO_FONT}`;
      const lines = fitLines(ctx, slide.lines[i].replace(/^•\s*/, ""), bodyW - 40, 2);
      ctx.fillStyle = slide.accent;
      ctx.beginPath();
      ctx.arc(bodyX + 8, y - 10, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffffeb";
      for (const line of lines) {
        ctx.fillText(line, bodyX + 40, y);
        y += 40;
      }
      ctx.restore();
      y += 10;
      if (y > bodyBottom) break;
    }
  }

  if (meta) {
    ctx.fillStyle = "#ffffff80";
    ctx.font = `500 20px ${VIDEO_FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(
      `${String(meta.index + 1).padStart(2, "0")} / ${String(meta.total).padStart(2, "0")}`,
      cardX + cardW - pad,
      cardY + cardH - 30,
    );
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff1a";
    ctx.fillRect(cardX + pad, cardY + cardH - 14, cardW - pad * 2, 4);
    ctx.fillStyle = slide.accent;
    ctx.fillRect(cardX + pad, cardY + cardH - 14, (cardW - pad * 2) * Math.min(Math.max(meta.overall, 0), 1), 4);
  }
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
