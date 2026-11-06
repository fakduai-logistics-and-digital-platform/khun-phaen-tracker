"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TcFilterChipsProps = {
  filters: Record<string, string[]>;
  properties: { id: string; label: string }[];
  labelFor: (property: string, value: string) => string;
  onRemove: (property: string, value?: string) => void;
  perValue?: boolean;
  className?: string;
};

export function TcFilterChips({
  filters,
  properties,
  labelFor,
  onRemove,
  perValue = false,
  className,
}: TcFilterChipsProps) {
  const labelOf = (prop: string) => properties.find((p) => p.id === prop)?.label || prop;

  type Chip = { key: string; prop: string; value: string | undefined; text: string };
  const chips: Chip[] = Object.entries(filters).flatMap(([prop, values]): Chip[] => {
    if (values.length === 0) return [];
    if (perValue) return values.map((value) => ({ key: `${prop}:${value}`, prop, value, text: value }));
    return [{ key: prop, prop, value: undefined, text: values.map((v) => labelFor(prop, v)).join(", ") }];
  });

  if (chips.length === 0) return null;

  return (
    <>
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className={className}>
          <span className="text-muted-foreground">{labelOf(chip.prop)}:</span>
          <span>{chip.text}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-4 rounded-full"
            aria-label={`Remove ${labelOf(chip.prop)} filter`}
            onClick={() => onRemove(chip.prop, chip.value)}
          >
            <X />
          </Button>
        </Badge>
      ))}
    </>
  );
}
