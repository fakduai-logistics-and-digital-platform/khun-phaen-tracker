"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { LanguagePicker } from "@/components/language-picker";
import { PaletteSwitch } from "@/components/palette-switch";
import { Search as HeaderSearch } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { api } from "@/lib/api/apis";
import { useAuth } from "@/lib/auth/auth-provider";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [verifiedAdmin, setVerifiedAdmin] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.auth.me();
        if (cancelled) return;
        if (!res.ok) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        if (data.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setVerifiedAdmin(true);
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  return (
    <AuthenticatedLayout>
      <Header>
        <HeaderSearch />
        <div className="ms-auto flex items-center gap-2">
          <LanguagePicker />
          <PaletteSwitch />
          <ThemeSwitch />
        </div>
      </Header>
      <Main id="content">
        {verifiedAdmin ? (
          children
        ) : (
          <div className="flex justify-center py-20 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
          </div>
        )}
      </Main>
    </AuthenticatedLayout>
  );
}
