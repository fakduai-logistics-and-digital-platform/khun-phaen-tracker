export const WORKER_COLOR_OPTIONS = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#FACC15",
  "#84CC16",
  "#22C55E",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
  "#0EA5E9",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
  "#64748B",
  "#475569",
  "#7C3AED",
  "#DB2777",
  "#059669",
  "#2563EB",
];

export const DEFAULT_WORKER_COLOR = "#6366F1";

function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/** Random vivid color: hue 0-360, saturation 65-85%, lightness 45-55%. */
export function getRandomWorkerColor() {
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(Math.random() * 20) + 65;
  const l = Math.floor(Math.random() * 10) + 45;
  return hslToHex(h, s, l);
}
