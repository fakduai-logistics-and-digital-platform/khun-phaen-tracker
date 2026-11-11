import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TASK_TYPES, TASK_TYPE_BRANCH_PREFIX, getBranchPrefixForTaskType } from "../web/lib/utils/branch-name";
import { TASK_TYPE_BADGE, TASK_TYPE_ICON_CLASS } from "../web/lib/utils/task-type-style";

const locale = (name: string): Record<string, string> =>
  JSON.parse(readFileSync(new URL(`../web/lib/i18n/locales/${name}.json`, import.meta.url), "utf8"));
const mcpSource = readFileSync(new URL("../backend-worker/src/mcp.rs", import.meta.url), "utf8");

describe("task types", () => {
  it("includes test and ui", () => {
    expect(TASK_TYPES).toEqual(expect.arrayContaining(["test", "ui"]));
  });

  it.each(TASK_TYPES)("%s has a badge, an icon color, a branch prefix and both translations", (type) => {
    expect(TASK_TYPE_BADGE[type].label).toBeTruthy();
    expect(TASK_TYPE_BADGE[type].className).toMatch(/^bg-\S+ text-\S+/);
    expect(TASK_TYPE_ICON_CLASS[type]).toMatch(/^text-/);
    expect(TASK_TYPE_BRANCH_PREFIX[type]).toBeTruthy();
    expect(locale("en")[`taskForm__task_type_${type}`]).toBeTruthy();
    expect(locale("th")[`taskForm__task_type_${type}`]).toBeTruthy();
  });

  it("gives every type its own color", () => {
    const colors = TASK_TYPES.map((type) => TASK_TYPE_ICON_CLASS[type].split(" ")[0]);
    expect(new Set(colors).size).toBe(TASK_TYPES.length);
  });

  it("maps test and ui to their own branch prefixes and falls back to feature", () => {
    expect(getBranchPrefixForTaskType("test")).toBe("test");
    expect(getBranchPrefixForTaskType("ui")).toBe("ui");
    expect(getBranchPrefixForTaskType(undefined)).toBe("feature");
  });

  it("keeps the MCP tool in sync with the web task types", () => {
    const declared = /const TASK_TYPES: \[&str; \d+\] = \[([^\]]+)\]/.exec(mcpSource)?.[1] ?? "";
    const types = [...declared.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
    expect(types.sort()).toEqual([...TASK_TYPES].sort());
  });
});
