import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";

// Warnings below originate inside vinext's generated virtual entries and plugin transforms, not in app code.
const IGNORED_BUILD_WARNINGS = new Set(["SOURCEMAP_BROKEN", "INEFFECTIVE_DYNAMIC_IMPORT"]);

export default defineConfig({
  build: {
    // Excalidraw is lazy-loaded and legitimately large.
    chunkSizeWarningLimit: 2500,
    rolldownOptions: {
      checks: { pluginTimings: false },
      onwarn(warning, defaultHandler) {
        if (warning.code && IGNORED_BUILD_WARNINGS.has(warning.code)) return;
        defaultHandler(warning);
      },
    },
  },
  plugins: [
    vinext({
      images: { optimizer: imagesOptimizer() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
