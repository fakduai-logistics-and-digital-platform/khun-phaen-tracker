"use client";

import type { ReactNode } from "react";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type TooltipProps = {
  text?: string;
  content?: ReactNode;
  children?: ReactNode;
};

export function Tooltip({ text = "", content, children }: TooltipProps) {
  const body = text ? <span className="block">{text}</span> : content;

  if (!body) return <div className="inline-block max-w-full">{children}</div>;

  return (
    <UiTooltip>
      <TooltipTrigger asChild>
        <div className="inline-block max-w-full">{children}</div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="z-[99999] max-w-75 min-w-20 break-words whitespace-normal">
        {body}
      </TooltipContent>
    </UiTooltip>
  );
}
