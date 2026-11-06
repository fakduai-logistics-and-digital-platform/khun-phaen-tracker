"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Check, Copy, Search, Table, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { computeStats, exportRows, parseCsv, parseJson, type Row } from "./csv-json-utils";
import { ToolModal } from "./tool-modal";

const STORAGE_KEY = "csv-json-viewer";
const DELIMITERS = [",", ";", "\t", "|"];

export function CsvJsonViewer({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();

  const [rawInput, setRawInput] = useState("");
  const [mode, setMode] = useState<"csv" | "json">("csv");
  const [delimiter, setDelimiter] = useState(",");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [parseError, setParseError] = useState("");
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);
  const [filterCol, setFilterCol] = useState("");
  const [filterVal, setFilterVal] = useState("");
  const [search, setSearch] = useState("");
  const [statsOpen, setStatsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hydrated = useRef(false);

  function parse(text = rawInput, nextMode = mode, nextDelimiter = delimiter) {
    setParseError("");
    if (!text.trim()) {
      setColumns([]);
      setRows([]);
      return;
    }
    try {
      const result = nextMode === "csv" ? parseCsv(text, nextDelimiter) : parseJson(text);
      setColumns(result.columns);
      setRows(result.rows);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : t("csvJsonViewer__parse_error"));
      setColumns([]);
      setRows([]);
    }
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const nextMode = /\.jsonl?$/.test(file.name) ? "json" : "csv";
      setMode(nextMode);
      setRawInput(text);
      parse(text, nextMode);
    };
    reader.readAsText(file);
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as {
        rawInput?: string;
        mode?: "csv" | "json";
        delimiter?: string;
      } | null;
      if (saved?.rawInput) {
        const savedMode = saved.mode || "csv";
        const savedDelimiter = saved.delimiter || ",";
        setRawInput(saved.rawInput);
        setMode(savedMode);
        setDelimiter(savedDelimiter);
        parse(saved.rawInput, savedMode, savedDelimiter);
      }
    } catch {
      /* Ignore malformed saved state. */
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ rawInput: rawInput.length < 200_000 ? rawInput : "", mode, delimiter }),
    );
  }, [rawInput, mode, delimiter]);

  const visibleRows = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        columns.some((c) =>
          String(row[c] ?? "")
            .toLowerCase()
            .includes(q),
        ),
      );
    }
    if (filterCol && filterVal) {
      const q = filterVal.toLowerCase();
      result = result.filter((row) =>
        String(row[filterCol] ?? "")
          .toLowerCase()
          .includes(q),
      );
    }
    if (sort) {
      const { col, dir } = sort;
      result = [...result].sort((a, b) => {
        const va = String(a[col] ?? "");
        const vb = String(b[col] ?? "");
        const na = Number(va);
        const nb = Number(vb);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return dir === "asc" ? na - nb : nb - na;
        return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return result;
  }, [rows, columns, search, filterCol, filterVal, sort]);

  const stats = useMemo(() => (statsOpen ? computeStats(columns, rows) : {}), [statsOpen, columns, rows]);

  function toggleSort(col: string) {
    setSort((prev) => (prev?.col !== col ? { col, dir: "asc" } : prev.dir === "asc" ? { col, dir: "desc" } : null));
  }

  async function copyTable() {
    if (visibleRows.length === 0) return;
    const body = visibleRows.map((r) => columns.map((c) => String(r[c] ?? "")).join("\t")).join("\n");
    await navigator.clipboard.writeText(`${columns.join("\t")}\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasData = rows.length > 0;

  return (
    <ToolModal
      onClose={onClose ?? (() => {})}
      title={t("csvJsonViewer__title")}
      subtitle={t("csvJsonViewer__subtitle")}
      icon={Table}
      headerActions={
        hasData ? (
          <Button
            type="button"
            variant={statsOpen ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => setStatsOpen((v) => !v)}
          >
            <BarChart3 size={14} />
            {t("csvJsonViewer__stats")}
          </Button>
        ) : undefined
      }
      bodyClassName="space-y-4 p-5"
    >
      {!hasData && (
        <>
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) readFile(file);
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground transition-colors",
              dragging && "border-primary bg-primary/5",
            )}
          >
            <Upload size={32} />
            <p>{t("csvJsonViewer__dropzone")}</p>
            <label className="cursor-pointer rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-accent">
              {t("csvJsonViewer__browse")}
              <input
                type="file"
                accept=".csv,.json,.jsonl,.tsv,.txt"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) readFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["csv", "json"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={mode === m ? "secondary" : "ghost"}
                  className="uppercase"
                  onClick={() => setMode(m)}
                >
                  {m}
                </Button>
              ))}
            </div>
            {mode === "csv" && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>{t("csvJsonViewer__delimiter")}:</span>
                {DELIMITERS.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={delimiter === d ? "secondary" : "ghost"}
                    className="font-mono"
                    onClick={() => setDelimiter(d)}
                  >
                    {d === "\t" ? "TAB" : d}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <Textarea
            value={rawInput}
            rows={8}
            spellCheck={false}
            className="font-mono text-sm"
            placeholder={mode === "csv" ? "name,age,city\nAlice,30,Bangkok" : '[{"name": "Alice", "age": 30}]'}
            onChange={(e) => setRawInput(e.target.value)}
          />
          {rawInput.trim() && (
            <Button type="button" onClick={() => parse()}>
              {t("csvJsonViewer__parse")}
            </Button>
          )}
        </>
      )}

      {parseError && (
        <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {parseError}
        </p>
      )}

      {hasData && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("csvJsonViewer__search")}
                className="ps-9"
                aria-label={t("csvJsonViewer__search")}
              />
            </div>
            <select
              aria-label={t("csvJsonViewer__filter_col")}
              value={filterCol}
              onChange={(e) => setFilterCol(e.target.value)}
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="">{t("csvJsonViewer__filter_col")}</option>
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {filterCol && (
              <Input
                value={filterVal}
                onChange={(e) => setFilterVal(e.target.value)}
                placeholder={t("csvJsonViewer__filter_val")}
                className="w-40"
                aria-label={t("csvJsonViewer__filter_val")}
              />
            )}
            <span className="text-sm tabular-nums text-muted-foreground">
              {visibleRows.length} / {rows.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("csvJsonViewer__copy")}
              onClick={() => void copyTable()}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => exportRows(columns, visibleRows, "csv")}>
              CSV
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => exportRows(columns, visibleRows, "json")}>
              JSON
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setRawInput("");
                setRows([]);
                setColumns([]);
                setSort(null);
                setSearch("");
                setFilterCol("");
                setFilterVal("");
              }}
            >
              {t("csvJsonViewer__clear")}
            </Button>
          </div>

          {statsOpen && (
            <div className="grid gap-3 sm:grid-cols-2">
              {columns.map((c) => {
                const s = stats[c];
                if (!s) return null;
                return (
                  <div key={c} className="rounded-lg border p-3 text-xs">
                    <p className="mb-1 truncate font-bold">{c}</p>
                    <p className="tabular-nums text-muted-foreground">
                      {t("csvJsonViewer__stat_count")} {s.count} · {t("csvJsonViewer__stat_unique")} {s.unique}
                      {s.numeric &&
                        ` · ${t("csvJsonViewer__stat_mean")} ${s.mean} · ${t("csvJsonViewer__stat_median")} ${s.median} · ${t("csvJsonViewer__stat_min")} ${s.min} · ${t("csvJsonViewer__stat_max")} ${s.max}`}
                    </p>
                    {!s.numeric && (
                      <p className="mt-1 text-muted-foreground">
                        {s.topValues.map((v) => `${v.value} (${v.count})`).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="max-h-[50vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {columns.map((c) => {
                    const Icon = sort?.col !== c ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <th key={c} className="px-3 py-2 text-start font-bold">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort(c)}>
                          {c}
                          <Icon size={12} className="text-muted-foreground" />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => (
                  <tr key={i} className="border-t hover:bg-accent/40">
                    {columns.map((c) => (
                      <td key={c} className="max-w-xs truncate px-3 py-1.5" title={row[c]}>
                        {row[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ToolModal>
  );
}
