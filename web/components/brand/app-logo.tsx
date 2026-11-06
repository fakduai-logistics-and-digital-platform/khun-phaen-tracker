import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/utils";

export function AppLogo({ className, alt = "Khun Phaen Logo" }: { className?: string; alt?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={withBase("/logo-light.svg")} alt={alt} className={cn("dark:hidden", className)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={withBase("/logo-dark.svg")} alt="" aria-hidden="true" className={cn("hidden dark:block", className)} />
    </>
  );
}
