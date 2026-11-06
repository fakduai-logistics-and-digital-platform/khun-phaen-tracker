"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Clock, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { colorFormats, parseNumberBase, parseTimestamp, type NumberBase } from "./converter-utils";

const PRESET_COLORS = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#EAB308",
  "#84CC16",
  "#22C55E",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
  "#0EA5E9",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#000000",
  "#374151",
  "#6B7280",
  "#9CA3AF",
  "#D1D5DB",
  "#F3F4F6",
  "#FFFFFF",
  "#92400E",
];

const NB_QUICK_VALUES: { label: string; base: NumberBase; value: string }[] = [
  { label: "255", base: 10, value: "255" },
  { label: "0xFF", base: 16, value: "FF" },
  { label: "0b11111111", base: 2, value: "11111111" },
  { label: "16", base: 10, value: "16" },
  { label: "0x1A", base: 16, value: "1A" },
  { label: "127", base: 10, value: "127" },
  { label: "65535", base: 10, value: "65535" },
  { label: "0o777", base: 8, value: "777" },
];

const NB_BASES: { base: NumberBase; label: string }[] = [
  { base: 16, label: "HEX" },
  { base: 10, label: "DEC" },
  { base: 8, label: "OCT" },
  { base: 2, label: "BIN" },
];

export function CopyIconButton({ text, className }: { text: string; className?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={t("converter__copy")}
      className={className}
      onClick={copy}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
    </Button>
  );
}

function ResultRow({ label, value, copyText }: { label: string; value: string; copyText?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
      <Badge variant="secondary" className="w-36">
        {label}
      </Badge>
      <code className="flex-1 truncate font-mono text-sm">{value}</code>
      <CopyIconButton text={copyText ?? value} />
    </div>
  );
}

function QuickBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-4">
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

export function ColorTab() {
  const { t } = useI18n();
  const [colorHex, setColorHex] = useState("#6366f1");
  const formats = useMemo(() => colorFormats(colorHex), [colorHex]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="flex items-center gap-4">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(colorHex) ? colorHex : "#000000"}
          onChange={(e) => setColorHex(e.target.value)}
          aria-label={t("converter__color_picker")}
          className="size-16 cursor-pointer rounded-md border bg-transparent p-1"
        />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-10 rounded-md border" style={{ backgroundColor: colorHex }} />
          <Label htmlFor="color-hex">{t("converter__hex")}</Label>
          <Input
            id="color-hex"
            value={colorHex}
            onChange={(e) => setColorHex(e.target.value)}
            className="font-mono"
            placeholder="#6366F1"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("converter__presets")}</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <Button
              key={c}
              type="button"
              variant="outline"
              size="icon-sm"
              title={c}
              aria-label={c}
              aria-pressed={colorHex === c}
              className={cn(colorHex === c && "ring-2 ring-ring")}
              style={{ backgroundColor: c }}
              onClick={() => setColorHex(c)}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("converter__formats")}</p>
        {formats.map((f) => (
          <ResultRow key={f.label} label={f.label} value={f.value} />
        ))}
      </div>
    </div>
  );
}

