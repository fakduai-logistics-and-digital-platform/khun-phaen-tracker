"use client";

import { confirmModalStore } from "@/lib/stores/confirmStore";
import { useStore } from "@/lib/store";
import { ConfirmModal } from "./confirm-modal";

export function GlobalConfirmModal() {
  const state = useStore(confirmModalStore);

  return (
    <ConfirmModal
      show={state.show}
      title={state.title}
      message={state.message}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      type={state.type}
      onConfirm={state.onConfirm}
      onClose={state.onClose}
    />
  );
}
