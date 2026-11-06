export type Row = Record<string, string>;
export type Parsed = { columns: string[]; rows: Row[] };
export type ColStats = {
  count: number;
  unique: number;
  numeric: boolean;
  mean: string;
  median: string;
  min: string;
  max: string;
  topValues: { value: string; count: number }[];
};

export function parseCsv(text: string, delimiter: string): Parsed {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { columns: [], rows: [] };
  const delim = delimiter.charAt(0);

  const splitLine = (line: string) => {
    const out: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === delim && !quoted) {
        out.push(current.trim());
        current = "";
      } else current += ch;
    }
    out.push(current.trim());
    return out;
  };

  const columns = splitLine(lines[0]);
  const rows = lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const values = splitLine(line);
      return Object.fromEntries(columns.map((c, j) => [c, values[j] ?? ""])) as Row;
    });
  return { columns, rows };
}

export function parseJson(text: string): Parsed {
  const data: unknown = JSON.parse(text);
  let items: unknown[];
  if (Array.isArray(data)) items = data;
  else if (typeof data === "object" && data !== null) items = [data];
  else throw new Error("JSON must be an array or object");
  if (items.length === 0) return { columns: [], rows: [] };

  const columnSet = new Set<string>();
  for (const item of items) {
    if (typeof item === "object" && item !== null) Object.keys(item).forEach((k) => columnSet.add(k));
  }
  const columns = Array.from(columnSet);
  const rows = items.map((item) => {
    if (typeof item !== "object" || item === null)
      return Object.fromEntries(columns.map((c) => [c, String(item)])) as Row;
    const record = item as Record<string, unknown>;
    return Object.fromEntries(
      columns.map((c) => {
        const v = record[c];
        return [c, v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)];
      }),
    ) as Row;
  });
  return { columns, rows };
}

export function computeStats(columns: string[], rows: Row[]): Record<string, ColStats> {
  const stats: Record<string, ColStats> = {};
  for (const col of columns) {
    const values = rows.map((r) => String(r[col] ?? "")).filter((v) => v !== "");
    const nums = values.map(Number).filter((n) => !Number.isNaN(n));
    const numeric = nums.length > values.length * 0.5;
    let mean = "-";
    let median = "-";
    let min = "-";
    let max = "-";
    if (numeric && nums.length > 0) {
      nums.sort((a, b) => a - b);
      mean = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
      const mid = Math.floor(nums.length / 2);
      median = (nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2).toFixed(2);
      min = String(nums[0]);
      max = String(nums[nums.length - 1]);
    }
    const freq = new Map<string, number>();
    for (const v of values) freq.set(v, (freq.get(v) || 0) + 1);
    const topValues = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));
    stats[col] = { count: values.length, unique: new Set(values).size, numeric, mean, median, min, max, topValues };
  }
  return stats;
}

export function exportRows(columns: string[], rows: Row[], format: "csv" | "json") {
  let content: string;
  if (format === "csv") {
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    content = [columns.join(","), ...rows.map((r) => columns.map((c) => escape(String(r[c] ?? ""))).join(","))].join(
      "\n",
    );
  } else {
    content = JSON.stringify(
      rows.map((r) =>
        Object.fromEntries(
          columns.map((c) => {
            const v = String(r[c] ?? "");
            const n = Number(v);
            return [c, v !== "" && !Number.isNaN(n) ? n : v];
          }),
        ),
      ),
      null,
      2,
    );
  }
  const url = URL.createObjectURL(new Blob([content], { type: format === "csv" ? "text/csv" : "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `data-export.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
