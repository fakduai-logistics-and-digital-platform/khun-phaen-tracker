"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, Check, Copy, Info, Key, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { RichText } from "./rich-text";
import { ToolModal } from "./tool-modal";

type Tab = "base64" | "jwt";
type Base64Mode = "encode" | "decode";
type JwtResult = {
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  errorKey: string;
  notExpired: boolean | null;
};

const KNOWN_CLAIMS = [
  "exp",
  "iat",
  "nbf",
  "sub",
  "iss",
  "aud",
  "jti",
  "role",
  "user_id",
  "email",
  "name",
  "scope",
  "permissions",
];
const TIMESTAMP_CLAIMS = ["exp", "iat", "nbf"];

function processBase64(input: string, mode: Base64Mode) {
  if (!input.trim()) return { output: "", errorKey: "" };
  try {
    const output =
      mode === "encode" ? btoa(unescape(encodeURIComponent(input))) : decodeURIComponent(escape(atob(input.trim())));
    return { output, errorKey: "" };
  } catch {
    return {
      output: "",
      errorKey: mode === "encode" ? "encoderDecoder__error_encode" : "encoderDecoder__error_decode",
    };
  }
}

function decodeSegment(part: string) {
  return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
}

function decodeJwt(input: string): JwtResult {
  const empty: JwtResult = { header: null, payload: null, errorKey: "", notExpired: null };
  const token = input.trim();
  if (!token) return empty;

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { ...empty, errorKey: "encoderDecoder__error_jwt_parts" };
  }

  let header: Record<string, unknown>;
  try {
    header = decodeSegment(parts[0]);
  } catch {
    return { ...empty, errorKey: "encoderDecoder__error_jwt_header" };
  }

  let payload: Record<string, unknown>;
  try {
    payload = decodeSegment(parts[1]);
  } catch {
    return { ...empty, header, errorKey: "encoderDecoder__error_jwt_payload" };
  }

  const notExpired = payload?.exp ? (payload.exp as number) * 1000 > Date.now() : null;
  return { header, payload, errorKey: "", notExpired };
}

function formatTimestamp(ts: number, t: (key: string) => string): string {
  const date = new Date(ts * 1000);
  const isExpired = ts * 1000 < Date.now();
  return `${date.toLocaleString()} ${isExpired ? t("encoderDecoder__timestamp_expired") : t("encoderDecoder__timestamp_valid")}`;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-center gap-2 rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive"
    >
      <AlertTriangle className="size-4 shrink-0" />
      {message}
    </p>
  );
}

function CopyButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  const { t } = useI18n();
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
      {copied ? <Check className="text-success" /> : <Copy />}
      {copied ? t("encoderDecoder__copied") : t("encoderDecoder__copy")}
    </Button>
  );
}

function HelpPanel({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-4 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Key className="size-4" />
          {t("encoderDecoder__tab_base64")}
        </p>
        <ul className="list-disc space-y-1 ps-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <li key={n}>
              <RichText text={t(`encoderDecoder__help_b64_${n}`)} />
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <ShieldCheck className="size-4" />
          {t("encoderDecoder__tab_jwt")}
        </p>
        <ul className="list-disc space-y-1 ps-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <li key={n}>
              <RichText text={t(`encoderDecoder__help_jwt_${n}`)} />
            </li>
          ))}
        </ul>
      </div>
      <Button type="button" variant="outline" size="sm" className="self-end" onClick={onDismiss}>
        {t("encoderDecoder__got_it")}
      </Button>
    </div>
  );
}

