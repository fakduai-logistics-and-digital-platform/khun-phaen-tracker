"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api/apis";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import {
  TURNSTILE_SITE_KEY,
  TurnstileWidget,
  type TurnstileHandle,
} from "./turnstile-widget";

export function LoginForm() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstile = useRef<TurnstileHandle>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.auth.login(email, password, turnstileToken);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("login__error_default"));
        turnstile.current?.reset();
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
      turnstile.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  const passwordToggleLabel = showPassword
    ? t("login__hide_password")
    : t("login__show_password");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t("login__title")}</CardTitle>
        <CardDescription>{t("login__subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="email">{t("login__email_label")}</FieldLabel>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                aria-invalid={!!error}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("login__email_placeholder")}
              />
            </Field>

            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="password">
                {t("login__password_label")}
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  aria-invalid={!!error}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={passwordToggleLabel}
                    title={passwordToggleLabel}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <EyeOff
                        key="hide"
                        className="animate-in zoom-in-75 fade-in duration-150 motion-reduce:animate-none"
                      />
                    ) : (
                      <Eye
                        key="show"
                        className="animate-in zoom-in-75 fade-in duration-150 motion-reduce:animate-none"
                      />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <TurnstileWidget ref={turnstile} onToken={setTurnstileToken} />

            {error && (
              <Alert
                variant="destructive"
                className="animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none"
              >
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Field>
              <Button
                type="submit"
                className="transition-[color,background-color,transform] duration-150 active:scale-[0.98]"
                disabled={loading || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
              >
                {loading && <Spinner data-icon="inline-start" />}
                {t("login__btn_submit")}
              </Button>
              <FieldDescription className="text-center">
                {t("login__invitation_only")}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
