"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { I18nProvider } from "@/lib/i18n";
import { ThemeBridge } from "@/lib/stores/theme";
import { PageStoreSync } from "@/lib/page-store";
import { GlobalConfirmModal } from "@/components/shared/global-confirm-modal";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="khu-phaen-theme"
      disableTransitionOnChange
    >
      <I18nProvider>
        <AuthProvider>
          <PageStoreSync />
          <ThemeBridge />
          {children}
          <GlobalConfirmModal />
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
