"use client";

import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationFooterProps = {
  currentPage?: number;
  totalPages?: number;
  totalTasks?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeSettings?: () => void;
};

export function PaginationFooter({
  currentPage = 1,
  totalPages = 1,
  totalTasks = 0,
  pageSize = 20,
  onPageChange,
  onPageSizeSettings,
}: PaginationFooterProps) {
  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    onPageChange?.(newPage);
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-3 md:flex-row">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          กำลังแสดง {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalTasks)} จากทั้งหมด{" "}
          {totalTasks}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => onPageSizeSettings?.()}>
          <Settings2 />
          {pageSize} / หน้า
        </Button>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
            aria-label="หน้าก่อนหน้า"
          >
            <ChevronLeft />
          </Button>

          {pages.map((pageNum) => {
            if (
              totalPages <= 5 ||
              pageNum === 1 ||
              pageNum === totalPages ||
              (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
            ) {
              return (
                <Button
                  key={pageNum}
                  type="button"
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="icon"
                  className="size-8 tabular-nums"
                  aria-current={currentPage === pageNum ? "page" : undefined}
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            }
            if ((pageNum === 2 && currentPage > 3) || (pageNum === totalPages - 1 && currentPage < totalPages - 2)) {
              return (
                <span key={pageNum} className="w-6 text-center text-sm text-muted-foreground">
                  …
                </span>
              );
            }
            return null;
          })}

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={currentPage === totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            aria-label="หน้าถัดไป"
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
