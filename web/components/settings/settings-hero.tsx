import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type SettingsHeroProps = {
  icon: LucideIcon;
  title: string;
  badge: string;
  subtitle: string;
  children?: React.ReactNode;
};

export function SettingsHero({ icon: Icon, title, badge, subtitle, children }: SettingsHeroProps) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="bg-gradient-to-br from-brand-500/15 via-muted/30 to-transparent px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-4 inline-flex rounded-xl bg-background/70 p-3 ring-1 ring-border backdrop-blur">
              <Icon size={22} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                {badge}
              </Badge>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
