import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  CircleDashed,
  History,
  ListChecks,
  Shield,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { SelectOption } from "@/components/shared/searchable-select";
import type { ClassicStep, GherkinStep } from "./test-case-step-list";

export type Status = "draft" | "actual" | "failed" | "blocked" | "deprecated" | "passed";
export type Priority = "high" | "medium" | "low";
export type StepFormat = "gherkin" | "classic";

export type EditorForm = {
  name: string;
  suiteId: string;
  projectId: string;
  description: string;
  preconditions: string;
  postconditions: string;
  status: Status;
  priority: Priority;
  testNo: string;
  input: string;
  expectedResult: string;
  actualResult: string;
  fixed: "no" | "yes";
  assignDev: string;
  assignTester: string;
  devNote: string;
  testNote: string;
  stepFormat: StepFormat;
  classicSteps: ClassicStep[];
  gherkinSteps: GherkinStep[];
  gherkinView: "raw" | "steps";
  gherkinRaw: string;
};

export type EditorOption = SelectOption & {
  value: string;
  user_id?: string;
  project_id?: string;
};

export const MAX_ATTACHMENTS = 5;

export const DEFAULT_GHERKIN_STEPS: GherkinStep[] = [
  { keyword: "given", text: "" },
  { keyword: "when", text: "" },
  { keyword: "then", text: "" },
];

export type OptionDef = { value: string; labelKey: string; icon: LucideIcon; iconClass: string };

export const statusOptions: OptionDef[] = [
  { value: "draft", labelKey: "tcopt__status_draft", icon: CircleDashed, iconClass: "text-muted-foreground" },
  { value: "actual", labelKey: "tcopt__status_actual", icon: ListChecks, iconClass: "text-primary" },
  { value: "passed", labelKey: "tcopt__status_passed", icon: CheckCircle2, iconClass: "text-success" },
  { value: "failed", labelKey: "tcopt__status_failed", icon: XCircle, iconClass: "text-destructive" },
  { value: "blocked", labelKey: "tcopt__status_blocked", icon: Ban, iconClass: "text-warning" },
  { value: "deprecated", labelKey: "tcopt__status_deprecated", icon: History, iconClass: "text-muted-foreground" },
];

export const priorityOptions: OptionDef[] = [
  { value: "high", labelKey: "tcopt__priority_high", icon: Shield, iconClass: "text-destructive" },
  { value: "medium", labelKey: "tcopt__priority_medium", icon: Shield, iconClass: "text-warning" },
  { value: "low", labelKey: "tcopt__priority_low", icon: Shield, iconClass: "text-muted-foreground" },
];

export const fixedOptions: OptionDef[] = [
  { value: "no", labelKey: "tcopt__fixed_no", icon: AlertCircle, iconClass: "text-warning" },
  { value: "yes", labelKey: "tcopt__fixed_yes", icon: Check, iconClass: "text-success" },
];

export function createInitialForm(suiteId: string): EditorForm {
  return {
    name: "",
    suiteId,
    projectId: "",
    description: "",
    preconditions: "",
    postconditions: "",
    status: "actual",
    priority: "medium",
    testNo: "",
    input: "",
    expectedResult: "",
    actualResult: "",
    fixed: "no",
    assignDev: "unassigned",
    assignTester: "unassigned",
    devNote: "",
    testNote: "",
    stepFormat: "classic",
    classicSteps: [{ action: "", data: "", expected: "" }],
    gherkinSteps: DEFAULT_GHERKIN_STEPS.map((s) => ({ ...s })),
    gherkinView: "steps",
    gherkinRaw: "",
  };
}
