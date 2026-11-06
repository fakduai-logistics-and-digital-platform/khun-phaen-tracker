import localFont from "next/font/local";

// LINE Seed Sans TH (Thai + Latin), OFL-1.1, https://seed.line.me/
export const lineSeed = localFont({
  variable: "--font-line-seed",
  display: "swap",
  src: [
    { path: "./fonts/LINESeedSansTH_W_Th.woff2", weight: "100", style: "normal" },
    { path: "./fonts/LINESeedSansTH_W_Rg.woff2", weight: "400", style: "normal" },
    { path: "./fonts/LINESeedSansTH_W_Bd.woff2", weight: "700", style: "normal" },
    { path: "./fonts/LINESeedSansTH_W_XBd.woff2", weight: "800", style: "normal" },
    { path: "./fonts/LINESeedSansTH_W_He.woff2", weight: "900", style: "normal" },
  ],
});
