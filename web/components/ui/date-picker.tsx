"use client";

import { format, parse } from "date-fns";
import { th } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ISO_DATE = "yyyy-MM-dd";

/** shadcn date picker: a Popover wrapping Calendar. Value is an ISO `yyyy-MM-dd` string. */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { locale, t } = useI18n();
  const selected = value ? parse(value, ISO_DATE, new Date()) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn("w-full justify-start font-normal", !selected && "text-muted-foreground", className)}
        >
          <CalendarIcon className="size-4" />
          {selected ? format(selected, "PPP", locale === "th" ? { locale: th } : undefined) : (placeholder ?? t("common.pickDate"))}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={locale === "th" ? th : undefined}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => date && onChange(format(date, ISO_DATE))}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
