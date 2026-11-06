"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EMPTY = "__empty__";

export interface PropertyOption {
  value: string | number;
  label: string;
  icon?: React.ComponentType<{ size?: string | number; className?: string }>;
}

interface PropertySelectProps {
  id?: string;
  value: string | number | null | undefined;
  options: PropertyOption[];
  onSelect: (value: string | number) => void;
  disabled?: boolean;
  className?: string;
}

export function PropertySelect({ id, value, options, onSelect, disabled, className }: PropertySelectProps) {
  const toKey = (v: string | number | null | undefined) => (v === "" || v == null ? EMPTY : String(v));

  return (
    <Select
      value={toKey(value)}
      disabled={disabled}
      onValueChange={(key) => onSelect(options.find((o) => toKey(o.value) === key)?.value ?? "")}
    >
      <SelectTrigger id={id} size="sm" className={cn("w-full max-w-48 justify-between", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={toKey(option.value)} value={toKey(option.value)}>
            {option.icon && <option.icon />}
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
