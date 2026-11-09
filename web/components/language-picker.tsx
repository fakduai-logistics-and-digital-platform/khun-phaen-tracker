"use client";

import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguagePicker({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("scale-95 rounded-full", className)}>
          <Languages className="size-[1.2rem]" />
          <span className="sr-only">{t("layout__change_language")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((lang) => (
          <DropdownMenuItem key={lang.code} onSelect={() => setLocale(lang.code)}>
            {lang.label}
            <Check size={14} className={cn("ms-auto", locale !== lang.code && "hidden")} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
