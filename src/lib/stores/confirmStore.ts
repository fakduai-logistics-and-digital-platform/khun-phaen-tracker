import { writable } from "svelte/store";

export type ConfirmState = {
  show: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onClose: () => void;
};

export const confirmModalStore = writable<ConfirmState>({
  show: false,
  title: "",
  message: "",
  onConfirm: () => {},
  onClose: () => {},
});

export function requestConfirm(
  options: Omit<ConfirmState, "show" | "onConfirm" | "onClose">,
): Promise<boolean> {
  return new Promise((resolve) => {
    confirmModalStore.set({
      ...options,
      show: true,
      onConfirm: () => {
        confirmModalStore.update((s) => ({ ...s, show: false }));
        resolve(true);
      },
      onClose: () => {
        confirmModalStore.update((s) => ({ ...s, show: false }));
        resolve(false);
      },
    });
  });
}