export function TimestampTab() {
  const { t, locale } = useI18n();
  const [tsInput, setTsInput] = useState("");
  const parsed = useMemo(() => parseTimestamp(tsInput, locale), [tsInput, locale]);

  const rows = parsed
    ? [
        { label: "ISO 8601", value: parsed.iso },
        { label: t("converter__ts_local"), value: parsed.isoLocal },
        { label: "UTC", value: parsed.utc },
        { label: "RFC 2822", value: parsed.rfc2822 },
        { label: t("converter__ts_epoch_seconds"), value: String(parsed.epochSec) },
        { label: t("converter__ts_epoch_ms"), value: String(parsed.epochMs) },
        { label: t("converter__ts_relative"), value: parsed.relative },
        { label: t("converter__ts_day"), value: parsed.dayOfWeek },
        { label: t("converter__ts_date"), value: parsed.dateOnly },
        { label: t("converter__ts_time_utc"), value: parsed.timeOnly },
        { label: t("converter__ts_unix_cmd"), value: parsed.unixCmd },
      ]
    : [];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Clock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={tsInput}
            onChange={(e) => setTsInput(e.target.value)}
            aria-label={t("converter__ts_label")}
            className="ps-9 font-mono"
            placeholder={t("converter__ts_placeholder")}
          />
        </div>
        <Button type="button" onClick={() => setTsInput(String(Math.floor(Date.now() / 1000)))}>
          {t("converter__ts_now")}
        </Button>
      </div>

      {parsed ? (
        <div className="flex flex-col gap-2">
          {rows.map((f) => (
            <ResultRow key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      ) : tsInput.trim() ? (
        <p role="alert" className="rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
          {t("converter__ts_invalid")}
        </p>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("converter__ts_empty")}</p>
      )}

      <QuickBox title={t("converter__quick_reference")}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {[
            [t("converter__ts_ref_seconds"), t("converter__ts_ref_digits", { count: 10 })],
            [t("converter__ts_ref_millis"), t("converter__ts_ref_digits", { count: 13 })],
            [t("converter__ts_ref_micros"), t("converter__ts_ref_digits", { count: 16 })],
            ["ISO 8601", "2024-01-15T…"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{k}</span>
              <code className="font-mono">{v}</code>
            </div>
          ))}
        </div>
      </QuickBox>
    </div>
  );
}

export function NumberBaseTab() {
  const { t } = useI18n();
  const [nbInput, setNbInput] = useState("255");
  const [nbBase, setNbBase] = useState<NumberBase>(10);
  const parsed = useMemo(() => parseNumberBase(nbInput, nbBase), [nbInput, nbBase]);

  const rows = parsed
    ? [
        { label: t("converter__nb_hexadecimal"), value: parsed.hex, prefix: parsed.hexPrefixed },
        { label: t("converter__nb_decimal"), value: parsed.dec, prefix: "" },
        { label: t("converter__nb_octal"), value: parsed.oct, prefix: parsed.octPrefixed },
        { label: t("converter__nb_binary"), value: parsed.bin, prefix: parsed.binPrefixed },
      ]
    : [];

  const chip = (label: string, value: string) => (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
      <Badge variant="secondary">{label}</Badge>
      <code className="font-mono text-sm">{value}</code>
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="flex items-center gap-2">
        <Tabs value={String(nbBase)} onValueChange={(v) => setNbBase(Number(v) as NumberBase)}>
          <TabsList aria-label={t("converter__nb_input_base")}>
            {NB_BASES.map((b) => (
              <TabsTrigger key={b.base} value={String(b.base)}>
                {b.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          value={nbInput}
          onChange={(e) => setNbInput(e.target.value)}
          aria-label={t("converter__nb_number")}
          className="flex-1 font-mono"
          placeholder={t("converter__nb_placeholder")}
          spellCheck={false}
        />
      </div>

      {parsed ? (
        <div className="flex flex-col gap-2">
          {rows.map((f) => (
            <div key={f.label} className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
              <Badge variant="secondary" className="w-36">
                {f.label}
              </Badge>
              <div className="flex flex-1 flex-col">
                <code className="break-all font-mono text-sm">{f.value}</code>
                {f.prefix && <code className="font-mono text-xs text-muted-foreground">{f.prefix}</code>}
              </div>
              <CopyIconButton text={f.prefix || f.value} />
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            {parsed.char ? chip(t("converter__nb_char"), parsed.char) : null}
            {chip(t("converter__nb_bits"), String(parsed.bits))}
            {parsed.byteHex ? chip(t("converter__nb_byte"), parsed.byteHex) : null}
          </div>
        </div>
      ) : nbInput.trim() ? (
        <p role="alert" className="rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
          {t("converter__nb_invalid", { base: nbBase })}
        </p>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("converter__nb_empty")}</p>
      )}

      <QuickBox title={t("converter__quick_values")}>
        <div className="flex flex-wrap gap-2">
          {NB_QUICK_VALUES.map((qv) => (
            <Button
              key={qv.label}
              type="button"
              variant="outline"
              size="sm"
              className="font-mono"
              onClick={() => {
                setNbBase(qv.base);
                setNbInput(qv.value);
              }}
            >
              {qv.label}
            </Button>
          ))}
        </div>
      </QuickBox>
    </div>
  );
}
