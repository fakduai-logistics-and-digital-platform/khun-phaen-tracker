"use client";

import { AlertTriangle, Minus, SignalHigh, SignalLow, SignalMedium } from "lucide-react";
import { SearchableSelect, type SelectOption, type SelectValue } from "./searchable-select";
import { useBindable } from "./use-bindable";

type PrioritySelectorProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  minimal?: boolean;
  id?: string;
};

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "none", label: "No priority", icon: Minus, iconClass: "text-gray-400", pillClass: "" },
  {
    value: "urgent",
    label: "Urgent",
    icon: AlertTriangle,
    iconClass: "text-white",
    pillClass: "rounded bg-orange-500 px-2 py-0.5 text-white shadow-sm",
  },
  {
    value: "high",
    label: "High",
    icon: SignalHigh,
    iconClass: "text-white",
    pillClass: "rounded bg-orange-600 px-2 py-0.5 text-white shadow-sm",
  },
  {
    value: "medium",
    label: "Medium",
    icon: SignalMedium,
    iconClass: "text-orange-400",
    pillClass: "rounded bg-orange-900/40 px-2 py-0.5 text-orange-400",
  },
  {
    value: "low",
    label: "Low",
    icon: SignalLow,
    iconClass: "text-orange-500",
    pillClass: "rounded bg-orange-900/20 px-2 py-0.5 text-orange-500",
  },
];

export function PrioritySelector({
  value: valueProp = "none",
  onValueChange,
  onSelect,
  minimal = true,
  id = "priority",
}: PrioritySelectorProps) {
  const [value, setValue] = useBindable<string>(valueProp, onValueChange);

  return (
    <SearchableSelect
      id={id}
      value={value}
      onValueChange={(next: SelectValue) => setValue(String(next))}
      options={PRIORITY_OPTIONS}
      showSearch={false}
      minimal={minimal}
      onSelect={(next: SelectValue) => onSelect?.(String(next))}
    />
  );
}
