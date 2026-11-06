"use client";

import type { ImgHTMLAttributes } from "react";
import { useSignedFileUrl } from "@/lib/api/file-urls";
import { cn } from "@/lib/utils";

type StoredImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  fileKey: string;
  /** Load the 320px WebP thumbnail instead of the original. */
  thumb?: boolean;
};

/** An attachment or comment image from storage, loaded through a signed link. */
export function StoredImage({ fileKey, thumb = false, className, alt, ...props }: StoredImageProps) {
  const src = useSignedFileUrl(fileKey, thumb);
  if (!src) return <span aria-hidden className={cn("block animate-pulse bg-muted", className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={className} {...props} />;
}
