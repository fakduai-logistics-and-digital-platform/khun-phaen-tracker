/// <reference types="vitest/config" />
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

function patchSvelteDndActionParentElementGuard(): Plugin {
  return {
    name: "patch-svelte-dnd-action-parent-element-guard",
    enforce: "pre",
    transform(code, id) {
      if (
        !/svelte-dnd-action[\\/](dist[\\/]index\.(m?js)|src[\\/]pointerAction\.js)(\?.*)?$/.test(
          id,
        )
      ) {
        return null;
      }

      if (!code.includes("originalDragTarget.parentElement")) {
        return null;
      }

      const patched = code.replace(
        /function keepOriginalElementInDom\(\)\s*\{\s*\n([ \t]*)if\s*\(!originalDragTarget(?:\s*\|\|\s*!originalDragTarget\.parentElement|\.parentElement)\)\s*\{/g,
        "function keepOriginalElementInDom() {\n$1if (!originalDragTarget) {\n$1    return;\n$1}\n$1if (!originalDragTarget.parentElement) {",
      );

      if (patched === code) return null;
      return patched;
    },
  };
}

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [patchSvelteDndActionParentElementGuard(), tailwindcss(), sveltekit()],
  optimizeDeps: {
    exclude: [
      "@duckdb/duckdb-wasm",
      "@sqlite.org/sqlite-wasm",
      "svelte-dnd-action",
    ],
  },
  build: {
    target: "esnext",
  },
  worker: {
    format: "es",
  },
  test: {
    projects: [
      {
        extends: true,
        resolve: {
          conditions: ["browser"],
        },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
          exclude: ["src/stories/**"],
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
    ],
  },
});
