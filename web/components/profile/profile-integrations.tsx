"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Timer, Unlink } from "lucide-react";
import { WORKZY_CHANGED } from "@/components/workzy/use-workzy-time";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type WorkzyStatus = { enabled: boolean; connected: boolean; employee_code?: string | null };

/** Linked services. Workzy shows today's check-in work time in the sidebar on every page. */
export function ProfileIntegrations() {
  const { t } = useI18n();
  const [status, setStatus] = useState<WorkzyStatus | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.workzy.status();
      if (res.ok) setStatus(await res.json());
    } catch {
      /* The section simply stays hidden when the status cannot load. */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.workzy.connect(code.trim(), password);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("workzy__connect_error"));
        return;
      }
      setStatus(data);
      setPassword("");
      setOpen(false);
      window.dispatchEvent(new Event(WORKZY_CHANGED));
    } catch {
      setError(t("workzy__connect_error"));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const res = await api.workzy.disconnect();
      if (res.ok) {
        setStatus(await res.json());
        setOpen(false);
        window.dispatchEvent(new Event(WORKZY_CHANGED));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!status?.enabled) return null;

  const description = status.connected
    ? t("workzy__connected", { code: status.employee_code ?? "" })
    : t("workzy__description");

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold">{t("profile__integrations_title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("profile__integrations_subtitle")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="gap-4 shadow-none">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Timer />
            </div>
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                className={cn(status.connected && "border-primary bg-primary/10 text-primary hover:bg-primary/20")}
                onClick={() => setOpen(true)}
              >
                {status.connected ? t("workzy__connected_badge") : t("workzy__connect")}
              </Button>
            </CardAction>
          </CardHeader>
          <CardHeader>
            <CardTitle>Workzy</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Workzy</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {status.connected ? (
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => void disconnect()}>
                {busy ? <Spinner data-icon="inline-start" /> : <Unlink data-icon="inline-start" />}
                {t("workzy__disconnect")}
              </Button>
            </DialogFooter>
          ) : (
            <form onSubmit={connect}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="workzy-code">{t("workzy__employee_code")}</FieldLabel>
                  <Input
                    id="workzy-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="off"
                    required
                  />
                </Field>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="workzy-password">{t("workzy__password")}</FieldLabel>
                  <Input
                    id="workzy-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    autoComplete="off"
                    required
                  />
                  <FieldDescription>{t("workzy__password_note")}</FieldDescription>
                  {error && <FieldError>{error}</FieldError>}
                </Field>
                <DialogFooter>
                  <Button type="submit" disabled={busy || !code.trim() || !password}>
                    {busy ? <Spinner data-icon="inline-start" /> : <Link2 data-icon="inline-start" />}
                    {t("workzy__connect")}
                  </Button>
                </DialogFooter>
              </FieldGroup>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
