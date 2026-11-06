"use client";

import { useMemo, useState } from "react";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { TcFilterChips } from "./tc-filter-chips";
import { TcFilterMenu } from "./tc-filter-menu";
import { TcSearchBox } from "./tc-search-box";
import { osOptions, priorityOptions, statusOptions, testRunFilterProperties } from "./tc-options";
import type { ActiveFilters, AssigneeOption, NewTestRunForm, Suite, TestCase } from "./tc-types";
import type { useTcRuns } from "./use-tc-runs";

type Runs = ReturnType<typeof useTcRuns>;

function matchesQuery(testCase: TestCase, suite: Suite, query: string, field: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields: Record<string, string> = {
    test_no: `tc-${testCase.test_no} ${testCase.test_no}`,
    name: testCase.title,
    suite: suite.title,
    description: testCase.description || "",
    preconditions: testCase.preconditions || "",
    postconditions: testCase.postconditions || "",
    steps: (testCase.steps || []).map((s) => `${s.action} ${s.data} ${s.expected}`).join(" "),
  };
  const haystack = field === "all" ? Object.values(fields).join(" ") : (fields[field] ?? "");
  return haystack.toLowerCase().includes(q);
}

export function TcNewRunDialog({
  runs,
  suites,
  assigneeOptions,
  onSubmit,
}: {
  runs: Runs;
  suites: Suite[];
  assigneeOptions: AssigneeOption[];
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [field, setField] = useState("all");
  const [filters, setFilters] = useState<ActiveFilters>({ priority: [], status: [] });
  const form = runs.newTestRunForm;
  const setForm = (patch: Partial<NewTestRunForm>) => runs.setNewTestRunForm({ ...form, ...patch });

  const toggleFilter = (property: string, value: string) =>
    setFilters((prev) => {
      const current = prev[property] || [];
      return {
        ...prev,
        [property]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });

  const visibleSuites = useMemo(
    () =>
      suites
        .map((suite) => ({
          ...suite,
          cases: suite.cases.filter(
            (c) =>
              matchesQuery(c, suite, query, field) &&
              (filters.priority.length === 0 || filters.priority.includes(c.priority)) &&
              (filters.status.length === 0 || filters.status.includes(c.status)),
          ),
        }))
        .filter((suite) => suite.cases.length > 0),
    [suites, query, field, filters],
  );

  const selectedCount = runs.selectedTestCaseIds.size;

  return (
    <Dialog open={runs.showNewTestRunModal} onOpenChange={(next) => runs.setShowNewTestRunModal(next)}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>New test run</DialogTitle>
          <DialogDescription className="sr-only">{t("tc__ph_run_name")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Input
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
            placeholder={t("tc__ph_run_name")}
            aria-label={t("tc__ph_run_name")}
            className="h-11 text-base"
          />
          <div className="space-y-2">
            <Label htmlFor="new-run-description">{t("tc__description")}</Label>
            <Textarea
              id="new-run-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ description: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-test-run-assignee">{t("tc__default_assignee")}</Label>
              <SearchableSelect
                id="new-test-run-assignee"
                value={form.defaultAssignee}
                options={assigneeOptions}
                onSelect={(v) => setForm({ defaultAssignee: String(v ?? "") })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-test-run-os">{t("tc__operating_system")}</Label>
              <SearchableSelect
                id="new-test-run-os"
                value={form.operatingSystem}
                options={osOptions}
                showSearch={false}
                onSelect={(v) => setForm({ operatingSystem: String(v ?? "") })}
              />
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Test cases</h3>
              <span className="text-sm tabular-nums text-muted-foreground">{selectedCount} selected</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TcSearchBox
                value={query}
                onValueChange={setQuery}
                field={field}
                onFieldChange={setField}
                fieldSelectId="test-run-search-field"
                className="min-w-[240px] flex-1"
              />
              <TcFilterMenu
                properties={testRunFilterProperties}
                optionsFor={(p) => (p === "priority" ? priorityOptions : p === "status" ? statusOptions : [])}
                selected={filters}
                onToggle={toggleFilter}
                onClearAll={() => setFilters({ priority: [], status: [] })}
                clearLabel="Clear all filters"
                clearOnlyWhenActive
                compact
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <TcFilterChips
                filters={filters}
                properties={testRunFilterProperties}
                labelFor={(_, value) => value}
                onRemove={(property, value) => value && toggleFilter(property, value)}
                perValue
              />
            </div>

            <div className="overflow-hidden rounded-lg border">
              {visibleSuites.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">No test cases</p>
              )}
              {visibleSuites.map((suite) => {
                const all = suite.cases.every((c) => runs.selectedTestCaseIds.has(c.id));
                return (
                  <div key={suite.id} className="border-b last:border-b-0">
                    <label className="flex cursor-pointer items-center gap-3 bg-muted/40 px-4 py-2.5 text-sm font-bold">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={all}
                        onChange={() => runs.toggleSuiteSelection(suite)}
                      />
                      {suite.title}
                      <span className="ms-auto text-xs font-normal tabular-nums text-muted-foreground">
                        {suite.cases.length}
                      </span>
                    </label>
                    {suite.cases.map((c) => (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-3 border-t px-4 py-2 text-sm hover:bg-accent/40"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={runs.selectedTestCaseIds.has(c.id)}
                          onChange={() => runs.toggleTestCaseSelection(c.id)}
                        />
                        <span className="w-14 shrink-0 tabular-nums text-muted-foreground">TC-{c.test_no}</span>
                        <span className="truncate">{c.title}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => runs.setShowNewTestRunModal(false)}>
            {t("tc__cancel")}
          </Button>
          <Button type="button" disabled={!form.name.trim() || selectedCount === 0} onClick={onSubmit}>
            {t("tc__start_run")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
