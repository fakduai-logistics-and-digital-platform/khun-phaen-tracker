"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBindable } from "./use-bindable";

type PaginationProps = {
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  currentPage?: number;
  onCurrentPageChange?: (page: number) => void;
  pageSizeOptions?: number[];
};

function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | string)[] = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push("...", total);
  } else if (current >= total - 3) {
    pages.push(1, "...");
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1, "...");
    for (let i = current - 1; i <= current + 1; i++) pages.push(i);
    pages.push("...", total);
  }
  return pages;
}

const NAV_BUTTON =
  "rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40";

export function Pagination({
  totalItems,
  pageSize: pageSizeProp = 50,
  onPageSizeChange,
  currentPage: currentPageProp = 1,
  onCurrentPageChange,
  pageSizeOptions = [20, 50, 100],
}: PaginationProps) {
  const [pageSize, setPageSize] = useBindable(pageSizeProp, onPageSizeChange);
  const [currentPage, setCurrentPage] = useBindable(currentPageProp, onCurrentPageChange);

  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = generatePageNumbers(currentPage, totalPages);

  const previousPageSize = useRef(pageSize);
  useEffect(() => {
    if (previousPageSize.current === pageSize) return;
    previousPageSize.current = pageSize;
    setCurrentPage(1);
  }, [pageSize, setCurrentPage]);

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  }

  function handlePageSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = parseInt(e.target.value);
    if (selected === -1) {
      const custom = prompt("กรอกจำนวนรายการต่อหน้า:", "200");
      if (custom) {
        const customValue = parseInt(custom);
        if (customValue > 0) setPageSize(customValue);
      }
    } else {
      setPageSize(selected);
    }
  }

  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t border-border bg-muted/50 px-4 py-3 sm:flex-row">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>แสดง</span>
        <select
          value={pageSize}
          onChange={handlePageSizeChange}
          aria-label="Page size"
          className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
          <option value={-1}>กำหนดเอง...</option>
        </select>
        <span>รายการ</span>
      </div>

      <div className="order-first text-sm text-muted-foreground sm:order-none">
        {totalItems > 0 ? (
          <span>
            รายการ {startItem}-{endItem} จาก {totalItems}
          </span>
        ) : (
          <span>ไม่มีรายการ</span>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            className={NAV_BUTTON}
            title="หน้าแรก"
            aria-label="หน้าแรก"
          >
            <ChevronsLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className={NAV_BUTTON}
            title="หน้าก่อนหน้า"
            aria-label="หน้าก่อนหน้า"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="mx-1 flex items-center gap-1">
            {pageNumbers.map((page, i) =>
              page === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  type="button"
                  onClick={() => goToPage(page as number)}
                  aria-current={currentPage === page ? "page" : undefined}
                  className={cn(
                    "h-8 min-w-[2rem] rounded-lg px-2 text-sm font-medium transition-colors",
                    currentPage === page ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-accent",
                  )}
                >
                  {page}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={NAV_BUTTON}
            title="หน้าถัดไป"
            aria-label="หน้าถัดไป"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            className={NAV_BUTTON}
            title="หน้าสุดท้าย"
            aria-label="หน้าสุดท้าย"
          >
            <ChevronsRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
