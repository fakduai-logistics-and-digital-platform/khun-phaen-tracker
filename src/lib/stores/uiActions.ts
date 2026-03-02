import { writable } from "svelte/store";

export type ToastType = "success" | "error";
export type ToastState = {
  message: string;
  type: ToastType;
} | null;

export const toast = writable<ToastState>(null);

export function showMessage(message: string, type: ToastType = "success") {
  toast.set({ message, type });
  setTimeout(() => toast.set(null), 3000);
}

export type ModalName =
  | "form"
  | "filters"
  | "workerManager"
  | "projectManager"
  | "monthlySummary"
  | "tabSettings"
  | "sprintManager"
  | "changeSprint"
  | "qrExport"
  | "commandPalette"
  | "dailyReflect"
  | "pageSize"
  | "workspaceSettings";

export type ModalState = {
  form: boolean;
  filters: boolean;
  workerManager: boolean;
  projectManager: boolean;
  monthlySummary: boolean;
  tabSettings: boolean;
  sprintManager: boolean;
  changeSprint: boolean;
  qrExport: boolean;
  commandPalette: boolean;
  dailyReflect: boolean;
  pageSize: boolean;
  workspaceSettings: boolean;
};

const initialModalState: ModalState = {
  form: false,
  filters: false,
  workerManager: false,
  projectManager: false,
  monthlySummary: false,
  tabSettings: false,
  sprintManager: false,
  changeSprint: false,
  qrExport: false,
  commandPalette: false,
  dailyReflect: false,
  pageSize: false,
  workspaceSettings: false,
};

export const modals = writable<ModalState>(initialModalState);

export type UIActionsDeps = {
  notify?: (message: string, type?: ToastType) => void;
};

export function createUIActions(deps: UIActionsDeps = {}) {
  const notify = deps.notify || showMessage;

  return {
    openModal: (name: ModalName) => {
      modals.update((s) => ({ ...s, [name]: true }));
    },
    closeModal: (name: ModalName) => {
      modals.update((s) => ({ ...s, [name]: false }));
    },
    toggleModal: (name: ModalName) => {
      modals.update((s) => ({ ...s, [name]: !s[name] }));
    },
    closeAllModals: () => {
      modals.set(initialModalState);
    },
    showMessage: notify,
    setModalState: (name: ModalName, value: boolean) => {
      modals.update((s) => ({ ...s, [name]: value }));
    },
  };
}
