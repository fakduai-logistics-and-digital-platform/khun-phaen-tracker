"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 20, 30, 40, 50];

type PaginationFooterProps = {
  currentPage?: number;
  totalPages?: number;
  totalTasks?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

function pageNumbers(current: number, total: number): (number | "gap")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "gap", total];
  if (current >= total - 2) return [1, "gap", total - 3, total - 2, total - 1, total];
  return [1, "gap", current - 1, current, current + 1, "gap", total];
}

export function PaginationFooter({
  currentPage = 1,
  totalPages = 1,
  totalTasks = 0,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
}: PaginationFooterProps) {
  const { t } = useI18n();
  const first = currentPage <= 1;
  const last = currentPage >= totalPages;
  const sizes = PAGE_SIZES.includes(pageSize) ? PAGE_SIZES : [...PAGE_SIZES, pageSize].sort((a, b) => a - b);

  function go(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange?.(page);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t px-4 py-3">
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange?.(Number(value))}>
          <SelectTrigger className="h-8 w-[70px]" aria-label={t("users__rows_per_page")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top">
            {sizes.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm font-medium">{t("users__rows_per_page")}</span>
        <span className="ms-2 text-sm text-muted-foreground tabular-nums">
          {t("pagination__showing", {
            from: totalTasks === 0 ? 0 : (currentPage - 1) * pageSize + 1,
            to: Math.min(currentPage * pageSize, totalTasks),
            total: totalTasks,
          })}
        </span>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <span className="text-sm font-medium tabular-nums">
          {t("users__page_of", { page: currentPage, total: Math.max(totalPages, 1) })}
        </span>
        <nav className="flex items-center gap-1" aria-label={t("users__pagination")}>
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            disabled={first}
            onClick={() => go(1)}
            aria-label={t("users__go_first")}
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={first}
            onClick={() => go(currentPage - 1)}
            aria-label={t("users__go_prev")}
          >
            <ChevronLeft />
          </Button>
          {pageNumbers(currentPage, totalPages).map((entry, i) =>
            entry === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={entry}
                variant={entry === currentPage ? "default" : "outline"}
                size="icon-sm"
                className={cn("tabular-nums", entry !== currentPage && "hidden sm:inline-flex")}
                aria-current={entry === currentPage ? "page" : undefined}
                onClick={() => go(entry)}
              >
                {entry}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon-sm"
            disabled={last}
            onClick={() => go(currentPage + 1)}
            aria-label={t("users__go_next")}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            disabled={last}
            onClick={() => go(totalPages)}
            aria-label={t("users__go_last")}
          >
            <ChevronsRight />
          </Button>
        </nav>
      </div>
    </div>
  );
}
