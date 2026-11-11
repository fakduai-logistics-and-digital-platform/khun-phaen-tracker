export type Step = {
  action: string;
  data: string;
  expected: string;
};

export type ClassicStep = Step;

export type GherkinStep = {
  keyword: "given" | "when" | "then" | "and";
  text: string;
};

export type TestCaseAttachment = {
  id: string;
  filename: string;
  file_key: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
};

export type TestCasePriority = "high" | "medium" | "low";

export type TestCase = {
  id: string;
  test_no: number;
  title: string;
  type: "manual" | "automated";
  priority: TestCasePriority;
  status: "draft" | "actual" | "failed" | "blocked" | "deprecated" | "passed";
  assignee?: string;
  description: string;
  preconditions?: string;
  postconditions?: string;
  steps: Step[];
  classic_steps?: ClassicStep[];
  gherkin_steps?: GherkinStep[];
  step_format: "classic" | "gherkin";
  input?: string;
  expected_result?: string;
  actual_result?: string;
  assign_dev?: string;
  fixed: "no" | "yes";
  suite_id: string;
  dev_note?: string;
  test_note?: string;
  attachments: TestCaseAttachment[];
  project_id?: string;
  updated_at?: string;
  passed_at?: string | null;
};

export type Suite = {
  id: string;
  title: string;
  description: string;
  project_id?: string;
  cases: TestCase[];
  page: number;
  hasMore: boolean;
  totalCount?: number;
};

export type TestRun = {
  _id: string;
  name: string;
  description: string | null;
  default_assignee: string;
  operating_system: string;
  test_cases: { test_case_id: string; status: string }[];
  created_at: string;
  status: "running" | "completed" | "aborted";
  created_by?: string;
  created_by_name?: string;
};

export type TestRunCaseDetail = {
  test_case_id: string;
  status: string;
  note?: string | null;
  test_case: {
    id: string;
    test_no: number;
    name: string;
    suite_id: string;
    priority: string;
    status: string;
  } | null;
};

export type TestRunDetail = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  default_assignee: string;
  operating_system: string;
  status: string;
  test_cases: TestRunCaseDetail[];
  stats: {
    total: number;
    pending: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    invalid: number;
  };
  created_by?: string;
  created_by_name?: string;
  created_by_avatar_url?: string;
  created_by_color?: string;
  created_at: string | null;
  updated_at: string | null;
};

export type NewTestRunForm = {
  name: string;
  description: string;
  defaultAssignee: string;
  operatingSystem: string;
};

export type AssigneeRecord = {
  id?: string | number;
  name: string;
  color?: string;
  avatar_url?: string;
  avatarUrl?: string;
  user_id?: string;
};

export type AssigneeOption = {
  value: string;
  label: string;
  user_id: string | null | undefined;
  avatarUrl?: string;
  avatarColor?: string;
};

export type ActiveFilters = Record<string, string[]>;

export const EMPTY_FILTERS: ActiveFilters = {
  priority: [],
  status: [],
  fixed: [],
  assign_dev: [],
};

export type ImportProgress = { current: number; total: number; status: string };

export type ImportSummary = {
  success: number;
  failed: number;
  failedNames: string[];
  skipped: { row: number; reason: string; name?: string }[];
};

export type SidebarTab = "general" | "notes" | "properties" | "attachments";

export function mapBackendToFrontend(tc: any): TestCase {
  return {
    id: tc.id || tc._id,
    test_no: tc.test_no,
    title: tc.name,
    type: "manual",
    priority: tc.priority || "medium",
    status: tc.status,
    assignee: tc.assign_tester || "unassigned",
    description: tc.description || "",
    preconditions: tc.preconditions || "",
    postconditions: tc.postconditions || "",
    step_format: tc.step_format || "classic",
    classic_steps: tc.classic_steps,
    gherkin_steps: tc.gherkin_steps,
    steps:
      tc.classic_steps ||
      (tc.gherkin_steps || []).map((s: any) => ({
        action: `${s.keyword} ${s.text}`,
        data: "",
        expected: "",
      })),
    input: tc.input || "",
    expected_result: tc.expected_result || "",
    actual_result: tc.actual_result || "",
    assign_dev: tc.assign_dev || "unassigned",
    fixed: tc.fixed || "no",
    suite_id: tc.suite_id,
    dev_note: tc.dev_note || "",
    test_note: tc.test_note || "",
    attachments: tc.attachments || [],
    project_id: tc.project_id || "",
    updated_at: tc.updated_at,
    passed_at: tc.passed_at ?? null,
  };
}
