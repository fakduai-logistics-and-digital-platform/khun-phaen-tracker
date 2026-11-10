"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import type { Project } from "@/lib/types";
import { notify } from "./tc-notify";
import { TcProjectSelect } from "./tc-project-select";
import { mapBackendToFrontend, type Suite, type TestCase } from "./tc-types";

const PAGE_SIZE = 10;
const PARALLEL_MOVES = 4;
const NO_SUITE = "__none__";

type TcMoveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projects: Project[];
  suites: Suite[];
  /** `all`, `none` or a project id: the project on screen, used as the first source filter. */
  currentProject: string;
  onMoved: () => Promise<void>;
};

/** Moves any number of test cases into a project (and optionally one of its suites), picking across pages. */
export function TcMoveDialog({
  open,
  onOpenChange,
  workspaceId,
  projects,
  suites,
  currentProject,
  onMoved,
}: TcMoveDialogProps) {
  const { t } = useI18n();
  const [source, setSource] = useState(currentProject);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("none");
  const [targetSuite, setTargetSuite] = useState(NO_SUITE);
  const [moving, setMoving] = useState(false);

  const projectName = useMemo(() => new Map(projects.map((p) => [String(p.id), p.name])), [projects]);
  const suiteTitle = useMemo(() => new Map(suites.map((s) => [s.id, s.title])), [suites]);
  const targetSuites = useMemo(
    () => suites.filter((s) => s.id !== "unassigned" && (s.project_id || "") === (target === "none" ? "" : target)),
    [suites, target],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.data.testCases.all(workspaceId, { project_id: source === "all" ? undefined : source });
      setCases(res.ok ? (await res.json()).map(mapBackendToFrontend) : []);
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, source]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setPage(1);
    void load();
  }, [open, load]);

  useEffect(() => {
    setTargetSuite(NO_SUITE);
  }, [target]);

  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? cases.filter((c) => `${c.test_no} ${c.title}`.toLowerCase().includes(needle)) : cases;
  }, [cases, query]);
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = matching.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const pageSelected = visible.filter((c) => selected.has(c.id)).length;
  const pageState =
    visible.length > 0 && pageSelected === visible.length ? true : pageSelected > 0 ? "indeterminate" : false;

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of visible) {
        if (checked) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });
  }

  async function move() {
    setMoving(true);
    const ids = [...selected];
    const body = { project_id: target === "none" ? "" : target, suite_id: targetSuite === NO_SUITE ? "" : targetSuite };
    let failed = 0;
    for (let i = 0; i < ids.length; i += PARALLEL_MOVES) {
      const results = await Promise.all(
        ids.slice(i, i + PARALLEL_MOVES).map((id) =>
          api.data.testCases
            .update(id, body)
            .then((res) => res.ok)
            .catch(() => false),
        ),
      );
      failed += results.filter((ok) => !ok).length;
    }
    await onMoved();
    setMoving(false);
    notify(
      failed === 0
        ? t("tcMove__done", { count: ids.length })
        : t("tcMove__partial", { done: ids.length - failed, failed }),
      failed === 0 ? "success" : "error",
    );
    if (failed === 0) onOpenChange(false);
    else void load();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !moving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("tcMove__title")}</DialogTitle>
          <DialogDescription>{t("tcMove__description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <Field>
            <FieldLabel htmlFor="move-source">{t("tcMove__source")}</FieldLabel>
            <TcProjectSelect id="move-source" value={source} projects={projects} includeAll onChange={setSource} />
          </Field>
          <Field>
            <FieldLabel htmlFor="move-search">{t("tcMove__search")}</FieldLabel>
            <Input
              id="move-search"
              value={query}
              placeholder={t("tcMove__search_placeholder")}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={pageState}
                    onCheckedChange={(value) => togglePage(value === true)}
                    aria-label={t("tcMove__select_page")}
                  />
                </TableHead>
                <TableHead className="w-20">#</TableHead>
                <TableHead>{t("tc__test_case")}</TableHead>
                <TableHead className="w-36">{t("tcProject__label")}</TableHead>
                <TableHead className="w-40">{t("tcMove__suite")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Spinner className="mx-auto" />
                  </TableCell>
                </TableRow>
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {t("tcMove__empty")}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((c) => (
                  <TableRow key={c.id} data-state={selected.has(c.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={(value) => toggle(c.id, value === true)}
                        aria-label={c.title}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">TC-{c.test_no}</TableCell>
                    <TableCell className="max-w-0 truncate font-medium">{c.title}</TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {projectName.get(c.project_id || "") || t("tcProject__none")}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {suiteTitle.get(c.suite_id) || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>{t("tcMove__selected", { count: selected.size })}</span>
            {matching.length > 0 && selected.size < matching.length && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => setSelected(new Set(matching.map((c) => c.id)))}
              >
                {t("tcMove__select_all", { count: matching.length })}
              </Button>
            )}
            {selected.size > 0 && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => setSelected(new Set())}
              >
                {t("tcMove__clear")}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={current <= 1}
              aria-label={t("pagination__previous")}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {current} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={current >= pageCount}
              aria-label={t("pagination__next")}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>

        <FieldGroup className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="move-target">{t("tcMove__target")}</FieldLabel>
            <TcProjectSelect id="move-target" value={target} projects={projects} onChange={setTarget} />
          </Field>
          <Field>
            <FieldLabel htmlFor="move-target-suite">{t("tcMove__target_suite")}</FieldLabel>
            <Select value={targetSuite} onValueChange={setTargetSuite}>
              <SelectTrigger id="move-target-suite" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUITE}>{t("tcMove__no_suite")}</SelectItem>
                {targetSuites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{t("tcMove__renumber_hint")}</FieldDescription>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={moving} onClick={() => onOpenChange(false)}>
            {t("page__cancel")}
          </Button>
          <Button type="button" disabled={moving || selected.size === 0} onClick={() => void move()}>
            {moving && <Spinner />}
            {t("tcMove__confirm", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
