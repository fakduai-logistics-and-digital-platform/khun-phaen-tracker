"use client";

import { useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateFieldProps {
  id?: string;
  value: string;
  placeholder: string;
  onSelect: (value: string) => void;
}

function toDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
}

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DateField({ id, value, placeholder, onSelect }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);

  return (
    <div className="flex w-full max-w-48 items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" size="sm" className="flex-1 justify-start font-normal">
            <CalendarIcon />
            <span className={selected ? "" : "text-muted-foreground"}>
              {selected
                ? selected.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
                : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (date) onSelect(toKey(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {selected && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Clear date"
          onClick={() => onSelect("")}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
