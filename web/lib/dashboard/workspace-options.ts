import {
  Book,
  Briefcase,
  Camera,
  Coffee,
  Code2,
  Globe,
  Heart,
  LayoutTemplate,
  Music,
  Rocket,
  Smile,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const WORKSPACE_COLORS = [
  { name: "Slate", value: "#64748b" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
];

export const WORKSPACE_ICONS: { key: string; icon: LucideIcon }[] = [
  { key: "LayoutTemplate", icon: LayoutTemplate },
  { key: "Briefcase", icon: Briefcase },
  { key: "Code2", icon: Code2 },
  { key: "Rocket", icon: Rocket },
  { key: "Zap", icon: Zap },
  { key: "Heart", icon: Heart },
  { key: "Target", icon: Target },
  { key: "Globe", icon: Globe },
  { key: "Book", icon: Book },
  { key: "Camera", icon: Camera },
  { key: "Coffee", icon: Coffee },
  { key: "Music", icon: Music },
  { key: "Smile", icon: Smile },
];

export const DEFAULT_WORKSPACE_COLOR = "#6366f1";
export const DEFAULT_WORKSPACE_ICON = "LayoutTemplate";

export function getWorkspaceIcon(key?: string): LucideIcon {
  return WORKSPACE_ICONS.find((i) => i.key === (key || DEFAULT_WORKSPACE_ICON))?.icon ?? LayoutTemplate;
}
