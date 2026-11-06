import { get, type Writable } from "@/lib/store";
import type { TabId } from "./tabSettings";
import type { ModalState, ModalName } from "./uiActions";

interface UI {
  openModal: (m: ModalName) => void;
  closeModal: (m: ModalName) => void;
  setModalState: (m: ModalName, v: boolean) => void;
}

export function getKeyboardConfig(deps: {
  uiActions: UI;
  modals: Writable<ModalState>;
  editingTask: any;
  setEditingTask: (v: any) => void;
  searchInputRef: HTMLInputElement | null;
  visibleTabs: { id: TabId; icon: string }[];
  viewActions: any;
}) {
  const { uiActions, modals, setEditingTask, searchInputRef, visibleTabs, viewActions } = deps;

  return {
    openCommandPalette: () => uiActions.openModal("commandPalette"),
    closeCommandPalette: () => uiActions.closeModal("commandPalette"),
    isCommandPaletteOpen: () => get(modals).commandPalette,
    setShowForm: (v: boolean) => uiActions.setModalState("form", v),
    setEditingTask: (v: any) => {
      setEditingTask(v);
    },
    setShowFilters: (v: any) => {
      if (typeof v === "function") {
        uiActions.setModalState("filters", v(get(modals).filters));
      } else {
        uiActions.setModalState("filters", v);
      }
    },
    setShowMonthlySummary: (v: boolean) => uiActions.setModalState("monthlySummary", v),
    setShowWorkerManager: (v: boolean) => uiActions.setModalState("workerManager", v),
    setShowProjectManager: (v: boolean) => uiActions.setModalState("projectManager", v),
    setShowSprintManager: (v: boolean) => uiActions.setModalState("sprintManager", v),
    setShowTabSettings: (v: boolean) => uiActions.setModalState("tabSettings", v),
    focusSearch: () => searchInputRef?.focus(),
    switchViewByIndex: (index: number) => {
      if (visibleTabs[index]) viewActions.switchView(visibleTabs[index].id);
    },
    getModalsState: () => {
      const s = get(modals);
      return {
        showForm: s.form,
        showFilters: s.filters,
        showMonthlySummary: s.monthlySummary,
        showWorkerManager: s.workerManager,
        showProjectManager: s.projectManager,
        showSprintManager: s.sprintManager,
        showTabSettings: s.tabSettings,
      };
    },
  };
}
