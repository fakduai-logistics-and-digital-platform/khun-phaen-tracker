import { api } from "@/lib/api/apis";
import { MY_TASKS_WORKSPACE_ID } from "@/lib/workspace";

export type PreviewCase = {
  name: string;
  detail: string;
  badge: string;
  tone: "blue" | "amber" | "cyan";
};

export type LoginSummary = {
  activeTasks: number;
  testCases: number;
  teammates: number;
  latestRunName: string;
  latestRunSubtitle: string;
  sampleCases: PreviewCase[];
};

export const FALLBACK_SUMMARY: LoginSummary = {
  activeTasks: 128,
  testCases: 42,
  teammates: 8,
  latestRunName: "Test run regression",
  latestRunSubtitle: "34 passed, 3 blocked",
  sampleCases: [
    { name: "Release checklist", detail: "API, QA, deploy", badge: "Actual", tone: "blue" },
    { name: "Test run regression", detail: "34 passed, 3 blocked", badge: "Medium", tone: "amber" },
    { name: "Warehouse sync", detail: "offline queue ready", badge: "Ready", tone: "cyan" },
  ],
};

function getSummaryWorkspaceId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("workspace_id") || params.get("ws_id") || localStorage.getItem("current-workspace-id") || "";
}

function formatRunSubtitle(stats: Record<string, number> | undefined) {
  if (!stats) return FALLBACK_SUMMARY.latestRunSubtitle;
  const parts = (
    [
      ["passed", stats.passed],
      ["failed", stats.failed],
      ["blocked", stats.blocked],
      ["pending", stats.pending],
    ] as const
  )
    .filter(([, count]) => Number(count) > 0)
    .slice(0, 2)
    .map(([label, count]) => `${count} ${label}`);
  return parts.length > 0 ? parts.join(", ") : `${stats.total || 0} cases`;
}

function formatPreviewCase(testCase: Record<string, any>, index: number): PreviewCase {
  const status: string = testCase?.status || "actual";
  const priority = testCase?.priority || "medium";
  const testNo = testCase?.test_no ? `TC-${testCase.test_no}` : "Test case";
  return {
    name: testCase?.name || FALLBACK_SUMMARY.sampleCases[index]?.name || "Test case",
    detail: `${testNo}, ${priority}`,
    badge: status.charAt(0).toUpperCase() + status.slice(1),
    tone: (["blue", "amber", "cyan"] as const)[index % 3],
  };
}

/** Returns null when there is nothing public to show, so callers keep the fallback. */
export async function loadPublicLoginSummary(): Promise<LoginSummary | null> {
  const workspaceId = getSummaryWorkspaceId();
  if (!workspaceId || workspaceId === MY_TASKS_WORKSPACE_ID) return null;
  try {
    const response = await api.public.getSummary(workspaceId);
    if (!response.ok) return null;
    const data = await response.json();
    const sampleCases = (data.sample_cases || []).slice(0, 3).map(formatPreviewCase);
    return {
      activeTasks: Number(data.active_tasks ?? FALLBACK_SUMMARY.activeTasks),
      testCases: Number(data.test_cases ?? FALLBACK_SUMMARY.testCases),
      teammates: Number(data.teammates ?? FALLBACK_SUMMARY.teammates),
      latestRunName: data.latest_run?.name || FALLBACK_SUMMARY.latestRunName,
      latestRunSubtitle: data.latest_run?.stats
        ? formatRunSubtitle(data.latest_run.stats)
        : FALLBACK_SUMMARY.latestRunSubtitle,
      sampleCases: sampleCases.length > 0 ? sampleCases : FALLBACK_SUMMARY.sampleCases,
    };
  } catch {
    return null;
  }
}
