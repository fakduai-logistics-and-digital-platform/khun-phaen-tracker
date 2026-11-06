import { translate } from "@/lib/i18n";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function priorityVariant(priority: string): BadgeVariant {
  if (priority === "high") return "destructive";
  if (priority === "medium") return "secondary";
  return "outline";
}

export function resultVariant(status: string): BadgeVariant {
  if (status === "failed" || status === "invalid") return "destructive";
  if (status === "passed" || status === "actual") return "secondary";
  return "outline";
}

const RUN_KEYS: Record<string, string> = {
  pending: "tcopt__run_pending",
  skipped: "tcopt__run_skipped",
  invalid: "tcopt__run_invalid",
  passed: "tcopt__status_passed",
  failed: "tcopt__status_failed",
  blocked: "tcopt__status_blocked",
  draft: "tcopt__status_draft",
  actual: "tcopt__status_actual",
  deprecated: "tcopt__status_deprecated",
};

export function statusLabel(status: string) {
  const key = RUN_KEYS[status];
  return key ? translate(key) : status;
}

export function priorityLabel(priority: string) {
  const key = `tcopt__priority_${priority}`;
  const label = translate(key);
  return label === key ? priority : label;
}

export function fixedLabel(fixed: string) {
  return translate(fixed === "yes" ? "tcopt__fixed_yes" : "tcopt__fixed_no");
}

export function runStatusLabel(status: string) {
  const key = `tcpub__run_${status}`;
  const label = translate(key);
  return label === key ? status : label;
}
