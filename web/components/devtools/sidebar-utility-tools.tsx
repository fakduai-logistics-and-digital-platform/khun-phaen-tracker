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
  Table,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n";
import { createUIActions, type ModalName } from "@/lib/stores/uiActions";

const ui = createUIActions();

type UtilityItem = {
  modal: ModalName;
  icon: LucideIcon;
  label: string;
};

export function SidebarUtilityTools() {
  const { t } = useI18n();
  const { state, isMobile } = useSidebar();
  const [open, setOpen] = useState(false);

  const items: UtilityItem[] = [
    { modal: "quickNotes", icon: FileText, label: t("quickNotes__title") },
    { modal: "bookmarkManager", icon: Bookmark, label: t("timer__bookmarks_tooltip") },
    { modal: "whiteboard", icon: PenTool, label: t("commandPalette__whiteboard_label") },
    { modal: "htmlPreview", icon: Code2, label: t("htmlPreview__title") },
    { modal: "regexTester", icon: Regex, label: t("regexTester__title") },
    { modal: "jsonYamlConverter", icon: Braces, label: t("jsonYamlConverter__title") },
    { modal: "apiTester", icon: Globe, label: t("apiTester__title") },
    { modal: "diffChecker", icon: GitCompare, label: t("diffChecker__title") },
    { modal: "csvJsonViewer", icon: Table, label: t("csvJsonViewer__title") },
    { modal: "encoderDecoder", icon: Key, label: t("encoderDecoder__sidebar_label") },
  ];

  const iconOnly = state === "collapsed" && !isMobile;

  return (
    <Collapsible open={iconOnly || open} onOpenChange={setOpen} className="group/collapsible" asChild>
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="w-full justify-between">
            {t("commandPalette__cat_commands")}
            <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarMenu>
            {items.map(({ modal, icon: Icon, label }) => (
              <SidebarMenuItem key={modal}>
                <SidebarMenuButton tooltip={label} onClick={() => ui.openModal(modal)}>
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
