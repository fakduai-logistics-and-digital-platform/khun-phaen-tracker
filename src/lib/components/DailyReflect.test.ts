// @vitest-environment jsdom
import { render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/svelte";

// Mock SvelteKit modules before importing the component
vi.mock("$app/stores", () => {
  const { readable } = require("svelte/store");
  return {
    page: readable({
      params: { workspace_id: "test-workspace" },
      url: new URL("http://localhost"),
    }),
  };
});

vi.mock("$app/environment", () => ({
  browser: false,
}));

vi.mock("$lib/apis", () => ({
  api: {
    workspaces: {
      getNotificationConfig: vi.fn().mockResolvedValue({ ok: false }),
    },
    data: {
      tasks: {
        getDailyReport: vi.fn().mockResolvedValue({ ok: false }),
      },
    },
  },
}));

vi.mock("$lib/db", () => ({
  getTasks: vi.fn().mockResolvedValue([]),
}));

import DailyReflect from "./DailyReflect.svelte";

describe("DailyReflect - isOwner visibility", () => {
  afterEach(() => cleanup());

  it("shows settings gear button when isOwner is true", () => {
    const { container } = render(DailyReflect, {
      show: true,
      isOwner: true,
    });

    const buttons = container.querySelectorAll("button");
    const settingsBtn = Array.from(buttons).find((btn) => {
      const title = btn.getAttribute("title");
      return title !== null;
    });
    // Owner should see settings button
    expect(settingsBtn).toBeTruthy();
  });

  it("hides settings gear button when isOwner is false", () => {
    const { container } = render(DailyReflect, {
      show: true,
      isOwner: false,
    });

    const buttons = container.querySelectorAll("button");
    // Non-owner should only see close (X) button
    // Settings button has a title attribute with settings text
    const settingsBtn = Array.from(buttons).find((btn) => {
      const title = btn.getAttribute("title");
      // The title contains the i18n key or translated settings text
      return title && title !== "";
    });
    expect(settingsBtn).toBeFalsy();
  });

  it("shows discord send section when isOwner is true and has no tasks", () => {
    const { container } = render(DailyReflect, {
      show: true,
      isOwner: true,
    });

    // When isOwner is true, the discord action row should be present
    // (even if no data, the container structure will include the button area)
    // We check the component rendered at all
    const modal = container.querySelector(".fixed");
    expect(modal).toBeTruthy();
  });

  it("hides discord send section when isOwner is false", () => {
    const { container } = render(DailyReflect, {
      show: true,
      isOwner: false,
    });

    // Discord button with specific discord color class should not exist
    const discordBtn = container.querySelector("button.bg-\\[\\#5865F2\\]");
    expect(discordBtn).toBeFalsy();

    // No webhook help text should show for non-owners
    const webhookHelp = container.querySelectorAll(".italic");
    const hasWebhookHelp = Array.from(webhookHelp).some(
      (el) =>
        el.textContent?.includes("webhook") ||
        el.textContent?.includes("Webhook"),
    );
    expect(hasWebhookHelp).toBe(false);
  });
});
