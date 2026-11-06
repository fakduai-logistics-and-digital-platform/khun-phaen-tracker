"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeftRight, Braces, Clock, Code2, FileJson, Hash, Palette, Table2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { ColorTab, CopyIconButton, NumberBaseTab, TimestampTab } from "./converter-extras";
import { convertJsonCsv, convertJsonYaml, generateModel, MODEL_LANGS, type ModelLang } from "./converter-utils";
import { ToolModal } from "./tool-modal";

type Tab = "jsonYaml" | "jsonCsv" | "jsonModel" | "color" | "timestamp" | "numbase";
type YamlFormat = "json" | "yaml";
type CsvFormat = "json" | "csv";

const TABS: { id: Tab; labelKey: string | null; label?: string; icon: LucideIcon }[] = [
  { id: "jsonYaml", labelKey: null, label: "JSON / YAML", icon: FileJson },
  { id: "jsonCsv", labelKey: null, label: "JSON / CSV", icon: Table2 },
  { id: "jsonModel", labelKey: "jsonYamlConverter__tab_json_model", icon: Code2 },
  { id: "color", labelKey: "jsonYamlConverter__tab_color", icon: Palette },
  { id: "timestamp", labelKey: "jsonYamlConverter__tab_timestamp", icon: Clock },
  { id: "numbase", labelKey: "jsonYamlConverter__tab_numbase", icon: Hash },
];

const YAML_OPTIONS: { value: YamlFormat; label: string }[] = [
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
];
const CSV_OPTIONS: { value: CsvFormat; label: string }[] = [
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
];
const MODEL_OPTIONS = MODEL_LANGS.map((opt) => ({ value: opt.l, label: opt.n }));

function readStored(key: string) {
  return typeof window === "undefined" ? "" : (localStorage.getItem(key) ?? "");
}

function usePersistedText(key: string) {
  const state = useState(() => readStored(key));
  const value = state[0];
  useEffect(() => localStorage.setItem(key, value), [key, value]);
  return state;
}

