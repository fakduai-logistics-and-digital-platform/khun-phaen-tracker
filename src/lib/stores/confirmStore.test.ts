import { describe, it, expect, vi } from "vitest";
import { confirmModalStore, requestConfirm } from "./confirmStore";
import { get } from "svelte/store";

describe("confirmStore", () => {
  it("should initialize with show: false", () => {
    const state = get(confirmModalStore);
    expect(state.show).toBe(false);
  });

  it("should update store when requestConfirm is called", async () => {
    const promise = requestConfirm({
      title: "Confirm",
      message: "Are you sure?",
    });

    const state = get(confirmModalStore);
    expect(state.show).toBe(true);
    expect(state.title).toBe("Confirm");
    expect(state.message).toBe("Are you sure?");

    // Resolve onConfirm
    state.onConfirm();

    const result = await promise;
    expect(result).toBe(true);
    expect(get(confirmModalStore).show).toBe(false);
  });

  it("should resolve false when onClose is called", async () => {
    const promise = requestConfirm({
      title: "Confirm",
      message: "Are you sure?",
    });

    const state = get(confirmModalStore);
    state.onClose();

    const result = await promise;
    expect(result).toBe(false);
    expect(get(confirmModalStore).show).toBe(false);
  });
});
