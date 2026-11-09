"use client";

import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useI18n } from "@/lib/i18n";

type PaginationFooterProps = {
  currentPage?: number;
  totalPages?: number;
  totalTasks?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeSettings?: () => void;
};

function pageNumbers(current: number, total: number): (number | "gap")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "gap", total];
  if (current >= total - 2)
    return [1, "gap", total - 3, total - 2, total - 1, total];
  return [1, "gap", current - 1, current, current + 1, "gap", total];
}

export function PaginationFooter({
  currentPage = 1,
  totalPages = 1,
  totalTasks = 0,
  pageSize = 20,
  onPageChange,
  onPageSizeSettings,
}: PaginationFooterProps) {
  const { t } = useI18n();

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    onPageChange?.(newPage);
  }

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-3 md:flex-row">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {t("pagination__showing", {
            from: (currentPage - 1) * pageSize + 1,
            to: Math.min(currentPage * pageSize, totalTasks),
            total: totalTasks,
          })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageSizeSettings?.()}
        >
          <Settings2 />
          {t("pagination__per_page", { size: pageSize })}
        </Button>
      </div>

      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                <span className="hidden sm:inline">
                  {t("pagination__previous")}
                </span>
              </PaginationPrevious>
            </PaginationItem>
            {pageNumbers(currentPage, totalPages).map((entry, i) => (
              <PaginationItem
                key={entry === "gap" ? `gap-${i}` : entry}
                className={entry === currentPage ? "" : "max-sm:hidden"}
              >
                {entry === "gap" ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    isActive={entry === currentPage}
                    onClick={() => handlePageChange(entry)}
                  >
                    {entry}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                <span className="hidden sm:inline">
                  {t("pagination__next")}
                </span>
              </PaginationNext>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