export function EncoderDecoder({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>("base64");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [base64Input, setBase64Input] = useState("");
  const [base64Mode, setBase64Mode] = useState<Base64Mode>("encode");
  const [jwtInput, setJwtInput] = useState("");

  const base64 = useMemo(() => processBase64(base64Input, base64Mode), [base64Input, base64Mode]);
  const jwt = useMemo(() => decodeJwt(jwtInput), [jwtInput]);

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function swapBase64() {
    setBase64Input(base64.output);
    setBase64Mode((m) => (m === "encode" ? "decode" : "encode"));
  }

  const jwtSection = (title: string, field: string, value: Record<string, unknown>) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <CopyButton
          copied={copiedField === field}
          onCopy={() => copyToClipboard(JSON.stringify(value, null, 2), field)}
        />
      </div>
      <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-sm">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );

  return (
    <ToolModal
      onClose={onClose}
      title={t("encoderDecoder__title")}
      subtitle={t("encoderDecoder__subtitle")}
      icon={Key}
      bodyClassName="gap-4"
      onEscapeKeyDown={(e) => {
        if (showHelp) {
          e.preventDefault();
          setShowHelp(false);
        }
      }}
      headerActions={
        <Button
          type="button"
          variant={showHelp ? "secondary" : "ghost"}
          size="icon"
          aria-label={t("encoderDecoder__how_to_use")}
          aria-expanded={showHelp}
          onClick={() => setShowHelp((v) => !v)}
        >
          <Info />
        </Button>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-4 text-sm text-muted-foreground">
          <Badge variant="secondary">
            {activeTab === "base64" ? t("encoderDecoder__footer_base64") : t("encoderDecoder__footer_jwt")}
          </Badge>
          <span>
            {activeTab === "base64" ? t("encoderDecoder__footer_base64_hint") : t("encoderDecoder__footer_jwt_hint")}
          </span>
        </div>
      }
    >
      {showHelp && <HelpPanel onDismiss={() => setShowHelp(false)} />}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="gap-4">
        <TabsList>
          <TabsTrigger value="base64">
            <Key />
            {t("encoderDecoder__tab_base64")}
          </TabsTrigger>
          <TabsTrigger value="jwt">
            <ShieldCheck />
            {t("encoderDecoder__tab_jwt")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="base64" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <Tabs value={base64Mode} onValueChange={(v) => setBase64Mode(v as Base64Mode)}>
              <TabsList>
                <TabsTrigger value="encode">{t("encoderDecoder__mode_encode")}</TabsTrigger>
                <TabsTrigger value="decode">{t("encoderDecoder__mode_decode")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("encoderDecoder__swap")}
              onClick={swapBase64}
            >
              <ArrowRightLeft />
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="base64-input">
              {base64Mode === "encode" ? t("encoderDecoder__label_plain") : t("encoderDecoder__label_base64")}
            </Label>
            <Textarea
              id="base64-input"
              value={base64Input}
              onChange={(e) => setBase64Input(e.target.value)}
              rows={4}
              spellCheck={false}
              className="font-mono text-sm"
              placeholder={
                base64Mode === "encode"
                  ? t("encoderDecoder__placeholder_encode")
                  : t("encoderDecoder__placeholder_decode")
              }
            />
          </div>

          {base64.errorKey && <ErrorBanner message={t(base64.errorKey)} />}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {base64Mode === "encode" ? t("encoderDecoder__output_base64") : t("encoderDecoder__output_decoded")}
              </p>
              {base64.output && (
                <CopyButton
                  copied={copiedField === "base64-output"}
                  onCopy={() => copyToClipboard(base64.output, "base64-output")}
                />
              )}
            </div>
            <div className="min-h-20 whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 font-mono text-sm">
              {base64.output || (
                <span className="text-muted-foreground">{t("encoderDecoder__output_placeholder")}</span>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="jwt" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="jwt-input">{t("encoderDecoder__jwt_token")}</Label>
            <Textarea
              id="jwt-input"
              value={jwtInput}
              onChange={(e) => setJwtInput(e.target.value)}
              rows={3}
              spellCheck={false}
              className="font-mono text-sm"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
            />
          </div>

          {jwt.errorKey && <ErrorBanner message={t(jwt.errorKey)} />}

          {jwt.header && jwt.payload && (
            <>
              {Boolean(jwt.payload.exp) &&
                (jwt.notExpired ? (
                  <p className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-success">
                    <ShieldCheck className="size-4 shrink-0" />
                    {t("encoderDecoder__token_valid")}
                  </p>
                ) : (
                  <p className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-destructive">
                    <AlertTriangle className="size-4 shrink-0" />
                    {t("encoderDecoder__token_expired")}
                  </p>
                ))}

              {jwtSection(t("encoderDecoder__header"), "jwt-header", jwt.header)}
              {jwtSection(t("encoderDecoder__payload"), "jwt-payload", jwt.payload)}

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{t("encoderDecoder__key_claims")}</p>
                {Object.entries(jwt.payload).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3 rounded-md border bg-muted/30 px-3 py-2">
                    <Badge variant={KNOWN_CLAIMS.includes(key) ? "default" : "outline"} className="w-28">
                      {key}
                    </Badge>
                    <span className="flex-1 break-all font-mono text-sm">
                      {TIMESTAMP_CLAIMS.includes(key) && typeof value === "number"
                        ? formatTimestamp(value, t)
                        : typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </ToolModal>
  );
}
