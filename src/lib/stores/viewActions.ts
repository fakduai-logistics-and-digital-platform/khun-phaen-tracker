import { writable, get } from "svelte/store";
import { browser } from "$app/environment";
import type { ViewMode } from "$lib/types";

const VIEW_MODE_KEY = "khunphaen-view-mode";
const PAGE_SIZE_KEY = "khunphaen-page-size";

export interface ViewActionDeps {
  loadData: () => Promise<void>;
}

export function createViewActions(deps: ViewActionDeps) {
  const currentView = writable<ViewMode>(
    (browser && (localStorage.getItem(VIEW_MODE_KEY) as ViewMode)) || "list",
  );
  const pageSize = writable<number>(
    (browser && parseInt(localStorage.getItem(PAGE_SIZE_KEY) || "20")) || 20,
  );
  const currentPage = writable<number>(1);

  currentView.subscribe((v) => {
    if (browser && v) localStorage.setItem(VIEW_MODE_KEY, v);
  });

  pageSize.subscribe((v) => {
    if (browser && v) localStorage.setItem(PAGE_SIZE_KEY, String(v));
  });

  function switchView(view: ViewMode) {
    currentView.set(view);
  }

  function setPageSize(size: number) {
    pageSize.set(size);
    currentPage.set(1);
    void deps.loadData();
  }

  function handlePageChange(page: number, totalPages: number) {
    if (page < 1 || page > totalPages || page === get(currentPage)) return;
    currentPage.set(page);
    void deps.loadData();
  }

  return {
    currentView,
    pageSize,
    currentPage,
    switchView,
    setPageSize,
    handlePageChange,
  };
}
