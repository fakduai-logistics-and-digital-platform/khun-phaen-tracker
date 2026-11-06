"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 20, 30, 40, 50];

function pageNumbers(current: number, total: number): (number | "gap")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "gap", total];
  if (current >= total - 2) return [1, "gap", total - 3, total - 2, total - 1, total];
  return [1, "gap", current - 1, current, current + 1, "gap", total];
}

type Props = {
  page: number;
  pageCount: number;
  pageSize: number;
  onPage: (index: number) => void;
  onPageSize: (size: number) => void;
};

export function UsersPagination({ page, pageCount, pageSize, onPage, onPageSize }: Props) {
  const { t } = useI18n();
  const current = page + 1;
  const first = page === 0;
  const last = page >= pageCount - 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-2">
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-[70px]" aria-label={t("users__rows_per_page")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top">
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm font-medium">{t("users__rows_per_page")}</span>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <span className="text-sm font-medium tabular-nums">
          {t("users__page_of", { page: current, total: pageCount })}
        </span>
        <nav className="flex items-center gap-1" aria-label={t("users__pagination")}>
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            disabled={first}
            onClick={() => onPage(0)}
            aria-label={t("users__go_first")}
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={first}
            onClick={() => onPage(page - 1)}
            aria-label={t("users__go_prev")}
          >
            <ChevronLeft />
          </Button>
          {pageNumbers(current, pageCount).map((entry, i) =>
            entry === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={entry}
                variant={entry === current ? "default" : "outline"}
                size="icon-sm"
                className={cn("tabular-nums", entry !== current && "hidden sm:inline-flex")}
                aria-current={entry === current ? "page" : undefined}
                onClick={() => onPage(entry - 1)}
              >
                {entry}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon-sm"
            disabled={last}
            onClick={() => onPage(page + 1)}
            aria-label={t("users__go_next")}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            disabled={last}
            onClick={() => onPage(pageCount - 1)}
            aria-label={t("users__go_last")}
          >
            <ChevronsRight />
          </Button>
        </nav>
      </div>
    </div>
  );
}
