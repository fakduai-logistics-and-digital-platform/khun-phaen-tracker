"use client";

import { TcRunList } from "./tc-run-list";
import { TcSuiteList } from "./tc-suite-list";
import type { Suite, TestRun } from "./tc-types";

type TcSidebarProps = {
  width: number;
  onStartResize: (event: React.PointerEvent) => void;
  isAuthorized: boolean;
  suites: Suite[];
  selectedSuiteId: string;
  isSuitesOpen: boolean;
  onToggleSuites: () => void;
  onSelectSuite: (suite: Suite) => void;
  onAddSuite: () => void;
  onDeleteSuite: (suite: Suite) => void;
  runs: TestRun[];
  runsTotal: number;
  selectedRunId?: string;
  isRunsOpen: boolean;
  isLoadingMoreRuns: boolean;
  onToggleRuns: () => void;
  onOpenRun: (run: TestRun) => void;
  onNewRun: () => void;
  onDeleteRun: (run: TestRun) => void;
  onLoadMoreRuns: () => void;
};

export function TcSidebar({
  width,
  onStartResize,
  isAuthorized,
  suites,
  selectedSuiteId,
  isSuitesOpen,
  onToggleSuites,
  onSelectSuite,
  onAddSuite,
  onDeleteSuite,
  runs,
  runsTotal,
  selectedRunId,
  isRunsOpen,
  isLoadingMoreRuns,
  onToggleRuns,
  onOpenRun,
  onNewRun,
  onDeleteRun,
  onLoadMoreRuns,
}: TcSidebarProps) {
  return (
    <aside className="relative hidden shrink-0 border-r border-border bg-background lg:block" style={{ width }}>
      <button
        type="button"
        className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize border-0 bg-transparent transition-colors hover:bg-primary/20 focus:bg-primary/20 focus:outline-none"
        aria-label="Resize sidebar"
        onPointerDown={onStartResize}
      />
      <div className="h-full overflow-y-auto pb-4 pl-4 pr-3 pt-4">
        <TcSuiteList
          suites={suites}
          selectedSuiteId={selectedSuiteId}
          isAuthorized={isAuthorized}
          open={isSuitesOpen}
          onToggleOpen={onToggleSuites}
          onSelectSuite={onSelectSuite}
          onAddSuite={onAddSuite}
          onDeleteSuite={onDeleteSuite}
        />
        <TcRunList
          runs={runs}
          total={runsTotal}
          selectedRunId={selectedRunId}
          isAuthorized={isAuthorized}
          open={isRunsOpen}
          isLoadingMore={isLoadingMoreRuns}
          onToggleOpen={onToggleRuns}
          onOpenRun={onOpenRun}
          onNewRun={onNewRun}
          onDeleteRun={onDeleteRun}
          onLoadMore={onLoadMoreRuns}
        />
      </div>
    </aside>
  );
}
