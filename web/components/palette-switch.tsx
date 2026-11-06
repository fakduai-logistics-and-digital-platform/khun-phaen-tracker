"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_PALETTE,
  isPaletteId,
  PALETTE_GROUPS,
  PALETTE_KEY,
  PALETTES,
  paletteSwatch,
  type PaletteId,
} from "@/lib/palette";
import { cn } from "@/lib/utils";

export function PaletteSwitch({ className }: { className?: string }) {
  const { t } = useI18n();
  const [palette, setPalette] = useState<PaletteId>(DEFAULT_PALETTE);

  useEffect(() => {
    const saved = localStorage.getItem(PALETTE_KEY);
    if (isPaletteId(saved)) setPalette(saved);
  }, []);

  function choose(id: PaletteId) {
    setPalette(id);
    localStorage.setItem(PALETTE_KEY, id);
    document.documentElement.setAttribute("data-palette", id);
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("scale-95 rounded-full", className)}>
          <Palette className="size-[1.2rem]" />
          <span className="sr-only">{t("layout__palette")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t("layout__palette")}</DropdownMenuLabel>
        {PALETTE_GROUPS.map((group) => (
          <Fragment key={group.id}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t(group.labelKey)}</DropdownMenuLabel>
            {PALETTES.filter((p) => p.group === group.id).map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => choose(p.id)}>
                <span
                  aria-hidden="true"
                  className="size-4 rounded-full ring-1 ring-black/10"
                  style={{ background: paletteSwatch(p) }}
                />
                {t(p.labelKey)}
                <Check size={14} className={cn("ms-auto", palette !== p.id && "hidden")} />
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
