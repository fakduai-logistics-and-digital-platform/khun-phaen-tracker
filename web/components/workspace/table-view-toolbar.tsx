"use client";

import { useState } from "react";
import type { Sprint, Task } from "@/lib/types";
import type { FilterField, TableQuery } from "./table-query";
import { TableViewColumnToggle } from "./table-view-column-toggle";
import { TableViewFilterMenu } from "./table-view-filter-menu";
import { TableViewSortMenu } from "./table-view-sort-menu";

type Props = {
  tasks: Task[];
  sprints: Sprint[];
  query: TableQuery;
  onQueryChange: (patch: Partial<TableQuery>) => void;
};

export function TableViewToolbar({ tasks, sprints, query, onQueryChange }: Props) {
  const [openField, setOpenField] = useState<FilterField | null>(null);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <TableViewSortMenu sorts={query.sorts} onChange={(sorts) => onQueryChange({ sorts })} />
        <TableViewFilterMenu
          tasks={tasks}
          sprints={sprints}
          filters={query.filters}
          openField={openField}
          onOpenField={setOpenField}
          onChange={(filters) => onQueryChange({ filters })}
        />
      </div>
      <TableViewColumnToggle />
    </div>
  );
}
