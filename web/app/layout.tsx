import type { Metadata } from "next";
import "./globals.css";
import { lineSeed } from "./fonts";
import { AppProviders } from "@/components/app-providers";
import { PALETTE_INIT_SCRIPT } from "@/lib/palette";

// Every page is a client component that loads its data in the browser, so the whole app can be exported as static HTML.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Khun Phaen — ระบบจัดการงาน",
  description: "Khun Phaen คือระบบจัดการงานสำหรับทีม จัดการงาน, sprint, test cases และอื่นๆ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={lineSeed.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PALETTE_INIT_SCRIPT }} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
