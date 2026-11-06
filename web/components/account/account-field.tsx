import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const ACCOUNT_FIELD_CLASS =
  "h-11 rounded-lg border-slate-700/80 bg-background pl-11 pr-4 text-sm font-semibold text-white placeholder:text-muted-foreground hover:border-slate-600 focus-visible:border-brand-400/70 focus-visible:ring-4 focus-visible:ring-brand-500/15";

type AccountFieldProps = Omit<React.ComponentProps<typeof Input>, "id"> & {
  id: string;
  label: string;
  icon: LucideIcon;
};

export function AccountField({ id, label, icon: Icon, className, ...props }: AccountFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-bold text-foreground">
        {label}
      </Label>
      <div className="group relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-brand-300" />
        <Input id={id} className={cn(ACCOUNT_FIELD_CLASS, className)} {...props} />
      </div>
    </div>
  );
}
