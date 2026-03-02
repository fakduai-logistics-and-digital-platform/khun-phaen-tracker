import { theme } from "./theme";
import { showKeyboardShortcuts } from "./keyboardShortcuts";

export type KeyboardActionDeps = {
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  isCommandPaletteOpen: () => boolean;
  setShowForm: (val: boolean) => void;
  setEditingTask: (val: any) => void;
  setShowFilters: (val: boolean | ((prev: boolean) => boolean)) => void;
  setShowMonthlySummary: (val: boolean) => void;
  setShowWorkerManager: (val: boolean) => void;
  setShowProjectManager: (val: boolean) => void;
  setShowSprintManager: (val: boolean) => void;
  setShowTabSettings: (val: boolean) => void;
  focusSearch: () => void;
  switchViewByIndex: (index: number) => void;
  getModalsState: () => {
    showForm: boolean;
    showFilters: boolean;
    showMonthlySummary: boolean;
    showWorkerManager: boolean;
    showProjectManager: boolean;
    showSprintManager: boolean;
    showTabSettings: boolean;
  };
};

export function createKeyboardHandler(deps: KeyboardActionDeps) {
  return function handleKeydown(event: KeyboardEvent) {
    const isCommandPaletteOpen = deps.isCommandPaletteOpen();
    const isCommandPaletteShortcut =
      (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

    if (isCommandPaletteShortcut) {
      event.preventDefault();
      if (isCommandPaletteOpen) {
        deps.closeCommandPalette();
      } else {
        deps.openCommandPalette();
      }
      return;
    }

    if (isCommandPaletteOpen) return;

    // Ignore if user is typing in an input/textarea
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      // Allow Escape to close modals even when in input
      if (event.key === "Escape") {
        const state = deps.getModalsState();
        if (state.showForm) {
          deps.setShowForm(false);
          deps.setEditingTask(null);
          event.preventDefault();
        } else if (state.showFilters) {
          deps.setShowFilters(false);
          event.preventDefault();
        } else if (state.showMonthlySummary) {
          deps.setShowMonthlySummary(false);
          event.preventDefault();
        } else if (state.showWorkerManager) {
          deps.setShowWorkerManager(false);
          event.preventDefault();
        } else if (state.showProjectManager) {
          deps.setShowProjectManager(false);
          event.preventDefault();
        } else if (state.showSprintManager) {
          deps.setShowSprintManager(false);
          event.preventDefault();
        }
      }
      return;
    }

    switch (event.key) {
      case "/":
        event.preventDefault();
        deps.focusSearch();
        break;
      case "n":
      case "N":
        event.preventDefault();
        deps.setShowForm(true);
        deps.setEditingTask(null);
        break;
      case "Escape":
        {
          const state = deps.getModalsState();
          if (state.showForm) {
            deps.setShowForm(false);
            deps.setEditingTask(null);
          } else if (state.showFilters) {
            deps.setShowFilters(false);
          } else if (state.showMonthlySummary) {
            deps.setShowMonthlySummary(false);
          } else if (state.showWorkerManager) {
            deps.setShowWorkerManager(false);
          } else if (state.showProjectManager) {
            deps.setShowProjectManager(false);
          } else if (state.showSprintManager) {
            deps.setShowSprintManager(false);
          } else if (state.showTabSettings) {
            deps.setShowTabSettings(false);
          }
        }
        break;
      case "?":
        event.preventDefault();
        showKeyboardShortcuts.set(true);
        break;
      case "f":
      case "F":
        event.preventDefault();
        deps.setShowFilters((prev) => !prev);
        break;
      case "t":
      case "T":
        event.preventDefault();
        theme.toggle();
        break;
      default: {
        const index = Number.parseInt(event.key, 10);
        if (Number.isInteger(index) && index >= 1 && index <= 9) {
          event.preventDefault();
          deps.switchViewByIndex(index - 1);
        }
        break;
      }
    }
  };
}
