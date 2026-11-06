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
} from "lucide-react";
import type { SelectOption } from "@/components/shared/searchable-select";
import type { ClassicStep, GherkinStep } from "./test-case-step-list";

export type Status = "draft" | "actual" | "failed" | "blocked" | "deprecated" | "passed";
export type Priority = "high" | "medium" | "low";
export type StepFormat = "gherkin" | "classic";

export type EditorForm = {
  name: string;
  suiteId: string;
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
};

export const MAX_ATTACHMENTS = 5;

export const DEFAULT_GHERKIN_STEPS: GherkinStep[] = [
  { keyword: "given", text: "" },
  { keyword: "when", text: "" },
  { keyword: "then", text: "" },
];

export const statusOptions: EditorOption[] = [
  { value: "draft", label: "Draft", icon: CircleDashed, iconClass: "text-gray-400" },
  { value: "actual", label: "Actual", icon: ListChecks, iconClass: "text-blue-400" },
  { value: "passed", label: "Passed", icon: CheckCircle2, iconClass: "text-green-400" },
  { value: "failed", label: "Failed", icon: XCircle, iconClass: "text-rose-400" },
  { value: "blocked", label: "Blocked", icon: Ban, iconClass: "text-gray-500" },
  { value: "deprecated", label: "Deprecated", icon: History, iconClass: "text-gray-600" },
];

export const priorityOptions: EditorOption[] = [
  { value: "high", label: "High", icon: Shield, iconClass: "text-rose-500" },
  { value: "medium", label: "Medium", icon: Shield, iconClass: "text-amber-500" },
  { value: "low", label: "Low", icon: Shield, iconClass: "text-gray-400" },
];

export const fixedOptions: EditorOption[] = [
  { value: "no", label: "Not fixed", icon: AlertCircle, iconClass: "text-amber-400" },
  { value: "yes", label: "Fixed", icon: Check, iconClass: "text-green-400" },
];

export const stepFormatOptions: EditorOption[] = [
  { value: "gherkin", label: "Gherkin" },
  { value: "classic", label: "Classic" },
];

export function createInitialForm(suiteId: string): EditorForm {
  return {
    name: "",
    suiteId,
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
