"use client";

import {
  Bookmark,
  Braces,
  Code2,
  FileText,
  GitCompare,
  Globe,
  Key,
  PenTool,
  Regex,
  SquareTerminal,
  Table,
  Wrench,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n";
import { createUIActions, type ModalName } from "@/lib/stores/uiActions";

const ui = createUIActions();

type UtilityItem = {
  modal: ModalName;
  icon: LucideIcon;
  label: string;
};

const OPEN_KEY_PREFIX = "sidebar-tools-open:";

function readOpen(id: string, fallback: boolean) {
  try {
    const saved = localStorage.getItem(OPEN_KEY_PREFIX + id);
    return saved === null ? fallback : saved === "1";
  } catch {
    return fallback;
  }
}

function UtilityGroup({
  id,
  icon: GroupIcon,
  label,
  items,
  defaultOpen = false,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  items: UtilityItem[];
  defaultOpen?: boolean;
}) {
  const { state, isMobile } = useSidebar();
  const [open, setOpen] = useState(defaultOpen);

  // Read after mount so the server-rendered markup and the first client render agree.
  useEffect(() => {
    setOpen(readOpen(id, defaultOpen));
  }, [id, defaultOpen]);

  function changeOpen(next: boolean) {
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY_PREFIX + id, next ? "1" : "0");
    } catch {
      /* The state is a convenience; it simply resets when storage is unavailable. */
    }
  }
  const iconOnly = state === "collapsed" && !isMobile;

  return (
    <Collapsible open={iconOnly || open} onOpenChange={changeOpen} className="group/collapsible" asChild>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip={label}>
                <GroupIcon />
                <span>{label}</span>
                <ChevronRight className="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
        <CollapsibleContent>
          <SidebarMenu>
            {items.map(({ modal, icon: Icon, label: itemLabel }) => (
              <SidebarMenuItem key={modal}>
                <SidebarMenuButton tooltip={itemLabel} onClick={() => ui.openModal(modal)}>
                  <Icon />
                  <span>{itemLabel}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function SidebarUtilityTools() {
  const { t } = useI18n();

  const general: UtilityItem[] = [
    { modal: "quickNotes", icon: FileText, label: t("quickNotes__title") },
    { modal: "bookmarkManager", icon: Bookmark, label: t("timer__bookmarks_tooltip") },
    { modal: "whiteboard", icon: PenTool, label: t("commandPalette__whiteboard_label") },
  ];
  const developer: UtilityItem[] = [
    { modal: "htmlPreview", icon: Code2, label: t("htmlPreview__title") },
    { modal: "regexTester", icon: Regex, label: t("regexTester__title") },
    { modal: "jsonYamlConverter", icon: Braces, label: t("jsonYamlConverter__title") },
    { modal: "apiTester", icon: Globe, label: t("apiTester__title") },
    { modal: "diffChecker", icon: GitCompare, label: t("diffChecker__title") },
    { modal: "csvJsonViewer", icon: Table, label: t("csvJsonViewer__title") },
    { modal: "encoderDecoder", icon: Key, label: t("encoderDecoder__sidebar_label") },
  ];

  return (
    <>
      <UtilityGroup id="general" icon={Wrench} label={t("devtools__group_general")} items={general} defaultOpen />
      <UtilityGroup id="developer" icon={SquareTerminal} label={t("devtools__group_developer")} items={developer} />
    </>
  );
}
