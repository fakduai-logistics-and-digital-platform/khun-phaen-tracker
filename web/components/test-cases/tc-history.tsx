"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, History } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDateTime } from "./tc-times";

type Change = { field: string; from: unknown; to: unknown };
type Entry = { id: string; user_name: string; action: string; at: string; changes: Change[] };

const ENUM_FIELDS = new Set(["status", "priority", "fixed"]);

function useValueLabel() {
  const { t } = useI18n();
  return (field: string, value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    if (!text) return t("tcHistory__empty");
    if (ENUM_FIELDS.has(field)) {
      const key = field === "fixed" ? `tcopt__fixed_${text}` : `tcopt__${field}_${text}`;
      const label = t(key);
      return label === key ? text : label;
    }
    return text;
  };
}

function ChangeLine({ change }: { change: Change }) {
  const { t } = useI18n();
  const label = useValueLabel();
  const field = t(`tcHistory__field_${change.field}`);
  // Step lists are not recorded value by value; only the fact that they changed.
  if (change.from === null && change.to === null) return <li>{field}</li>;
  return (
    <li className="break-words">
      <span className="text-foreground">{field}</span>: {label(change.field, change.from)} →{" "}
      <span className="text-foreground">{label(change.field, change.to)}</span>
    </li>
  );
}

function useHistory(testCaseId: string) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function load() {
    setFailed(false);
    try {
      const resp = await api.data.testCases.history(testCaseId);
      if (resp.ok) setEntries(await resp.json());
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }
  return { entries, failed, load };
}

function HistoryList({ entries, failed }: { entries: Entry[] | null; failed: boolean }) {
  const { t, locale } = useI18n();
  return (
    <ul className="flex max-h-80 flex-col overflow-y-auto">
      {entries === null && !failed && (
        <li className="flex flex-col gap-3 p-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </li>
      )}
      {failed && <li className="p-4 text-sm text-destructive">{t("tcHistory__load_failed")}</li>}
      {entries?.length === 0 && <li className="p-4 text-sm text-muted-foreground">{t("tcHistory__none")}</li>}
      {entries?.map((entry) => (
        <li key={entry.id} className="flex gap-3 border-b px-4 py-3 last:border-b-0">
          <Avatar className="size-6 shrink-0">
            <AvatarFallback className="text-xs">{entry.user_name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-sm">
              <span className="font-medium">{entry.user_name}</span>{" "}
              <span className="text-muted-foreground">{t(`tcHistory__action_${entry.action}`)}</span>
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(entry.at, locale)}</p>
            {entry.changes?.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {entry.changes.map((change) => (
                  <ChangeLine key={change.field} change={change} />
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PassedLine({ passedAt }: { passedAt?: string | null }) {
  const { t, locale } = useI18n();
  const passed = formatDateTime(passedAt, locale);
  if (!passed) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-success tabular-nums">
      <CheckCircle2 className="size-3.5" />
      {t("tcTime__passed")} {passed}
    </p>
  );
}

type Props = {
  testCaseId: string;
  updatedAt?: string | null;
  passedAt?: string | null;
  /** Show the last edit time next to the icon. */
  showTime?: boolean;
  className?: string;
};

/** History icon: opens who changed the test case, when, and what changed. */
export function TcHistoryButton({ testCaseId, updatedAt, passedAt, showTime = false, className }: Props) {
  const { t, locale } = useI18n();
  const { entries, failed, load } = useHistory(testCaseId);
  const edited = formatDateTime(updatedAt, locale);

  return (
    <Popover onOpenChange={(open) => open && void load()}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={showTime ? "sm" : "icon"}
          className={cn(showTime ? "h-7 gap-1.5 px-2 text-xs text-muted-foreground" : "size-7", className)}
          title={edited ? `${t("tcTime__edited")} ${edited}` : t("tcHistory__title")}
          aria-label={t("tcHistory__title")}
          onClick={(e) => e.stopPropagation()}
        >
          <History />
          {showTime && edited && <span className="tabular-nums">{edited}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-1 border-b px-4 py-3">
          <p className="text-sm font-medium">{t("tcHistory__title")}</p>
          <PassedLine passedAt={passedAt} />
        </div>
        <HistoryList entries={entries} failed={failed} />
      </PopoverContent>
    </Popover>
  );
}

/** The same history, opened from a menu item instead of its own icon. */
export function TcHistoryDialog({
  testCaseId,
  passedAt,
  open,
  onOpenChange,
}: {
  testCaseId: string;
  passedAt?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const { entries, failed, load } = useHistory(testCaseId);
  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="gap-1 border-b px-4 py-3">
          <DialogTitle className="text-sm">{t("tcHistory__title")}</DialogTitle>
          <PassedLine passedAt={passedAt} />
        </DialogHeader>
        <HistoryList entries={entries} failed={failed} />
      </DialogContent>
    </Dialog>
  );
}
