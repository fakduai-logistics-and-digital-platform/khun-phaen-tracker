import { translate } from "@/lib/i18n";

function activeLocaleTag() {
  return translate("tcpub__date_locale");
}

export type PublicTestCase = {
  id: string;
  test_no: number;
  title: string;
  priority: "high" | "medium" | "low";
  status: string;
  description: string;
  assign_dev: string;
  fixed: string;
  suite_id: string;
  preconditions?: string;
  postconditions?: string;
  input?: string;
  expected_result?: string;
  actual_result?: string;
  step_format?: string;
  gherkin_steps?: any[];
  classic_steps?: any[];
};

export type PublicSuite = {
  id: string;
  title: string;
  case_count: number;
  cases: PublicTestCase[];
  collapsed: boolean;
  page: number;
  hasMore: boolean;
};

export type LatestRunStats = {
  total: number;
  pending: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  invalid: number;
};

export type LatestTestRun = {
  id: string;
  name: string;
  description: string | null;
  default_assignee: string;
  operating_system: string;
  status: string;
  stats: LatestRunStats;
  test_cases: { test_case_id: string; status: string }[];
  created_at: string | null;
  updated_at: string | null;
};

export const PAGE_SIZE = 50;

export function mapCase(tc: any): PublicTestCase {
  return {
    id: tc.id || tc._id,
    test_no: tc.test_no,
    title: tc.name || tc.title || "",
    priority: tc.priority || "medium",
    status: tc.status || "actual",
    description: tc.description || "",
    assign_dev: tc.assign_dev || "unassigned",
    fixed: tc.fixed || "no",
    suite_id: tc.suite_id || "",
    preconditions: tc.preconditions,
    postconditions: tc.postconditions,
    input: tc.input,
    expected_result: tc.expected_result,
    actual_result: tc.actual_result,
    step_format: tc.step_format,
    gherkin_steps: tc.gherkin_steps,
    classic_steps: tc.classic_steps,
  };
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(activeLocaleTag(), {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function buildCsv(
  cases: PublicTestCase[],
  suiteTitles: Map<string, string>,
  runCaseMap: Map<string, string>,
): string {
  const headers = [
    "Suite",
    "Test Case No",
    "Test Name",
    "Status",
    "Run Result",
    "Assign Dev",
    "Precondition",
    "Input",
    "Expected Result",
    "Actual Result",
    "Test Step",
  ];

  const rows = cases.map((c) => {
    const steps =
      c.step_format === "gherkin"
        ? (c.gherkin_steps || []).map((s: any) => `${s.keyword} ${s.text}`).join("\n")
        : (c.classic_steps || []).map((s: any) => s.action).join("\n");
    return [
      String(suiteTitles.get(c.suite_id) || "Unassigned"),
      String(c.test_no),
      String(c.title || ""),
      String(c.status || ""),
      String(runCaseMap.get(c.id) || "—"),
      String(c.assign_dev || "unassigned"),
      String(c.preconditions || ""),
      String(c.input || ""),
      String(c.expected_result || ""),
      String(c.actual_result || ""),
      String(steps || ""),
    ];
  });

  let csv = headers.join(",") + "\n";
  rows.forEach((row) => {
    csv += row.map((v) => `"${(v || "").replace(/"/g, '""')}"`).join(",") + "\n";
  });
  return csv;
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
