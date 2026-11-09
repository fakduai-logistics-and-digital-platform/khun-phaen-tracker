"use client";

import { AlertTriangle, SignalHigh, SignalLow, SignalMedium } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

type PriorityBadgeProps = {
  priority: "urgent" | "high" | "medium" | "low" | "none" | undefined | null;
  /** Show only the icon when the nearest `@container` ancestor is too narrow for the label. */
  collapsible?: boolean;
};

const PRIORITY_CONFIG = {
  urgent: { key: "priority__urgent", fallback: "Urgent", icon: AlertTriangle, variant: "destructive" },
  high: { key: "priority__high", fallback: "High", icon: SignalHigh, variant: "destructive" },
  medium: { key: "priority__medium", fallback: "Medium", icon: SignalMedium, variant: "secondary" },
  low: { key: "priority__low", fallback: "Low", icon: SignalLow, variant: "outline" },
} as const;

export function PriorityBadge({ priority, collapsible = false }: PriorityBadgeProps) {
  const { t } = useI18n();
  if (!priority || priority === "none") return null;

  const config = PRIORITY_CONFIG[priority];
  if (!config) return null;

  const translated = t(config.key);
  const label = translated === config.key ? config.fallback : translated;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} title={label}>
      <Icon />
      <span className={collapsible ? "sr-only @[5.5rem]:not-sr-only" : undefined}>{label}</span>
    </Badge>
  );
}
