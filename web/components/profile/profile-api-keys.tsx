"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, KeyRound, MoreHorizontal, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CreateKeyDialog, DeleteKeyDialog } from "./api-key-dialogs";
import { ConnectGuide, CopyButton } from "./api-key-connect";
import { keepOnly, rememberKey } from "./api-key-store";
import { mcpUrl } from "./api-key-guide";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: number | null;
  revoked_at: string | null;
};

const formatDate = (value: string | number) =>
  new Date(typeof value === "number" ? value * 1000 : value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

/** Personal API keys that let an AI agent talk to the MCP endpoint as this user. */
export function ProfileApiKeys() {
  const { t } = useI18n();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiKey | null>(null);
  const [storedKeys, setStoredKeys] = useState<Record<string, string>>({});
  const [url, setUrl] = useState(() => mcpUrl(""));

  useEffect(() => {
    setUrl(mcpUrl(window.location.origin));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.apiKeys.list();
      if (res.ok) {
        const list: ApiKey[] = (await res.json()).keys ?? [];
        setKeys(list);
        setStoredKeys(keepOnly(list.filter((key) => !key.revoked_at).map((key) => key.id)));
      }
    } catch {
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.apiKeys.create(name.trim());
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("apiKeys__create_error"));
        return;
      }
      setCreatedKey(data.key);
      rememberKey(data.item.id, data.key);
      setName("");
      void load();
    } catch {
      setError(t("apiKeys__create_error"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(key: ApiKey) {
    await api.apiKeys.revoke(key.id);
    void load();
  }

  async function remove(key: ApiKey) {
    setBusy(true);
    try {
      await api.apiKeys.remove(key.id);
      setPendingDelete(null);
      void load();
    } finally {
      setBusy(false);
    }
  }

  const rememberedKey = keys?.find((key) => storedKeys[key.id]);
  const guideKey = (rememberedKey ? storedKeys[rememberedKey.id] : "") || "<API_KEY>";

  function openCreate() {
    setName("");
    setError("");
    setCreatedKey(null);
    setOpen(true);
  }

  function closeCreate() {
    setOpen(false);
    setCreatedKey(null);
    setName("");
    setError("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("apiKeys__title")}</CardTitle>
        <CardDescription>{t("apiKeys__description")}</CardDescription>
        <CardAction>
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus />
            {t("apiKeys__create")}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-6">
        <Alert>
          <ShieldAlert />
          <AlertTitle>{t("apiKeys__security_title")}</AlertTitle>
          <AlertDescription>{t("apiKeys__security_desc")}</AlertDescription>
        </Alert>

        {keys === null ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
            <div className="rounded-md bg-muted p-2.5 text-muted-foreground">
              <KeyRound className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("apiKeys__empty_title")}</p>
              <p className="text-sm text-muted-foreground">{t("apiKeys__empty_desc")}</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={openCreate}>
              <Plus />
              {t("apiKeys__create")}
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("apiKeys__col_name")}</TableHead>
                  <TableHead>{t("apiKeys__col_key")}</TableHead>
                  <TableHead>{t("apiKeys__col_created")}</TableHead>
                  <TableHead>{t("apiKeys__col_last_used")}</TableHead>
                  <TableHead>{t("apiKeys__col_status")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("apiKeys__col_actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id} className={cn(key.revoked_at && "text-muted-foreground")}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-xs">{key.prefix}…</TableCell>
                    <TableCell>{formatDate(key.created_at)}</TableCell>
                    <TableCell>{key.last_used_at ? formatDate(key.last_used_at) : t("apiKeys__never")}</TableCell>
                    <TableCell>
                      {key.revoked_at ? (
                        <Badge variant="outline">{t("apiKeys__status_revoked")}</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-success/15 text-success">
                          {t("apiKeys__status_active")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t("apiKeys__actions_for", { name: key.name })}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!key.revoked_at && (
                            <>
                              <DropdownMenuItem onSelect={() => void revoke(key)}>
                                <Ban />
                                {t("apiKeys__revoke")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(key)}>
                            <Trash2 />
                            {t("apiKeys__delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Separator />

        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">{t("apiKeys__connect_title")}</h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mcp-endpoint">{t("apiKeys__endpoint_label")}</Label>
            <div className="flex items-center gap-2">
              <Input id="mcp-endpoint" readOnly value={url} className="font-mono text-xs" />
              <CopyButton value={url} label={t("apiKeys__endpoint_label")} />
            </div>
          </div>
          <ConnectGuide apiKey={guideKey} url={url} />
        </section>
      </CardContent>

      <CreateKeyDialog
        open={open}
        name={name}
        busy={busy}
        error={error}
        createdKey={createdKey}
        mcpUrl={url}
        onNameChange={setName}
        onSubmit={() => void create()}
        onClose={closeCreate}
      />
      <DeleteKeyDialog
        name={pendingDelete?.name ?? null}
        busy={busy}
        onConfirm={() => pendingDelete && void remove(pendingDelete)}
        onClose={() => setPendingDelete(null)}
      />
    </Card>
  );
}
