import { cn } from "@/lib/utils";

type InfoTileProps = {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  truncate?: boolean;
  className?: string;
};

export function InfoTile({ label, value, mono, truncate, className }: InfoTileProps) {
  return (
    <div className={cn("rounded-xl border bg-muted/40 px-4 py-3", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-sm text-foreground", mono && "font-mono", truncate && "truncate")}>{value}</p>
    </div>
  );
}
