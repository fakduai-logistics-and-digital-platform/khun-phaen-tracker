import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsNoticeProps = {
  kind: "error" | "success";
  children: React.ReactNode;
  className?: string;
};

export function SettingsNotice({ kind, children, className }: SettingsNoticeProps) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        kind === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-success/30 bg-success/10 text-success",
        className,
      )}
    >
      {kind === "error" ? (
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{children}</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
