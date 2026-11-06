"use client";

import { useRef, useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useDismiss } from "./tc-use-dismiss";

type TcRowMenuProps = {
  deleteLabel: string;
  triggerLabel: string;
  onDelete: () => void;
};

export function TcRowMenu({ deleteLabel, triggerLabel, onDelete }: TcRowMenuProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, position !== null, () => setPosition(null));

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        className="grid size-6 place-items-center rounded text-muted-foreground opacity-0 transition-all hover:bg-accent focus-visible:opacity-100 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          if (position) {
            setPosition(null);
            return;
          }
          const rect = e.currentTarget.getBoundingClientRect();
          setPosition({ x: rect.right + 2, y: rect.top - 4 });
        }}
      >
        <MoreHorizontal size={14} />
      </button>
      {position && (
        <div
          role="menu"
          className="fixed z-[9999] min-w-[140px] rounded-xl border border-border bg-popover py-1 shadow-xl"
          style={{ top: position.y, left: position.x }}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              setPosition(null);
              onDelete();
            }}
          >
            <Trash2 size={14} />
            {deleteLabel}
          </button>
        </div>
      )}
    </div>
  );
}
