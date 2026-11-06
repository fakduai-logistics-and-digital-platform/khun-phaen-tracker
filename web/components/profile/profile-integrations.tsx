"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, Unlink } from "lucide-react";
import { WORKZY_CHANGED } from "@/components/workzy/use-workzy-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";

type WorkzyStatus = { enabled: boolean; connected: boolean; employee_code?: string | null };

/** Linked services. Workzy shows today's check-in work time in the sidebar on every page. */
export function ProfileIntegrations() {
  const { t } = useI18n();
  const [status, setStatus] = useState<WorkzyStatus | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
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
        window.dispatchEvent(new Event(WORKZY_CHANGED));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!status?.enabled) return null;

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold">{t("profile__integrations_title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("profile__integrations_subtitle")}</p>

      <div className="mt-6 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Workzy</span>
              {status.connected && <Badge variant="secondary">{t("workzy__connected_badge")}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {status.connected
                ? t("workzy__connected", { code: status.employee_code ?? "" })
                : t("workzy__description")}
            </p>
          </div>
          {status.connected && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void disconnect()}>
              {busy ? <Loader2 className="animate-spin" /> : <Unlink />}
              {t("workzy__disconnect")}
            </Button>
          )}
        </div>

        {!status.connected && (
          <form onSubmit={connect} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="workzy-code">{t("workzy__employee_code")}</Label>
              <Input
                id="workzy-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="workzy-password">{t("workzy__password")}</Label>
              <Input
                id="workzy-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("workzy__password_note")}</p>
            {error && (
              <p role="alert" className="text-sm text-destructive sm:col-span-2">
                {error}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy || !code.trim() || !password}>
                {busy ? <Loader2 className="animate-spin" /> : <Link2 />}
                {t("workzy__connect")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
