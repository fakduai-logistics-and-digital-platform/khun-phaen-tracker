import {
  CheckCircle2,
  Database,
  Layers,
  Monitor,
  Palette,
  Server,
  Smartphone,
  Terminal,
  type LucideIcon,
} from "lucide-react";

export type PositionOption = { value: string; label: string; icon: LucideIcon };

export const POSITION_OPTIONS: PositionOption[] = [
  { value: "Full Stack Developer", label: "Full Stack Developer", icon: Layers },
  { value: "Frontend Developer", label: "Frontend Developer", icon: Monitor },
  { value: "Backend Developer", label: "Backend Developer", icon: Server },
  { value: "DevOps", label: "DevOps", icon: Terminal },
  { value: "QA Tester", label: "QA Tester", icon: CheckCircle2 },
  { value: "Data Scientist", label: "Data Scientist", icon: Database },
  { value: "UX/UI Designer", label: "UX/UI Designer", icon: Palette },
  { value: "Mobile Developer", label: "Mobile Developer", icon: Smartphone },
];
