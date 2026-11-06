"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Cloud, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/apis";
import { withBase } from "@/lib/base-path";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";

export function LoginForm() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accessEnabled, setAccessEnabled] = useState(false);

  useEffect(() => {
    void api.auth.accessEnabled().then(setAccessEnabled);
  }, []);

  // Returning from Cloudflare Access: the API sends the session token in the URL fragment, or an error code in the query.
  useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.hash.replace(/^#/, ""));
    const token = params.get("access_token");
    const accessError = url.searchParams.get("access_error");
    if (!token && !accessError) return;
    window.history.replaceState(null, "", url.pathname);
    if (accessError) {
      setError(
        t(accessError === "not_registered" ? "login__error_access_not_registered" : "login__error_access_denied"),
      );
      return;
    }
    if (!token) return;
    setLoading(true);
    void (async () => {
      try {
        const res = await api.auth.meWithToken(token);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        signIn(token, {
          id: data.id || "",
          email: data.email,
          user_id: data.user_id || "",
          role: data.role || "user",
          profile: data.profile,
        });
        router.push("/dashboard");
      } catch {
        setError(t("login__error_default"));
        setLoading(false);
      }
    })();
    // Runs once on arrival; `signIn`, `router` and `t` are stable enough for this hand-off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCloudflareSignIn() {
    window.location.href = api.auth.accessLoginUrl(`${window.location.origin}${withBase("/login/")}`);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.auth.login(email, password);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("login__error_default"));
        return;
      }
      signIn(data.token, {
        id: data.id || "",
        email: data.email || email,
        user_id: data.user_id || "",
        role: data.role || "user",
        profile: data.profile,
      });
      router.push("/dashboard");
    } catch {
      setError(t("login__error_default"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-6 sm:p-8">
      <p className="text-sm text-muted-foreground">{t("login__subtitle")}</p>
      <h2 className="mt-1 text-3xl font-bold">{t("login__title")}</h2>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">{t("login__email_label")}</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("login__email_placeholder")}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("login__password_label")}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pe-11"
            />
            <button
              type="button"
              className="absolute inset-y-0 end-0 grid w-11 place-items-center rounded-e-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="h-11 w-full gap-2">
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              {t("login__btn_submit")}
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      {accessEnabled && (
        <>
          <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("login__or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={handleCloudflareSignIn}
            className="h-11 w-full gap-2"
          >
            <Cloud className="size-4" />
            {t("login__btn_cloudflare")}
          </Button>
        </>
      )}

      <p className="mt-6 border-t pt-6 text-center text-sm text-muted-foreground">{t("login__invitation_only")}</p>
    </div>
  );
}
