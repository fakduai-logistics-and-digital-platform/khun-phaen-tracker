import { cn } from "@/lib/utils";

/** Workzy mark: the "W" follows the text colour, the dot keeps the brand yellow. */
export function WorkzyLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" role="img" aria-label="Workzy" className={cn("size-6", className)}>
      <path
        fill="currentColor"
        d="M27.06 74.09L73.06 202.09A18 18 0 0 0 106.94 189.91L60.94 61.91A18 18 0 0 0 27.06 74.09ZM104.89 206.11L142.89 150.11A18 18 0 0 0 113.11 129.89L75.11 185.89A18 18 0 0 0 104.89 206.11ZM113.11 150.11L151.11 206.11A18 18 0 0 0 180.89 185.89L142.89 129.89A18 18 0 0 0 113.11 150.11ZM182.94 202.09L228.94 74.09A18 18 0 0 0 195.06 61.91L149.06 189.91A18 18 0 0 0 182.94 202.09Z"
      />
      <path fill="#FFB400" d="M103 70A25 25 0 1 1 153 70A25 25 0 1 1 103 70Z" />
    </svg>
  );
}
