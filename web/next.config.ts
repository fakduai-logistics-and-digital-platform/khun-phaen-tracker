import type { NextConfig } from "next";

const API_ORIGIN = "https://api.khun-phaen.workers.dev";

// GitHub Pages build: static export under the repository sub-path (set NEXT_PUBLIC_BASE_PATH, e.g. "/khun-phaen-tracker").
const isPagesBuild = process.env.DEPLOY_TARGET === "pages";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = isPagesBuild
  ? {
      output: "export",
      trailingSlash: true,
      basePath,
      images: { unoptimized: true },
    }
  : {
      // Dev convenience: the API only allows CORS for the deployed site, so browsers reach it through
      // this same-origin rewrite when NEXT_PUBLIC_API_URL=/kp-api/api (see .env.local).
      async rewrites() {
        return [{ source: "/kp-api/:path*", destination: `${API_ORIGIN}/:path*` }];
      },
    };

export default nextConfig;