function FormatSelect<T extends string>({
  value,
  options,
  label,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  label: string;
  onChange: (value: T) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger size="sm" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InputPane({
  header,
  value,
  placeholder,
  onChange,
}: {
  header: ReactNode;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex h-8 items-center gap-2">{header}</div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-0 flex-1 resize-none font-mono text-sm field-sizing-fixed"
        placeholder={placeholder}
        aria-label={t("jsonYamlConverter__input")}
        spellCheck={false}
      />
    </div>
  );
}

function OutputPane({ header, output, error }: { header: ReactNode; output: string; error: string }) {
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex h-8 items-center gap-2">
        {header}
        <CopyIconButton text={output} className="ms-auto" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/30 p-3">
        {error ? (
          <p role="alert" className="whitespace-pre-wrap font-mono text-sm text-destructive">
            {error}
          </p>
        ) : (
          <pre className="whitespace-pre-wrap break-all font-mono text-sm">{output}</pre>
        )}
      </div>
    </div>
  );
}

function JsonYamlTab() {
  const { t } = useI18n();
  const [input, setInput] = usePersistedText("conv-jy");
  const [inputFormat, setInputFormat] = useState<YamlFormat>("json");
  const [outputFormat, setOutputFormat] = useState<YamlFormat>("yaml");
  const result = useMemo(() => convertJsonYaml(input, inputFormat, outputFormat), [input, inputFormat, outputFormat]);

  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-4">
      <InputPane
        value={input}
        onChange={setInput}
        placeholder={'{\n  "key": "value"\n}'}
        header={
          <>
            <FormatSelect
              value={inputFormat}
              options={YAML_OPTIONS}
              label={t("jsonYamlConverter__input_format")}
              onChange={(next) => {
                setInputFormat(next);
                setOutputFormat(next === "json" ? "yaml" : "json");
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ms-auto"
              onClick={() => {
                try {
                  setInput(JSON.stringify(JSON.parse(input)));
                } catch {}
              }}
            >
              {t("jsonYamlConverter__minify")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("jsonYamlConverter__swap_formats")}
              onClick={() => {
                if (result.output && !result.error) setInput(result.output);
                setInputFormat(outputFormat);
                setOutputFormat(inputFormat);
              }}
            >
              <ArrowLeftRight />
            </Button>
          </>
        }
      />
      <OutputPane
        header={<span className="text-sm font-medium">{outputFormat.toUpperCase()}</span>}
        output={result.output}
        error={result.error}
      />
    </div>
  );
}

function JsonCsvTab() {
  const { t } = useI18n();
  const [input, setInput] = usePersistedText("conv-jc");
  const [inputFormat, setInputFormat] = useState<CsvFormat>("json");
  const [outputFormat, setOutputFormat] = useState<CsvFormat>("csv");
  const result = useMemo(() => convertJsonCsv(input, inputFormat, outputFormat), [input, inputFormat, outputFormat]);

  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-4">
      <InputPane
        value={input}
        onChange={setInput}
        placeholder={'[\n  { "name": "John", "age": 30 }\n]'}
        header={
          <>
            <FormatSelect
              value={inputFormat}
              options={CSV_OPTIONS}
              label={t("jsonYamlConverter__input_format")}
              onChange={(next) => {
                setInputFormat(next);
                setOutputFormat(next === "json" ? "csv" : "json");
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ms-auto"
              aria-label={t("jsonYamlConverter__swap_formats")}
              onClick={() => {
                if (result.output && !result.error) setInput(result.output);
                setInputFormat(outputFormat);
                setOutputFormat(inputFormat);
              }}
            >
              <ArrowLeftRight />
            </Button>
          </>
        }
      />
      <OutputPane
        header={<span className="text-sm font-medium">{outputFormat.toUpperCase()}</span>}
        output={result.output}
        error={result.error}
      />
    </div>
  );
}

function JsonModelTab() {
  const { t } = useI18n();
  const [input, setInput] = usePersistedText("conv-jm");
  const [lang, setLang] = useState<ModelLang>("swift");
  const [className, setClassName] = useState("MyModel");
  const output = useMemo(() => generateModel(input, lang, className), [input, lang, className]);

  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-4">
      <InputPane
        value={input}
        onChange={setInput}
        placeholder={'{\n  "name": "John",\n  "age": 30\n}'}
        header={<span className="text-sm font-medium">JSON</span>}
      />
      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex h-8 items-center gap-2">
          <FormatSelect
            value={lang}
            options={MODEL_OPTIONS}
            label={t("jsonYamlConverter__language")}
            onChange={setLang}
          />
          <Input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            aria-label={t("jsonYamlConverter__class_name")}
            className="h-8 w-40 font-mono"
            placeholder="ClassName"
          />
          <CopyIconButton text={output} className="ms-auto" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/30 p-3">
          <pre className="whitespace-pre-wrap font-mono text-sm">{output}</pre>
        </div>
      </div>
    </div>
  );
}

export function JsonYamlConverter({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>("jsonYaml");

  return (
    <ToolModal
      onClose={onClose}
      title={t("jsonYamlConverter__title")}
      subtitle={t("jsonYamlConverter__subtitle")}
      icon={Braces}
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="min-h-0 flex-1 gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex-none">
              <tab.icon />
              {tab.labelKey ? t(tab.labelKey) : tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="jsonYaml" className="flex min-h-0 flex-col">
          <JsonYamlTab />
        </TabsContent>
        <TabsContent value="jsonCsv" className="flex min-h-0 flex-col">
          <JsonCsvTab />
        </TabsContent>
        <TabsContent value="jsonModel" className="flex min-h-0 flex-col">
          <JsonModelTab />
        </TabsContent>
        <TabsContent value="color" className="flex min-h-0 flex-col">
          <ColorTab />
        </TabsContent>
        <TabsContent value="timestamp" className="flex min-h-0 flex-col">
          <TimestampTab />
        </TabsContent>
        <TabsContent value="numbase" className="flex min-h-0 flex-col">
          <NumberBaseTab />
        </TabsContent>
      </Tabs>
    </ToolModal>
  );
}
