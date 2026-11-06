"use client";

import { useEffect, useRef, useState } from "react";
import { UserCircle2 } from "lucide-react";
import { LanguagePicker } from "@/components/language-picker";
import { PaletteSwitch } from "@/components/palette-switch";
import { Search as HeaderSearch } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { ProfileIntegrations } from "@/components/profile/profile-integrations";
import { ProfileForm, type ProfileFormValues } from "@/components/profile/profile-form";
import { ProfileSummary } from "@/components/profile/profile-summary";
import { api } from "@/lib/api/apis";
import { getCookie, useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";

const EMPTY_VALUES: ProfileFormValues = {
  firstName: "",
  lastName: "",
  nickname: "",
  position: "",
  discordId: "",
  password: "",
  confirmPassword: "",
};

export default function ProfilePage() {
  const { t } = useI18n();
  const { user, signIn } = useAuth();
  const [values, setValues] = useState<ProfileFormValues>(EMPTY_VALUES);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    document.title = t("meta__profile_title");
  }, [t]);

  useEffect(() => {
    if (!user || initialized.current) return;
    initialized.current = true;
    setValues((prev) => ({
      ...prev,
      firstName: user.profile?.first_name || "",
      lastName: user.profile?.last_name || "",
      nickname: user.profile?.nickname || "",
      position: user.profile?.position || "",
      discordId: user.discord_id || "",
    }));
  }, [user]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  function setValue<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (values.password && values.password !== values.confirmPassword) {
      setError(t("profileModal__password_mismatch"));
      return;
    }

    setLoading(true);
    setError("");
    setSaveSuccess(false);

    try {
      const payload: Record<string, unknown> = {
        first_name: values.firstName,
        last_name: values.lastName,
        nickname: values.nickname,
        position: values.position,
        discord_id: values.discordId,
      };
      if (values.password) payload.password = values.password;

      const res = await api.auth.updateMe(payload);
      const data = await res.json();

      if (data.success) {
        setSaveSuccess(true);
        setValues((prev) => ({ ...prev, password: "", confirmPassword: "" }));
        const token = getCookie("_khun_ph_token");
        if (user && token) {
          signIn(token, {
            ...user,
            discord_id: values.discordId,
            profile: {
              ...user.profile,
              first_name: values.firstName,
              last_name: values.lastName,
              nickname: values.nickname,
              position: values.position,
            },
          });
        }
      } else {
        setError(data.error || t("profileModal__save_error"));
      }
    } catch (e) {
      console.error("Update profile failed:", e);
      setError(t("profileModal__save_error"));
    } finally {
      setLoading(false);
    }
  }

  const displayName =
    [user?.profile?.first_name, user?.profile?.last_name].filter(Boolean).join(" ") ||
    user?.profile?.nickname ||
    user?.email?.split("@")[0] ||
    "";

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
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <ProfileSummary
            displayName={displayName}
            email={user?.email || ""}
            role={user?.role || ""}
            nickname={values.nickname}
            position={values.position}
          />

          <section className="min-w-0 animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="bg-gradient-to-br from-brand-500/15 via-muted/30 to-transparent px-6 py-7 sm:px-8">
                <div className="mb-4 inline-flex rounded-xl bg-background/70 p-3 ring-1 ring-border backdrop-blur">
                  <UserCircle2 size={22} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("profileModal__title")}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t("profileModal__subtitle")}</p>
              </div>
            </div>

            <ProfileForm
              email={user?.email ?? ""}
              values={values}
              loading={loading}
              error={error}
              saveSuccess={saveSuccess}
              onChange={setValue}
              onSubmit={() => void handleSubmit()}
            />

            <ProfileIntegrations />
          </section>
        </div>
      </Main>
    </AuthenticatedLayout>
  );
}
