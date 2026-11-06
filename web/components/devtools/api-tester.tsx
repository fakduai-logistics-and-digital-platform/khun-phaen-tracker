"use client";

import { useState } from "react";
import { Cable, Check, Copy, Globe, Loader2, Plus, Send, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ToolModal } from "./tool-modal";
import { useApiTester, type AuthType, type BodyType, type HttpMethod, type KeyValue } from "./use-api-tester";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: "text-success",
  POST: "text-warning",
  PUT: "text-primary",
  DELETE: "text-destructive",
  PATCH: "text-foreground",
  HEAD: "text-muted-foreground",
  OPTIONS: "text-muted-foreground",
};
const COMMON_HEADERS = [
  { key: "Content-Type", value: "application/json" },
  { key: "Accept", value: "application/json" },
  { key: "Authorization", value: "Bearer " },
];
const TABS = ["headers", "params", "body", "auth"] as const;
type Tab = (typeof TABS)[number];

const statusClass = (code: number) =>
  code >= 500 ? "text-destructive" : code >= 400 ? "text-warning" : code >= 300 ? "text-primary" : "text-success";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function prettyJson(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function KeyValueEditor({
  rows,
  onChange,
  keyLabel,
  addLabel,
  presets,
}: {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  keyLabel: string;
  addLabel: string;
  presets?: { key: string; value: string }[];
}) {
  const { t } = useI18n();
  const update = (i: number, patch: Partial<KeyValue>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={row.enabled}
            aria-label={t("apiTester__enabled")}
            onChange={(e) => update(i, { enabled: e.target.checked })}
          />
          <Input
            value={row.key}
            onChange={(e) => update(i, { key: e.target.value })}
            placeholder={keyLabel}
            className="font-mono text-sm"
          />
          <Input
            value={row.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder={t("apiTester__value")}
            className="font-mono text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("apiTester__remove")}
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onChange([...rows, { key: "", value: "", enabled: true }])}
        >
          <Plus size={14} />
          {addLabel}
        </Button>
        {presets?.map((p) => (
          <Button
            key={p.key}
            type="button"
            variant="ghost"
            size="sm"
            className="font-mono text-xs"
            onClick={() => onChange([...rows, { ...p, enabled: true }])}
          >
            + {p.key}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function ApiTester({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  const { request: r, response, send, ws } = useApiTester();
  const [tab, setTab] = useState<Tab>("headers");
  const [responseTab, setResponseTab] = useState<"body" | "headers">("body");
  const [wsMode, setWsMode] = useState(false);
  const [wsDraft, setWsDraft] = useState("");
  const [copied, setCopied] = useState(false);

  async function copyBody() {
    await navigator.clipboard.writeText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ToolModal
      onClose={onClose ?? (() => {})}
      title={t("apiTester__title")}
      subtitle={wsMode ? t("apiTester__ws_subtitle") : t("apiTester__subtitle")}
      icon={wsMode ? Cable : Globe}
      headerActions={
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setWsMode((v) => !v)}>
          {wsMode ? <Zap size={14} /> : <Cable size={14} />}
          {wsMode ? "HTTP" : "WebSocket"}
        </Button>
      }
      bodyClassName="p-5"
    >
      {wsMode ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={ws.url}
              onChange={(e) => ws.setUrl(e.target.value)}
              placeholder="wss://example.com/socket"
              className="font-mono"
            />
            {ws.state === "connected" ? (
              <Button type="button" variant="destructive" onClick={ws.disconnect}>
                {t("apiTester__ws_disconnect")}
              </Button>
            ) : (
              <Button type="button" disabled={ws.state === "connecting"} onClick={ws.connect}>
                {t("apiTester__ws_connect")}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground" role="status">
            {t(`apiTester__ws_${ws.state}`)}
          </p>
          <div className="h-64 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs">
            {ws.messages.length === 0 && <p className="text-muted-foreground">{t("apiTester__ws_no_messages")}</p>}
            {ws.messages.map((m, i) => (
              <p key={i} className={m.direction === "sent" ? "text-primary" : "text-foreground"}>
                <span className="text-muted-foreground">
                  {new Date(m.time).toLocaleTimeString()} {m.direction === "sent" ? "→" : "←"}{" "}
                </span>
                {m.content}
              </p>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (ws.send(wsDraft)) setWsDraft("");
            }}
          >
            <Input
              value={wsDraft}
              onChange={(e) => setWsDraft(e.target.value)}
              placeholder={t("apiTester__ws_message_placeholder")}
              className="font-mono"
              disabled={ws.state !== "connected"}
            />
            <Button type="submit" disabled={ws.state !== "connected"} className="gap-1.5">
              <Send size={14} />
              {t("apiTester__send")}
            </Button>
            <Button type="button" variant="ghost" onClick={ws.clear}>
              {t("apiTester__ws_clear")}
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-5">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <select
              aria-label={t("apiTester__method")}
              value={r.method}
              onChange={(e) => r.setMethod(e.target.value as HttpMethod)}
              className={cn(
                "h-9 rounded-md border bg-transparent px-2 font-mono text-sm font-bold",
                METHOD_COLOR[r.method],
              )}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Input
              value={r.url}
              onChange={(e) => r.setUrl(e.target.value)}
              placeholder={t("apiTester__url_placeholder")}
              className="font-mono"
            />
            <Button type="submit" disabled={response.loading || !r.url.trim()} className="gap-1.5">
              {response.loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {t("apiTester__send")}
            </Button>
          </form>

          <div>
            <div className="mb-3 flex gap-4 border-b text-sm" role="tablist">
              {TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "border-b-2 pb-2 transition-colors",
                    tab === id ? "border-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`apiTester__${id}`)}
                </button>
              ))}
            </div>

            {tab === "headers" && (
              <KeyValueEditor
                rows={r.headers}
                onChange={r.setHeaders}
                keyLabel={t("apiTester__header")}
                addLabel={t("apiTester__add_header")}
                presets={COMMON_HEADERS}
              />
            )}
            {tab === "params" && (
              <KeyValueEditor
                rows={r.queryParams}
                onChange={r.setQueryParams}
                keyLabel={t("apiTester__param")}
                addLabel={t("apiTester__add_param")}
              />
            )}
            {tab === "body" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(["none", "json", "form", "raw"] as BodyType[]).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      size="sm"
                      variant={r.bodyType === type ? "secondary" : "ghost"}
                      onClick={() => r.setBodyType(type)}
                    >
                      {type === "none" ? t("apiTester__auth_none") : type}
                    </Button>
                  ))}
                </div>
                {r.bodyType === "none" ? (
                  <p className="text-sm text-muted-foreground">{t("apiTester__no_body")}</p>
                ) : (
                  <Textarea
                    value={r.bodyContent}
                    onChange={(e) => r.setBodyContent(e.target.value)}
                    rows={8}
                    spellCheck={false}
                    placeholder={t("apiTester__body_placeholder")}
                    className="font-mono text-sm"
                  />
                )}
              </div>
            )}
            {tab === "auth" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(["none", "bearer", "basic", "apikey"] as AuthType[]).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      size="sm"
                      variant={r.authType === type ? "secondary" : "ghost"}
                      onClick={() => r.setAuthType(type)}
                    >
                      {type === "none" ? t("apiTester__auth_none") : type}
                    </Button>
                  ))}
                </div>
                {r.authType === "none" && <p className="text-sm text-muted-foreground">{t("apiTester__no_auth")}</p>}
                {r.authType === "bearer" && (
                  <Input
                    type="password"
                    autoComplete="off"
                    value={r.bearerToken}
                    onChange={(e) => r.setBearerToken(e.target.value)}
                    placeholder={t("apiTester__token")}
                    className="font-mono"
                  />
                )}
                {r.authType === "basic" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={r.basicUser}
                      onChange={(e) => r.setBasicUser(e.target.value)}
                      placeholder={t("apiTester__username")}
                      autoComplete="off"
                    />
                    <Input
                      type="password"
                      value={r.basicPass}
                      onChange={(e) => r.setBasicPass(e.target.value)}
                      placeholder={t("apiTester__password")}
                      autoComplete="off"
                    />
                  </div>
                )}
                {r.authType === "apikey" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={r.apiKeyHeader}
                      onChange={(e) => r.setApiKeyHeader(e.target.value)}
                      placeholder={t("apiTester__header_name")}
                      className="font-mono"
                    />
                    <Input
                      type="password"
                      value={r.apiKeyValue}
                      onChange={(e) => r.setApiKeyValue(e.target.value)}
                      placeholder={t("apiTester__key")}
                      autoComplete="off"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {(response.status.code > 0 || response.error) && (
            <section className="space-y-3 border-t pt-4">
              {response.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {response.error}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-4 text-sm tabular-nums">
                  <span className={cn("font-bold", statusClass(response.status.code))}>
                    {response.status.code} {response.status.text}
                  </span>
                  <span className="text-muted-foreground">{response.time} ms</span>
                  <span className="text-muted-foreground">{formatSize(response.size)}</span>
                  <div className="ms-auto flex gap-1">
                    {(["body", "headers"] as const).map((id) => (
                      <Button
                        key={id}
                        type="button"
                        size="sm"
                        variant={responseTab === id ? "secondary" : "ghost"}
                        onClick={() => setResponseTab(id)}
                      >
                        {t(`apiTester__${id}`)}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("apiTester__copy")}
                      onClick={() => void copyBody()}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                </div>
              )}
              {!response.error && responseTab === "body" && (
                <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs">
                  {prettyJson(response.body)}
                </pre>
              )}
              {!response.error && responseTab === "headers" && (
                <dl className="max-h-80 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs">
                  {response.headers.map((h) => (
                    <div key={h.key} className="flex gap-2">
                      <dt className="text-muted-foreground">{h.key}:</dt>
                      <dd className="break-all">{h.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          )}
        </div>
      )}
    </ToolModal>
  );
}
