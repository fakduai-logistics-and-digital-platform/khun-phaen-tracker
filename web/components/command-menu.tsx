"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowRight, ChevronRight, Laptop, Moon, Sun } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearch } from "@/context/search-provider";
import { useI18n } from "@/lib/i18n";
import { useNavGroups } from "./layout/use-nav-groups";

export function CommandMenu() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { open, setOpen } = useSearch();
  const { t } = useI18n();
  const navGroups = useNavGroups();

  const runCommand = useCallback(
    (command: () => unknown) => {
      setOpen(false);
      command();
    },
    [setOpen],
  );

  const goTo = (url: string) => () => runCommand(() => router.push(url));
  const Arrow = () => (
    <div className="flex size-4 items-center justify-center">
      <ArrowRight className="size-2 text-muted-foreground/80" />
    </div>
  );

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("layout__command_placeholder")} />
      <CommandList>
        <ScrollArea type="hover" className="h-72 pe-1">
          <CommandEmpty>{t("layout__command_empty")}</CommandEmpty>
          {navGroups.map((group) => (
            <CommandGroup key={group.titleKey} heading={t(group.titleKey)}>
              {group.items.map((navItem, i) => {
                if (navItem.url) {
                  return (
                    <CommandItem key={`${navItem.url}-${i}`} value={t(navItem.titleKey)} onSelect={goTo(navItem.url)}>
                      <Arrow />
                      {t(navItem.titleKey)}
                    </CommandItem>
                  );
                }
                return navItem.items?.map((subItem, j) => (
                  <CommandItem
                    key={`${navItem.titleKey}-${subItem.url}-${j}`}
                    value={`${t(navItem.titleKey)}-${subItem.url}`}
                    onSelect={goTo(subItem.url)}
                  >
                    <Arrow />
                    {t(navItem.titleKey)} <ChevronRight /> {t(subItem.titleKey)}
                  </CommandItem>
                ));
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading={t("layout__command_theme")}>
            <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
              <Sun /> <span>{t("layout__theme_light")}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
              <Moon className="scale-90" />
              <span>{t("layout__theme_dark")}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme("system"))}>
              <Laptop />
              <span>{t("layout__theme_system")}</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  );
}
