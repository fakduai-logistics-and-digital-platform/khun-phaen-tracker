import { API_BASE_URL } from "@/lib/api/apis";

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(sizeBytes: number) {
  let value = Math.max(0, sizeBytes);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const fractionDigits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fractionDigits)} ${UNITS[unitIndex]}`;
}

export function formatStorageSize(sizeGb: number) {
  return formatBytes(Math.max(0, sizeGb) * 1024 * 1024 * 1024);
}

export function formatTimestamp(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale || undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function buildFileUrl(key: string) {
  return `${API_BASE_URL}/files/${encodeURIComponent(key)}`;
}

export function isImageFile(key: string) {
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(key);
}

export function isVideoFile(key: string) {
  return /\.(m3u8|mp4|m4v|mov|webm|ogv|ogg|ts|m2ts|mts|avi|mkv)$/i.test(key);
}

export function formatStorageKeyLabel(key: string, maxLength = 48) {
  if (!key || key.length <= maxLength) return key;

  const lastSlashIndex = key.lastIndexOf("/");
  const filename = lastSlashIndex >= 0 ? key.slice(lastSlashIndex + 1) : key;
  const extensionIndex = filename.lastIndexOf(".");
  const extension = extensionIndex > 0 ? filename.slice(extensionIndex) : "";

  const reservedLength = extension.length + 1;
  const safeMax = Math.max(12, maxLength);
  const headLength = Math.max(8, safeMax - reservedLength - 3);
  const prefix = key.slice(0, headLength).replace(/\/+$/, "");

  return `${prefix}...${extension}`;
}

export function findSiblingPlaylistKey(key: string, keys: string[]) {
  const lastSlashIndex = key.lastIndexOf("/");
  const directory = lastSlashIndex >= 0 ? key.slice(0, lastSlashIndex + 1) : "";
  const siblings = keys.filter(
    (candidate) => candidate !== key && candidate.startsWith(directory) && candidate.toLowerCase().endsWith(".m3u8"),
  );
  const prioritized = siblings.find((candidate) => /(?:master|playlist|index|stream)\.m3u8$/i.test(candidate));
  return prioritized || siblings[0] || "";
}

export type VideoSource = { url: string; kind: "hls" | "native" };

export function resolveVideoSource(key: string, siblingKeys: string[]): VideoSource {
  if (/\.m3u8$/i.test(key)) return { url: buildFileUrl(key), kind: "hls" };

  if (/\.ts$/i.test(key)) {
    const playlistKey = findSiblingPlaylistKey(key, siblingKeys);
    if (playlistKey) return { url: buildFileUrl(playlistKey), kind: "hls" };
  }

  return { url: buildFileUrl(key), kind: "native" };
}

export const RUSTFS_DOCS_URL = "https://docs.rustfs.com/en/introduction.html";
export const RUSTFS_SDK_URL = "https://docs.rustfs.com/developer/sdk/rust.html";
export const AWS_S3_DOCS_URL = "https://docs.aws.amazon.com/AmazonS3/latest/userguide/GetStartedWithS3.html";
export const AWS_S3_POLICY_DOCS_URL =
  "https://docs.aws.amazon.com/AmazonS3/latest/userguide/example-bucket-policies.html";
