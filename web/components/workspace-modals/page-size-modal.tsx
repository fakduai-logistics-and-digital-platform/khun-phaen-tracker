"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PRESET_SIZES = [10, 20, 50, 100];

export function PageSizeModal({
  show = false,
  value = 20,
  onClose,
  onSave,
}: {
  show?: boolean;
  value?: number;
  onClose?: () => void;
  onSave?: (detail: { value: number }) => void;
}) {
  const [localValue, setLocalValue] = useState<number | string>(value);

  useEffect(() => {
    if (show) setLocalValue(value);
  }, [show, value]);

  function save() {
    onSave?.({ value: Math.min(500, Math.max(1, Number(localValue) || 1)) });
  }

  return (
    <Dialog open={show} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="max-w-sm gap-6 rounded-lg p-0 sm:max-w-sm" showCloseButton={false}>
        <DialogHeader className="px-8 pt-8 text-left">
          <div className="mb-2 flex size-16 items-center justify-center rounded-lg bg-primary/10">
            <Settings2 size={32} className="text-primary" />
          </div>
          <DialogTitle className="text-2xl font-medium">กำหนดจำนวนงาน</DialogTitle>
          <DialogDescription>จำนวนงานที่จะแสดงผลต่อหน้าในโปรเจกต์นี้</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-8">
          <div className="flex flex-wrap gap-2">
            {PRESET_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setLocalValue(size)}
                aria-pressed={Number(localValue) === size}
                className={cn(
                  "flex-1 rounded-lg border-2 py-3 font-medium transition-colors",
                  Number(localValue) === size
                    ? "scale-[1.02] border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-ring",
                )}
              >
                {size}
              </button>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="custom_page_size" className="pl-1 text-xs font-medium text-muted-foreground">
              ระบุจำนวนเอง
            </Label>
            <Input
              id="custom_page_size"
              type="number"
              min={1}
              max={500}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              className="h-14 rounded-lg px-6 text-lg font-medium"
            />
          </div>
        </div>

        <DialogFooter className="flex-row gap-3 bg-muted/50 px-8 py-6 sm:flex-row">
          <Button type="button" variant="ghost" className="h-12 flex-1 font-medium" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" className="h-12 flex-1 rounded-lg font-medium" onClick={save}>
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
