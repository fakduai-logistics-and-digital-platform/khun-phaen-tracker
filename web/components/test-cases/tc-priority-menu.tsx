"use client";

import { Check, ChevronDown, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPriorityLabel, getPriorityMeta, priorityOptions } from "./tc-options";

type TcPriorityMenuProps = {
  testNo: number;
  priority: string;
  updating: boolean;
  readOnly: boolean;
  onChange: (priority: string) => void;
};

function priorityVariant(priority: string) {
  if (priority === "high") return "destructive";
  if (priority === "medium") return "secondary";
  return "outline";
}

export function TcPriorityMenu({ testNo, priority, updating, readOnly, onChange }: TcPriorityMenuProps) {
  const Icon = getPriorityMeta(priority).icon;
  const label = getPriorityLabel(priority);

  if (readOnly) {
    return (
      <div className="hidden sm:block">
        <Badge variant={priorityVariant(priority)}>
          <Icon />
          {label}
        </Badge>
      </div>
    );
  }

  return (
    <div className="hidden sm:block">
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={updating}>
          <button
            type="button"
            className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            title="Change priority"
            aria-label={`Change priority for TC-${testNo}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Badge variant={priorityVariant(priority)} className="cursor-pointer">
              {updating ? <LoaderCircle className="animate-spin" /> : <Icon />}
              {label}
              <ChevronDown />
            </Badge>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36" onClick={(e) => e.stopPropagation()}>
          {priorityOptions.map((opt) => {
            const OptionIcon = getPriorityMeta(opt.value).icon;
            return (
              <DropdownMenuItem key={opt.value} onSelect={() => onChange(opt.value)}>
                <OptionIcon />
                <span className="flex-1">{opt.label}</span>
                {priority === opt.value && <Check />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
