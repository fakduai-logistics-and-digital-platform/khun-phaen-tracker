import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

// Static build for GitHub Pages (`DEPLOY_TARGET=pages`, see next.config.ts): only the generated HTML/assets are published.
// vinext still requires the Cloudflare plugin whenever cloudflare.config.ts exists, so the Worker bundle is built and ignored.
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
});
